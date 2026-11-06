import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  User, Download, Save, FileText, Upload, Loader2, RefreshCw, SlidersHorizontal, Fingerprint, ClipboardList,
} from "lucide-react";
import { AppError } from "../utils/errors";
import { useProfile } from "../context/ProfileContext";
import { useConfig } from "../context/ConfigContext";
import { useWorkspace } from "../context/WorkspaceProfileContext";
import { PreferencesEditor } from "../components/profile/PreferencesEditor";
import { ApplicationSettingsCard } from "../components/apply/ApplicationSettingsCard";
import { emptyPreferences, FINGERPRINT_MAX, type Layer, type ProfilePreferences } from "../types/preferences";
import {
  generatePreferences, generateTitles, isStale, makeLayer, masterHash, preferencesHash, renderFingerprint,
} from "../services/profileLayers";

type Draft<T> = { value: T; origin: Layer<T>["origin"] };

export function Profile() {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = location.state as { edit?: boolean; isNewProfile?: boolean; tab?: string } | null;
  const { profile, setProfile, saveProfile, exportProfile, lastSavedAt, isDirty } = useProfile();
  const { config } = useConfig();
  const { activeProfileId, profileData, updateProfileData } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(navState?.tab ?? "master");
  const [showOnboarding, setShowOnboarding] = useState(!!navState?.isNewProfile);
  const [pageError, setPageError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unsaved edits of the two derived layers. null = showing what is stored.
  const [prefDraft, setPrefDraft] = useState<Draft<ProfilePreferences> | null>(null);
  const [prefEditorKey, setPrefEditorKey] = useState(0);
  const [fpDraft, setFpDraft] = useState<Draft<string> | null>(null);
  const [masterH, setMasterH] = useState<string | null>(null);
  const [prefsH, setPrefsH] = useState<string | null>(null);

  const storedPrefs = profileData.preferences;
  const storedFp = profileData.fingerprint;
  const prefsValue = prefDraft?.value ?? storedPrefs?.value ?? null;
  const fpValue = fpDraft?.value ?? storedFp?.value ?? "";

  useEffect(() => {
    if (navState?.edit) {
      setIsEditing(true);
      setActiveTab("master");
    }
  }, [navState?.edit]);

  useEffect(() => {
    setPrefDraft(null);
    setFpDraft(null);
    setPrefEditorKey((k) => k + 1);
  }, [activeProfileId]);

  useEffect(() => {
    let live = true;
    void masterHash(profileData.profileMarkdown).then((h) => live && setMasterH(h));
    return () => { live = false; };
  }, [profileData.profileMarkdown]);

  useEffect(() => {
    let live = true;
    if (storedPrefs) void preferencesHash(storedPrefs.value).then((h) => live && setPrefsH(h));
    else setPrefsH(null);
    return () => { live = false; };
  }, [storedPrefs]);

  const prefsStale = masterH != null && isStale(storedPrefs, masterH);
  const fpStale = prefsH != null && isStale(storedFp, prefsH);

  const handleSave = () => {
    saveProfile();
    setIsEditing(false);
  };

  // Import is a plain file read: the file's text goes straight into the editor.
  // Nothing is persisted until the user presses Save. A new master profile
  // makes the preferences stale; they are not regenerated on their own.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "md" && ext !== "txt") {
      setPageError(t("profile.onlyMdTxt"));
      return;
    }
    if (file.size > 500_000) {
      setPageError(t("profile.fileTooLarge"));
      return;
    }
    setPageError(null);
    try {
      setProfile(await file.text());
      setIsEditing(true);
      setActiveTab("master");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : t("profile.readFailed"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Generated values land as drafts for review; nothing is saved here. */
  async function generate(withFingerprint: boolean) {
    setPageError(null);
    if (isDirty) return setPageError(t("profile.saveMasterFirst"));
    if (!profileData.profileMarkdown.trim()) return setPageError(t("profile.generateNoMaster"));
    const manual = [
      storedPrefs?.origin === "manual" && t("profile.tabPreferences"),
      withFingerprint && storedFp?.origin === "manual" && t("profile.tabFingerprint"),
    ].filter(Boolean);
    if (manual.length && !window.confirm(t("profile.regenerateConfirm", { layers: manual.join(", ") }))) return;
    setGenerating(true);
    try {
      const prefs = await generatePreferences(profileData.profileMarkdown, config);
      setPrefDraft({ value: prefs, origin: "generated" });
      setPrefEditorKey((k) => k + 1);
      if (withFingerprint) setFpDraft({ value: renderFingerprint(prefs), origin: "generated" });
      setActiveTab("preferences");
      // Titles are later, separate calls; a failure there keeps the card.
      try {
        const res = await generateTitles(profileData.profileMarkdown, prefs, config);
        setPrefDraft({ value: { ...prefs, titles: res.titles, exclude_titles: res.exclude_titles }, origin: "generated" });
        setPrefEditorKey((k) => k + 1);
        if (res.failed.length) setPageError(t("profile.titlesTranslateFailed", { langs: res.failed.join(", ") }));
      } catch (err) {
        setPageError(t("profile.titlesFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
    } catch (err) {
      setPageError(err instanceof AppError ? err.userMessage : err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function savePreferences() {
    if (!prefDraft) return;
    updateProfileData({
      preferences: makeLayer(prefDraft.value, prefDraft.origin, await masterHash(profileData.profileMarkdown)),
    });
    setPrefDraft(null);
  }

  function renderFromPreferences() {
    if (!prefsValue) return setPageError(t("profile.fingerprintNoPreferences"));
    if (storedFp?.origin === "manual" && !fpDraft &&
        !window.confirm(t("profile.regenerateConfirm", { layers: t("profile.tabFingerprint") }))) return;
    setFpDraft({ value: renderFingerprint(prefsValue), origin: "generated" });
  }

  async function saveFingerprint() {
    if (!fpDraft) return;
    // Its source is the preferences it was rendered or edited against.
    const source = prefsValue ? await preferencesHash(prefsValue) : "";
    updateProfileData({ fingerprint: makeLayer(fpDraft.value.slice(0, FINGERPRINT_MAX), fpDraft.origin, source) });
    setFpDraft(null);
  }

  const staleBadge = <Badge variant="outline" className="ml-1 text-amber-600 border-amber-400">{t("profile.stale")}</Badge>;
  const originLine = (layer?: Layer<unknown>) =>
    layer && (
      <p className="text-xs text-muted-foreground">
        {t(layer.origin === "manual" ? "profile.originManual" : "profile.originGenerated", {
          date: new Date(layer.updatedAt).toLocaleString(),
        })}
      </p>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  {t("profile.importFile")}
                </Button>
                <Button variant="outline" className="gap-2" onClick={exportProfile}>
                  <Download className="w-4 h-4" />
                  {t("profile.exportProfile")}
                </Button>
                {(isEditing || isDirty) && (
                  <Button onClick={handleSave} className="gap-2">
                    <Save className="w-4 h-4" />
                    {t("profile.saveChanges")}
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => generate(true)} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t("profile.regenerate")}
              </Button>
            </div>
          </div>
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("profile.lastSaved")} {new Date(lastSavedAt).toLocaleString()}
              {isDirty ? ` · ${t("profile.unsavedChanges")}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {showOnboarding && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{t("profile.newProfile")}</strong> {t("profile.newProfileHint")}
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowOnboarding(false)}>
                {t("app.dismiss")}
              </Button>
            </Card>
          )}

          {pageError && (
            <Card className="p-3 mb-4 border-destructive/50 text-sm text-destructive">{pageError}</Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="master" className="gap-2">
                <FileText className="w-4 h-4" />
                {t("profile.tabMaster")}
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                {t("profile.tabPreferences")}
                {prefsStale && staleBadge}
              </TabsTrigger>
              <TabsTrigger value="fingerprint" className="gap-2">
                <Fingerprint className="w-4 h-4" />
                {t("profile.tabFingerprint")}
                {fpStale && staleBadge}
              </TabsTrigger>
              <TabsTrigger value="applications" className="gap-2">
                <ClipboardList className="w-4 h-4" />
                {t("profile.tabApplications")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="master" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t("profile.masterProfile")}</h2>
                    <p className="text-sm text-muted-foreground">{t("profile.editHint")}</p>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? t("profile.preview") : t("profile.edit")}
                  </Button>
                </div>

                {isEditing ? (
                  <Textarea
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    className="min-h-[600px] font-mono text-sm resize-none bg-input-background border-border"
                  />
                ) : profile.trim() ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-6 text-sm text-muted-foreground">
                    {t("profile.previewEmpty")}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t("profile.tabPreferences")}</h2>
                    <p className="text-sm text-muted-foreground">{t("profile.prefsDesc")}</p>
                    {!prefDraft && originLine(storedPrefs)}
                  </div>
                  {prefDraft && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => { setPrefDraft(null); setPrefEditorKey((k) => k + 1); }}>
                        {t("profile.discard")}
                      </Button>
                      <Button size="sm" className="gap-2" onClick={savePreferences}>
                        <Save className="w-4 h-4" />
                        {t("profile.saveChanges")}
                      </Button>
                    </div>
                  )}
                </div>

                {prefDraft?.origin === "generated" && (
                  <p className="text-sm rounded-md bg-blue-50 dark:bg-blue-950/20 p-3">{t("profile.reviewGenerated")}</p>
                )}
                {prefsStale && !prefDraft && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 p-3 text-sm">
                    <span>{t("profile.prefsStale")}</span>
                    <Button size="sm" variant="outline" onClick={() => generate(false)} disabled={generating}>
                      {t("profile.generatePrefs")}
                    </Button>
                  </div>
                )}

                {prefsValue ? (
                  <PreferencesEditor
                    key={prefEditorKey}
                    value={prefsValue}
                    onChange={(value) => setPrefDraft({ value, origin: "manual" })}
                  />
                ) : (
                  <div className="rounded-lg bg-muted/30 p-6 space-y-3 text-sm">
                    <p className="text-muted-foreground">{t("profile.prefsEmpty")}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-2" onClick={() => generate(false)} disabled={generating}>
                        {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t("profile.generatePrefs")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPrefDraft({ value: emptyPreferences(), origin: "manual" })}>
                        {t("profile.fillByHand")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="fingerprint" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t("profile.tabFingerprint")}</h2>
                    <p className="text-sm text-muted-foreground">{t("profile.fingerprintDesc")}</p>
                    {!fpDraft && originLine(storedFp)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="gap-2" onClick={renderFromPreferences} disabled={!prefsValue}>
                      <RefreshCw className="w-4 h-4" />
                      {t("profile.renderFingerprint")}
                    </Button>
                    {fpDraft && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setFpDraft(null)}>{t("profile.discard")}</Button>
                        <Button size="sm" className="gap-2" onClick={saveFingerprint}>
                          <Save className="w-4 h-4" />
                          {t("profile.saveChanges")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {fpStale && !fpDraft && (
                  <p className="rounded-md border border-amber-300 p-3 text-sm">{t("profile.fingerprintStale")}</p>
                )}
                <Textarea
                  value={fpValue}
                  maxLength={FINGERPRINT_MAX}
                  placeholder={t("profile.fingerprintPlaceholder")}
                  onChange={(e) => setFpDraft({ value: e.target.value, origin: "manual" })}
                  className="min-h-[96px] font-mono text-sm bg-input-background"
                />
                <p className="text-xs text-muted-foreground text-right">{fpValue.length} / {FINGERPRINT_MAX}</p>
              </Card>
            </TabsContent>

            <TabsContent value="applications" className="space-y-4">
              <ApplicationSettingsCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
