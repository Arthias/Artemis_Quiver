import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useWorkspace } from "../../context/WorkspaceProfileContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { MAX_WORKSPACE_PROFILES, profileInitials } from "../../utils/profileDefaults";

interface ProfileSwitcherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSwitcherModal({ open, onOpenChange }: ProfileSwitcherModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profiles, activeProfileId, switchProfile, createProfile, deleteProfile } = useWorkspace();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sorted = [...profiles].sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );

  const handleSwitch = async (id: string) => {
    try {
      await switchProfile(id);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to switch profile:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteProfile(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete profile:", err);
    }
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError(t("workspace.enterName"));
      return;
    }
    try {
      await createProfile(trimmed);
      setShowAddDialog(false);
      setNewName("");
      setAddError(null);
      onOpenChange(false);
      navigate("/profile", { state: { edit: true, isNewProfile: true } });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("workspace.couldNotCreate"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace.profiles")}</DialogTitle>
            <DialogDescription>
              {t("workspace.profileDesc", { max: MAX_WORKSPACE_PROFILES })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {sorted.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors ${
                  p.id === activeProfileId
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSwitch(p.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
                    {profileInitials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("workspace.used")} {formatRelativeTime(p.lastUsedAt)}
                    </p>
                  </div>
                  {p.id === activeProfileId && (
                    <span className="text-xs text-primary font-medium">{t("workspace.active")}</span>
                  )}
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(p.id)}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t("workspace.deleteProfile")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4" />
              {t("workspace.addProfile")}
            </Button>
            {profiles.length >= MAX_WORKSPACE_PROFILES && (
              <p className="text-xs text-muted-foreground text-center">
                {t("workspace.maxProfiles", { max: MAX_WORKSPACE_PROFILES })}
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("workspace.newProfile")}</DialogTitle>
            <DialogDescription>
              {t("workspace.newProfileDesc")}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
            placeholder={t("workspace.profilePlaceholder")}
            maxLength={40}
            className="bg-input-background"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("workspace.cancel")}
            </Button>
            <Button onClick={handleAdd} className="gap-2">
              <User className="w-4 h-4" />
              {t("workspace.createAndEdit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("workspace.deleteProfileTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.deleteProfileDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t("workspace.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              {t("workspace.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
