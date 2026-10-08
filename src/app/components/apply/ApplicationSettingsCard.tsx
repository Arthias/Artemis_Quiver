// Settings → Applications: the form profile JSON (standard field answers,
// saved answers, rules) and the linked CV folder.
// The side panel reads and writes the same records (see services/formProfile.ts
// and services/cvFolder.ts).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ClipboardList, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useWorkspace } from "../../context/WorkspaceProfileContext";
import { useConfig } from "../../context/ConfigContext";
import {
  loadFormProfile,
  saveFormProfile,
  validateFormProfile,
  extractFieldValues,
} from "../../services/formProfile";
import {
  getFolderHandle,
  pickFolder,
  unlinkFolder,
  isFolderSupported,
  QUIVER_SUBFOLDER,
} from "../../services/cvFolder";

export function ApplicationSettingsCard() {
  const { t } = useTranslation();
  const { activeProfileId, profileData } = useWorkspace();
  const { config } = useConfig();
  const [text, setText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);

  useEffect(() => {
    void loadFormProfile(activeProfileId).then((fp) => setText(JSON.stringify(fp, null, 2)));
  }, [activeProfileId]);

  useEffect(() => {
    if (!isFolderSupported()) return;
    void getFolderHandle().then((h) => setFolderName(h?.name ?? null));
  }, []);

  const parse = () => {
    try {
      const fp = validateFormProfile(JSON.parse(text));
      setJsonError(null);
      return fp;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  const save = async () => {
    const fp = parse();
    if (!fp) return;
    await saveFormProfile(activeProfileId, fp);
    setText(JSON.stringify(fp, null, 2));
    toast.success(t("apply.saved"));
  };

  // Fills empty values from the profile markdown into the editor only — the
  // user reviews and presses Save.
  const seed = async () => {
    const fp = parse();
    if (!fp) return;
    setSeeding(true);
    try {
      const empty = Object.keys(fp.fields).filter((k) => !fp.fields[k]!.value);
      const found = await extractFieldValues(profileData.profileMarkdown, empty, config);
      let n = 0;
      for (const [k, v] of Object.entries(found)) {
        if (v && fp.fields[k]) {
          fp.fields[k] = { ...fp.fields[k]!, value: v };
          n++;
        }
      }
      setText(JSON.stringify(fp, null, 2));
      toast.success(t("apply.seeded", { count: n }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  };

  const link = async () => {
    try {
      const h = await pickFolder();
      setFolderName(h.name);
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error(String(err?.message ?? err));
    }
  };

  const unlink = async () => {
    await unlinkFolder();
    setFolderName(null);
  };

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">{t("apply.cvFolder")}</h2>
        </div>
        {!isFolderSupported() ? (
          <p className="text-sm text-muted-foreground">{t("apply.folderUnsupported")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("apply.cvFolderDesc", { sub: QUIVER_SUBFOLDER })}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono flex-1 truncate">{folderName ?? t("apply.noFolder")}</span>
              <Button variant="outline" size="sm" onClick={link}>
                {folderName ? t("apply.changeFolder") : t("apply.linkFolder")}
              </Button>
              {folderName && (
                <Button variant="ghost" size="sm" onClick={unlink}>
                  {t("apply.unlinkFolder")}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">{t("apply.formProfile")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("apply.formProfileDesc")}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs min-h-[360px] bg-input-background"
        />
        {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        <div className="flex gap-2">
          <Button onClick={save}>{t("apply.save")}</Button>
          <Button variant="outline" onClick={seed} disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t("apply.seed")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("apply.seedDesc")}</p>
      </Card>
    </>
  );
}
