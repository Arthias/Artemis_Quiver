/// <reference types="chrome" />
// Side-panel sections for applying: the linked CV folder ("CVs") and form
// filling from the form profile ("Apply"). See
// artemis_quiver_docs/60-Roadmap/Application-Assist.md.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { t } from "./i18n";
import { siteToOriginPatterns } from "./job-sites";
import { extractPageContent } from "./pageExtract";
import {
  scanFormFields,
  fillFormFields,
  attachFileToInput,
  watchFormAnswers,
  FORM_ANSWERS_MSG,
  type ScannedField,
  type ScannedFileInput,
} from "./formPageScripts";
import {
  getFolderHandle,
  pickFolder,
  hasFolderAccess,
  ensureFolderAccess,
  listCvFiles,
  getFavourites,
  setFavourites,
  sortCvFiles,
  matchesCompany,
  cvFileKey,
  isFolderSupported,
  QUIVER_SUBFOLDER,
  type CvFile,
} from "../app/services/cvFolder";
import {
  loadFormProfile,
  saveFormProfile,
  proposeValue,
  classifyLabels,
  addAlias,
  upsertAnswer,
  draftAnswer,
  extractFieldValues,
  hasAnyValue,
  learnCandidates,
  applyLearned,
  REGIONS,
  type FormProfile,
  type LearnCandidate,
  type ProposalSource,
  type TypedEntry,
} from "../app/services/formProfile";
import { getActiveProfileId, getProfile, getSessions } from "../app/db";
import type { AnalysisSessionRecord } from "../app/db/schema";

// Company career sites embed these ATSes in cross-origin iframes; asking for
// them alongside the current site keeps it to one prompt, inside the click.
const ATS_ORIGINS = ["*://*.ashbyhq.com/*", "*://*.greenhouse.io/*"];

/** Must be the FIRST await in a click handler, or Chrome drops the user gesture. */
async function ensurePageAccess(url: string): Promise<boolean> {
  try {
    const host = new URL(url).hostname;
    return await chrome.permissions.request({ origins: [...siteToOriginPatterns(host), ...ATS_ORIGINS] });
  } catch {
    return false;
  }
}

async function runInAllFrames<A extends unknown[], R>(tabId: number, func: (...args: A) => R, args: A) {
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args } as any);
  return (results as Array<{ frameId: number; result?: Awaited<R> }>).filter((r) => r.result != null);
}

async function runInFrame<A extends unknown[], R>(tabId: number, frameId: number, func: (...args: A) => R, args: A) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func, args } as any);
  return (res as { result?: Awaited<R> } | undefined)?.result;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
};
const mimeOf = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** Ashby / Greenhouse put the company slug first in the path — better than nothing when there's no quick score. */
export function companyFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/(^|\.)ashbyhq\.com$|(^|\.)greenhouse\.io$/.test(u.hostname)) return u.pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {}
  return "";
}

type Scans = Array<{ frameId: number; result?: ReturnType<typeof scanFormFields> }>;
type UploadTarget = ScannedFileInput & { frameId: number };

/** The resume upload: a labelled resume/CV input, else the first that isn't for a cover letter. */
function pickUploadTarget(scans: Scans): UploadTarget | undefined {
  const inputs = scans.flatMap((s) => s.result!.fileInputs.map((fi) => ({ ...fi, frameId: s.frameId })));
  const notCover = inputs.filter((i) => !/cover/i.test(i.label));
  return notCover.find((i) => /resume|r[ée]sum[ée]|\bcv\b|curriculum/i.test(i.label)) ?? notCover[0] ?? inputs[0];
}

async function attachCv(tabId: number, target: UploadTarget, f: CvFile): Promise<boolean> {
  const bytes = new Uint8Array(await (await f.handle.getFile()).arrayBuffer());
  return (await runInFrame(tabId, target.frameId, attachFileToInput, [target.id, toBase64(bytes), f.name, mimeOf(f.name)])) === true;
}

/** A favourite or a CV named after the company, never just the newest file. Never prompts. */
async function recommendedCv(company: string): Promise<CvFile | null> {
  const h = await getFolderHandle();
  if (!h || !(await hasFolderAccess(h))) return null;
  const favourites = await getFavourites();
  const best = sortCvFiles(await listCvFiles(h), favourites, company)[0];
  return best && (favourites.includes(cvFileKey(best)) || matchesCompany(best.name, company)) ? best : null;
}

// ── CVs ──────────────────────────────────────────────────────────────────

export function CvSection({ tabId, currentUrl, company }: { tabId: number | null; currentUrl: string; company: string }) {
  const [handle, setHandle] = useState<Awaited<ReturnType<typeof getFolderHandle>>>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [files, setFiles] = useState<CvFile[]>([]);
  const [favourites, setFavs] = useState<string[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Drag experiment: a file is only draggable once its blob is ready, because
  // dragstart can't await.
  const dragFiles = useRef<Record<string, { file: File; url: string }>>({});

  const refresh = useCallback(async (h: NonNullable<typeof handle>) => {
    setFiles(await listCvFiles(h));
    setFavs(await getFavourites());
  }, []);

  useEffect(() => {
    void (async () => {
      const h = await getFolderHandle();
      setHandle(h);
      if (!h) return;
      if (await hasFolderAccess(h)) await refresh(h);
      else setNeedsReconnect(true);
    })().catch((err) => setStatus({ ok: false, text: String(err?.message ?? err) }));
  }, [refresh]);

  const link = async () => {
    try {
      const h = await pickFolder();
      setHandle(h);
      setNeedsReconnect(false);
      await refresh(h);
    } catch (err: any) {
      if (err?.name !== "AbortError") setStatus({ ok: false, text: String(err?.message ?? err) });
    }
  };

  const reconnect = async () => {
    if (!handle) return;
    if (await ensureFolderAccess(handle)) {
      setNeedsReconnect(false);
      await refresh(handle);
    }
  };

  const toggleFav = async (f: CvFile) => {
    const key = cvFileKey(f);
    const next = favourites.includes(key) ? favourites.filter((k) => k !== key) : [...favourites, key];
    setFavs(next);
    await setFavourites(next);
  };

  const attach = async (f: CvFile) => {
    if (!tabId) return;
    setStatus(null);
    if (!(await ensurePageAccess(currentUrl))) {
      setStatus({ ok: false, text: t("sidepanel.permissionDenied") });
      return;
    }
    setBusy(cvFileKey(f));
    try {
      const target = pickUploadTarget(await runInAllFrames(tabId, scanFormFields, []));
      if (!target) {
        setStatus({ ok: false, text: t("sidepanel.cv.noUploadField") });
        return;
      }
      const ok = await attachCv(tabId, target, f);
      setStatus(
        ok
          ? { ok: true, text: t("sidepanel.cv.attached", { field: target.label || t("sidepanel.cv.uploadField") }) }
          : { ok: false, text: t("sidepanel.cv.noUploadField") }
      );
    } catch (err: any) {
      setStatus({ ok: false, text: String(err?.message ?? err) });
    } finally {
      setBusy(null);
    }
  };

  const prepareDrag = async (f: CvFile) => {
    const key = cvFileKey(f);
    if (dragFiles.current[key]) return;
    const file = await f.handle.getFile();
    const typed = new File([file], f.name, { type: mimeOf(f.name) });
    dragFiles.current[key] = { file: typed, url: URL.createObjectURL(typed) };
  };

  if (!isFolderSupported()) return null;

  const sorted = sortCvFiles(files, favourites, company);

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>{t("sidepanel.cv.title")}</div>
      {!handle ? (
        <>
          <div style={hintStyle}>{t("sidepanel.cv.linkHint")}</div>
          <button onClick={link} style={{ ...secBtnStyle, width: "100%", marginTop: 8 }}>{t("sidepanel.cv.link")}</button>
        </>
      ) : needsReconnect ? (
        <button onClick={reconnect} style={{ ...secBtnStyle, width: "100%" }}>{t("sidepanel.cv.reconnect", { folder: handle.name })}</button>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <span style={{ ...hintStyle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📁 {handle.name}</span>
            <button onClick={() => refresh(handle)} style={miniBtnStyle}>{t("sidepanel.cv.refresh")}</button>
            <button onClick={link} style={miniBtnStyle}>{t("sidepanel.cv.change")}</button>
          </div>
          {sorted.length === 0 && <div style={hintStyle}>{t("sidepanel.cv.empty")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sorted.map((f) => {
              const key = cvFileKey(f);
              const fav = favourites.includes(key);
              return (
                <div
                  key={key}
                  draggable
                  onPointerEnter={() => void prepareDrag(f)}
                  onDragStart={(e) => {
                    const ready = dragFiles.current[key];
                    if (!ready) return e.preventDefault();
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.items.add(ready.file);
                    e.dataTransfer.setData("DownloadURL", `${ready.file.type}:${f.name}:${ready.url}`);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)", cursor: "grab" }}
                >
                  <button onClick={() => toggleFav(f)} title={t("sidepanel.cv.favourite")} style={{ ...iconBtnStyle, color: fav ? "#facc15" : "#475569" }}>★</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {f.folder === QUIVER_SUBFOLDER && <span style={tagStyle("#8b5cf6")}>{t("sidepanel.cv.generated")}</span>}
                      {matchesCompany(f.name, company) && <span style={tagStyle("#22c55e")}>{t("sidepanel.cv.forThisJob")}</span>}
                    </div>
                  </div>
                  <button onClick={() => attach(f)} disabled={!tabId || busy !== null} style={miniBtnStyle}>
                    {busy === key ? "…" : t("sidepanel.cv.attach")}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ ...hintStyle, marginTop: 8 }}>{t("sidepanel.cv.generatedHint", { folder: `${handle.name}/${QUIVER_SUBFOLDER}` })}</div>
        </>
      )}
      {status && <div style={{ marginTop: 6, fontSize: 11, color: status.ok ? "#4ade80" : "#ef4444" }}>{status.text}</div>}
    </div>
  );
}

// ── Apply ────────────────────────────────────────────────────────────────

interface Row {
  frameId: number;
  field: ScannedField;
  key?: string;
  value: string;
  /** What Quiver proposed; learning skips values the user left unchanged. */
  proposed: string;
  source: ProposalSource;
  checked: boolean;
  /** Key chosen by the user or a model — becomes an alias once filled. */
  learnAlias?: boolean;
  drafting?: boolean;
  hint?: string;
  busy?: boolean;
}

const BADGE: Record<ProposalSource, { color: string; key: string }> = {
  profile: { color: "#3b82f6", key: "sidepanel.apply.srcProfile" },
  answer: { color: "#22c55e", key: "sidepanel.apply.srcAnswer" },
  model: { color: "#8b5cf6", key: "sidepanel.apply.srcModel" },
  eeo: { color: "#64748b", key: "sidepanel.apply.srcEeo" },
  none: { color: "#475569", key: "sidepanel.apply.srcNone" },
};

const REGION_STORE = "artemis:applyRegion";

export function ApplySection({ tabId, currentUrl, company }: { tabId: number | null; currentUrl: string; company: string }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fp, setFp] = useState<FormProfile | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [region, setRegion] = useState("");
  const [sessions, setSessions] = useState<AnalysisSessionRecord[]>([]);
  const [contextId, setContextId] = useState<string>("page");
  const [state, setState] = useState<"idle" | "scanning" | "filling">("idle");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [seedOffer, setSeedOffer] = useState(false);
  const [seed, setSeed] = useState<Record<string, string> | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [learn, setLearn] = useState<LearnCandidate[] | null>(null);
  // Read from the submit-message listener, outside React's render cycle.
  const rowsRef = useRef<Row[] | null>(null);
  rowsRef.current = rows;
  const fpRef = useRef<FormProfile | null>(null);
  fpRef.current = fp;

  useEffect(() => {
    try {
      setRegion(localStorage.getItem(REGION_STORE) ?? "");
    } catch {}
  }, []);

  // A new page means a new form.
  useEffect(() => {
    setRows(null);
    setMessage(null);
  }, [currentUrl]);

  const loadProfile = useCallback(async () => {
    const id = await getActiveProfileId();
    if (!id) throw new Error(t("sidepanel.noProfile"));
    const [form, sess] = await Promise.all([loadFormProfile(id), getSessions(id)]);
    setProfileId(id);
    setFp(form);
    const recent = [...sess].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    setSessions(recent);
    // Usual flow is analyze → build CV → apply, so the latest analysis is the best default.
    setContextId((prev) => (prev === "page" && recent[0] ? recent[0].id : prev));
    return { id, form };
  }, []);

  // Callers that just loaded the profile pass its id: state set in the same tick isn't visible yet.
  const persist = async (next: FormProfile, id = profileId) => {
    setFp(next);
    if (id) await saveFormProfile(id, next);
  };

  /** Proposals for every scanned text field, plus model-picked keys for short unmatched labels. */
  const buildRows = async (scans: Scans, form: FormProfile, id: string): Promise<Row[]> => {
    const next: Row[] = scans.flatMap((s) =>
      s.result!.fields.map((field: ScannedField) => {
        const p = proposeValue(field, form, region || null);
        const hasValue = p.value.trim().length > 0;
        return {
          frameId: s.frameId,
          field,
          key: p.key,
          value: field.value || p.value,
          proposed: p.value,
          source: p.source,
          checked: hasValue && !field.value && p.source !== "eeo",
        };
      })
    );
    // Short unmatched fields: let a model pick the key (labels only, no values sent).
    const unmatched = next.filter((r) => r.source === "none" && r.field.kind === "text" && r.field.label);
    if (unmatched.length > 0) {
      try {
        const profile = await getProfile(id);
        const keys = Object.keys(form.fields);
        const { matches } = await classifyLabels(unmatched.map((r) => r.field.label), keys, profile?.settings ?? null);
        unmatched.forEach((r, i) => {
          const key = matches[i];
          const value = key ? form.fields[key]?.value ?? "" : "";
          if (!key || !value) return;
          Object.assign(r, { key, value: r.field.value || value, proposed: value, source: "model", learnAlias: true, checked: !r.field.value });
        });
      } catch {
        // Identification is a nicety — rows stay unmatched and can be mapped by hand.
      }
    }
    return next;
  };

  /** Scans every frame and starts watching it, so answers typed afterwards can be learned on submit. */
  const scanPage = async (id: number): Promise<Scans> => {
    const scans = await runInAllFrames(id, scanFormFields, []);
    void runInAllFrames(id, watchFormAnswers, []).catch(() => {});
    return scans;
  };

  const scan = async () => {
    if (!tabId) return;
    setMessage(null);
    if (!(await ensurePageAccess(currentUrl))) {
      setMessage({ ok: false, text: t("sidepanel.permissionDenied") });
      return;
    }
    setState("scanning");
    try {
      const { id, form } = await loadProfile();
      setSeedOffer(!hasAnyValue(form));
      const next = await buildRows(await scanPage(tabId), form, id);
      setRows(next);
      if (next.length === 0) setMessage({ ok: false, text: t("sidepanel.apply.noFields") });
    } catch (err: any) {
      setMessage({ ok: false, text: String(err?.message ?? err) });
    } finally {
      setState("idle");
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  /** Writes rows into the page and learns aliases for model- or user-picked keys. Returns the count filled. */
  const writeRows = async (tab: number, targets: Row[], form: FormProfile, pid: string | null): Promise<number> => {
    let filled = 0;
    for (const frameId of new Set(targets.map((r) => r.frameId))) {
      const values = targets.filter((r) => r.frameId === frameId).map((r) => ({ id: r.field.id, value: r.value }));
      filled += (await runInFrame(tab, frameId, fillFormFields, [values]))?.length ?? 0;
    }
    let next = form;
    for (const r of targets) if (r.learnAlias && r.key) next = addAlias(next, r.key, r.field.label);
    if (next !== form) await persist(next, pid);
    return filled;
  };

  const markFilled = (rs: Row[], targets: Row[]) =>
    rs.map((r) => (targets.includes(r) ? { ...r, checked: false, learnAlias: false, field: { ...r.field, value: r.value } } : r));

  /**
   * One click: scan, fill every field with a known value, attach the recommended CV.
   * `seeded` is a form profile the user just confirmed. It's saved after the permission
   * prompt, which must be the first await to keep the click's user gesture.
   */
  const fillAll = async (seeded?: FormProfile) => {
    if (!tabId) return;
    setMessage(null);
    if (!(await ensurePageAccess(currentUrl))) {
      setMessage({ ok: false, text: t("sidepanel.permissionDenied") });
      return;
    }
    setState("filling");
    try {
      const loaded = await loadProfile();
      const form = seeded ?? loaded.form;
      if (seeded) await persist(seeded, loaded.id);
      setSeedOffer(!hasAnyValue(form));
      const scans = await scanPage(tabId);
      const next = await buildRows(scans, form, loaded.id);
      const targets = next.filter((r) => r.checked && r.value);
      const filled = await writeRows(tabId, targets, form, loaded.id);
      const parts = [t("sidepanel.apply.filled", { count: filled })];

      const upload = pickUploadTarget(scans);
      if (upload && !upload.hasFile) {
        const cv = await recommendedCv(company);
        if (!cv) parts.push(t("sidepanel.apply.cvPick"));
        else parts.push(t((await attachCv(tabId, upload, cv)) ? "sidepanel.apply.cvAttached" : "sidepanel.apply.cvFailed", { name: cv.name }));
      }
      const left = next.filter((r) => !r.value && !r.field.value && r.source !== "eeo").length;
      if (left > 0) parts.push(t("sidepanel.apply.leftForYou", { count: left }));
      setRows(markFilled(next, targets));
      setSeed(null);
      setMessage({ ok: true, text: parts.join(" ") });
    } catch (err: any) {
      setMessage({ ok: false, text: String(err?.message ?? err) });
    } finally {
      setState("idle");
    }
  };

  const seedFromProfile = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const { id, form } = await loadProfile();
      const profile = await getProfile(id);
      if (!profile?.settings) throw new Error(t("sidepanel.noProfile"));
      const empty = Object.keys(form.fields).filter((k) => !form.fields[k]!.value);
      const found = await extractFieldValues(profile.profileMarkdown, empty, profile.settings);
      const values = Object.fromEntries(Object.entries(found).filter(([k, v]) => v && form.fields[k]));
      if (Object.keys(values).length === 0) setMessage({ ok: false, text: t("sidepanel.apply.seedNone") });
      else setSeed(values);
    } catch (err: any) {
      setMessage({ ok: false, text: String(err?.message ?? err) });
    } finally {
      setSeeding(false);
    }
  };

  const saveSeedAndFill = () => {
    const form = fpRef.current;
    if (!form || !seed) return;
    const fields = { ...form.fields };
    for (const [k, v] of Object.entries(seed)) fields[k] = { ...fields[k]!, value: v.trim() };
    void fillAll({ ...form, fields });
  };

  // ── Learning: what the user typed becomes an answer for next time ──
  const offerLearning = useCallback(
    (values: Array<{ frameId: number; id: string; value: string }>): number => {
      const form = fpRef.current;
      const rs = rowsRef.current;
      if (!form || !rs) return 0;
      const entries: TypedEntry[] = [];
      for (const v of values) {
        const r = rs.find((x) => x.frameId === v.frameId && x.field.id === v.id);
        if (r) entries.push({ label: r.field.label, value: v.value, kind: r.field.kind, key: r.key, proposed: r.proposed });
      }
      const found = learnCandidates(entries, form, region || null);
      if (found.length > 0) setLearn((prev) => [...(prev ?? []).filter((p) => !found.some((f) => f.label === p.label)), ...found]);
      return found.length;
    },
    [region]
  );

  useEffect(() => {
    if (tabId == null) return;
    const handler = (msg: { type?: string; values?: Record<string, string> }, sender: chrome.runtime.MessageSender) => {
      if (msg?.type !== FORM_ANSWERS_MSG || sender.tab?.id !== tabId || !msg.values) return;
      const frameId = sender.frameId ?? 0;
      offerLearning(Object.entries(msg.values).map(([id, value]) => ({ frameId, id, value })));
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [tabId, offerLearning]);

  /** Reads what's in the form now, for forms whose submit wasn't caught. */
  const learnNow = async () => {
    if (!tabId) return;
    setMessage(null);
    try {
      const scans = await runInAllFrames(tabId, scanFormFields, []);
      const n = offerLearning(scans.flatMap((s) => s.result!.fields.map((f) => ({ frameId: s.frameId, id: f.id, value: f.value }))));
      if (n === 0) setMessage({ ok: true, text: t("sidepanel.apply.learnNothing") });
    } catch (err: any) {
      setMessage({ ok: false, text: String(err?.message ?? err) });
    }
  };

  const saveLearned = async () => {
    if (!learn) return;
    const pid = profileId ?? (await getActiveProfileId());
    if (!pid) return;
    const form = fpRef.current ?? (await loadFormProfile(pid));
    const picked = learn.filter((c) => c.checked);
    await persist(applyLearned(form, picked, region || null), pid);
    setLearn(null);
    setMessage({ ok: true, text: t("sidepanel.apply.learnSaved", { count: picked.length }) });
  };

  const fillRows = async (targets: Row[]) => {
    if (!tabId || !fp) return;
    setState("filling");
    setMessage(null);
    try {
      const filled = await writeRows(tabId, targets, fp, profileId);
      setRows((rs) => rs && markFilled(rs, targets));
      setMessage({ ok: true, text: t("sidepanel.apply.filled", { count: filled }) });
    } catch (err: any) {
      setMessage({ ok: false, text: String(err?.message ?? err) });
    } finally {
      setState("idle");
    }
  };

  const mapToKey = (i: number, key: string) => {
    if (!fp || !rows) return;
    if (!key) return update(i, { key: undefined, source: "none", learnAlias: false });
    const value = fp.fields[key]?.value ?? "";
    update(i, { key, value, source: "profile", learnAlias: true, checked: value.length > 0 });
  };

  const saveAnswer = async (r: Row) => {
    if (!fp || !r.value.trim()) return;
    await persist(upsertAnswer(fp, r.field.label, r.value.trim(), region || "always"));
    setMessage({ ok: true, text: t("sidepanel.apply.answerSaved", { scope: region || t("sidepanel.apply.regionAny") }) });
  };

  const generate = async (i: number) => {
    const r = rows?.[i];
    if (!r || !tabId || !fp) return;
    update(i, { busy: true });
    setMessage(null);
    try {
      const profile = await getProfile((await getActiveProfileId())!);
      if (!profile) throw new Error(t("sidepanel.noProfile"));
      let jobText = sessions.find((s) => s.id === contextId)?.jobPosting ?? "";
      if (!jobText) {
        const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageContent });
        jobText = (res?.result as { text?: string } | undefined)?.text ?? "";
      }
      const text = await draftAnswer(
        { question: r.field.label, maxLength: r.field.maxLength, profileMarkdown: profile.profileMarkdown, rules: fp.rules, jobText, hint: r.hint },
        profile.settings
      );
      update(i, { value: text, source: "model", checked: true, busy: false });
    } catch (err: any) {
      update(i, { busy: false });
      setMessage({ ok: false, text: String(err?.message ?? err) });
    }
  };

  const setRegionStored = (v: string) => {
    setRegion(v);
    try {
      localStorage.setItem(REGION_STORE, v);
    } catch {}
  };

  const checkedRows = rows?.filter((r) => r.checked && r.value) ?? [];
  const keys = fp ? Object.keys(fp.fields) : [];

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>{t("sidepanel.apply.title")}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <label style={{ ...hintStyle, display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {t("sidepanel.apply.region")}
          <select value={region} onChange={(e) => setRegionStored(e.target.value)} style={selectStyle}>
            <option value="">{t("sidepanel.apply.regionAny")}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => fillAll()} disabled={!tabId || state !== "idle"} style={{ ...primaryBtnStyle, flex: 1 }}>
          {state === "filling" ? t("sidepanel.apply.filling") : t("sidepanel.apply.fillForm")}
        </button>
        <button onClick={scan} disabled={!tabId || state !== "idle"} style={secBtnStyle}>
          {state === "scanning" ? t("sidepanel.apply.scanning") : rows ? t("sidepanel.apply.rescan") : t("sidepanel.apply.reviewFill")}
        </button>
      </div>

      {seedOffer && !seed && (
        <div style={{ ...noticeStyle, marginTop: 8 }}>
          <div style={hintStyle}>{t("sidepanel.apply.seedOffer")}</div>
          <button onClick={seedFromProfile} disabled={seeding} style={{ ...miniBtnStyle, marginTop: 6 }}>
            {seeding ? "…" : t("sidepanel.apply.seedButton")}
          </button>
        </div>
      )}
      {seed && (
        <div style={{ ...noticeStyle, marginTop: 8 }}>
          <div style={hintStyle}>{t("sidepanel.apply.seedReview")}</div>
          {Object.entries(seed).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <span style={{ ...hintStyle, width: 110, flexShrink: 0 }}>{k}</span>
              <input value={v} onChange={(e) => setSeed({ ...seed, [k]: e.target.value })} style={{ ...inputStyle, marginTop: 0 }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={saveSeedAndFill} disabled={state !== "idle"} style={miniBtnStyle}>{t("sidepanel.apply.seedSave")}</button>
            <button onClick={() => setSeed(null)} style={miniBtnStyle}>{t("sidepanel.apply.cancel")}</button>
          </div>
        </div>
      )}

      {learn && learn.length > 0 && (
        <div style={{ ...noticeStyle, marginTop: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>{t("sidepanel.apply.learnTitle")}</div>
          {learn.map((c, i) => (
            <label key={c.label} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 4, fontSize: 11 }}>
              <input
                type="checkbox"
                checked={c.checked}
                onChange={(e) => setLearn(learn.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "#e2e8f0" }}>{c.label}</span>
                <span style={{ color: "#94a3b8" }}> → {c.value.length > 80 ? c.value.slice(0, 80) + "…" : c.value}</span>
              </span>
              <span style={tagStyle(c.key ? "#3b82f6" : "#22c55e")}>{c.key ?? t("sidepanel.apply.srcAnswer")}</span>
            </label>
          ))}
          <div style={{ ...hintStyle, marginTop: 4 }}>{t("sidepanel.apply.learnScope", { scope: region || t("sidepanel.apply.regionAny") })}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={saveLearned} disabled={!learn.some((c) => c.checked)} style={miniBtnStyle}>
              {t("sidepanel.apply.learnSave", { count: learn.filter((c) => c.checked).length })}
            </button>
            <button onClick={() => setLearn(null)} style={miniBtnStyle}>{t("sidepanel.apply.cancel")}</button>
          </div>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <label style={{ ...hintStyle, display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
            {t("sidepanel.apply.context")}
            <select value={contextId} onChange={(e) => setContextId(e.target.value)} style={{ ...selectStyle, flex: 1, minWidth: 0 }}>
              <option value="page">{t("sidepanel.apply.contextPage")}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.result.title || t("sidepanel.untitledJob")) + " · " + s.createdAt.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {rows.map((r, i) => {
              const badge = BADGE[r.source];
              const long = r.field.kind === "textarea";
              return (
                <div key={`${r.frameId}:${r.field.id}`} style={{ padding: 8, borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={r.checked}
                      disabled={r.source === "eeo" || !r.value}
                      onChange={(e) => update(i, { checked: e.target.checked })}
                    />
                    <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.field.label}>
                      {r.field.label || r.field.name || "—"}
                      {r.field.required ? " *" : ""}
                    </span>
                    <span style={tagStyle(badge.color)}>{t(badge.key)}</span>
                  </div>
                  {r.source !== "eeo" && (
                    <>
                      {long ? (
                        <textarea
                          value={r.value}
                          onChange={(e) => update(i, { value: e.target.value, checked: e.target.value.length > 0 })}
                          rows={r.value ? 5 : 2}
                          maxLength={r.field.maxLength ?? undefined}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      ) : (
                        <input
                          value={r.value}
                          onChange={(e) => update(i, { value: e.target.value, checked: e.target.value.length > 0 })}
                          maxLength={r.field.maxLength ?? undefined}
                          style={inputStyle}
                        />
                      )}
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {(r.source === "none" || r.learnAlias) && !long && (
                          <select value={r.key ?? ""} onChange={(e) => mapToKey(i, e.target.value)} style={{ ...selectStyle, flex: 1, minWidth: 0 }} title={t("sidepanel.apply.mapHint")}>
                            <option value="">{t("sidepanel.apply.mapTo")}</option>
                            {keys.map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        )}
                        {r.source !== "profile" && (
                          <button onClick={() => update(i, { drafting: !r.drafting })} style={miniBtnStyle}>{t("sidepanel.apply.draft")}</button>
                        )}
                        {r.source !== "profile" && r.value.trim() && (
                          <button onClick={() => saveAnswer(r)} style={miniBtnStyle}>{t("sidepanel.apply.saveAnswer")}</button>
                        )}
                        {r.value && (
                          <button onClick={() => fillRows([r])} disabled={state !== "idle"} style={miniBtnStyle}>{t("sidepanel.apply.insert")}</button>
                        )}
                      </div>
                      {r.drafting && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <input
                            value={r.hint ?? ""}
                            onChange={(e) => update(i, { hint: e.target.value })}
                            placeholder={t("sidepanel.apply.hintPlaceholder")}
                            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                          />
                          <button onClick={() => generate(i)} disabled={r.busy} style={miniBtnStyle}>
                            {r.busy ? "…" : t("sidepanel.apply.generate")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => fillRows(checkedRows)}
            disabled={checkedRows.length === 0 || state !== "idle"}
            style={{ ...primaryBtnStyle, width: "100%", marginTop: 10, opacity: checkedRows.length === 0 ? 0.5 : 1 }}
          >
            {state === "filling" ? "…" : t("sidepanel.apply.fillSelected", { count: checkedRows.length })}
          </button>
          <button onClick={learnNow} style={{ ...secBtnStyle, width: "100%", marginTop: 6 }}>{t("sidepanel.apply.learnNow")}</button>
          <div style={{ ...hintStyle, marginTop: 6 }}>{t("sidepanel.apply.reviewWarning")}</div>
        </>
      )}
      {message && <div style={{ marginTop: 6, fontSize: 11, color: message.ok ? "#4ade80" : "#ef4444" }}>{message.text}</div>}
    </div>
  );
}

// ── Styles (match sidepanel.tsx) ─────────────────────────────────────────

const cardStyle: CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14 };
const sectionTitle: CSSProperties = { fontSize: 11, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" };
const hintStyle: CSSProperties = { fontSize: 11, color: "#64748b" };
const secBtnStyle: CSSProperties = {
  padding: "8px 10px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
  background: "#1e293b", color: "#e2e8f0", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const primaryBtnStyle: CSSProperties = {
  padding: "9px 12px", border: "none", borderRadius: 8, background: "#3b82f6",
  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const miniBtnStyle: CSSProperties = {
  padding: "3px 8px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5,
  background: "#1e293b", color: "#e2e8f0", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
};
const noticeStyle: CSSProperties = { padding: 8, borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)" };
const iconBtnStyle: CSSProperties = { background: "transparent", border: "none", cursor: "pointer", fontSize: 14, padding: 0 };
const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 4, padding: "5px 7px", borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.12)", background: "#0f172a", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit",
};
const selectStyle: CSSProperties = {
  padding: "3px 5px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.12)",
  background: "#0f172a", color: "#e2e8f0", fontSize: 11,
};
const tagStyle = (color: string): CSSProperties => ({
  fontSize: 10, padding: "1px 6px", borderRadius: 999, color, border: `1px solid ${color}55`, whiteSpace: "nowrap",
});
