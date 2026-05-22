import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, User } from "lucide-react";
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
import { MAX_WORKSPACE_PROFILES, profileInitials } from "../../utils/workspaceStorage";

interface ProfileSwitcherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSwitcherModal({ open, onOpenChange }: ProfileSwitcherModalProps) {
  const navigate = useNavigate();
  const { profiles, activeProfileId, switchProfile, createProfile } = useWorkspace();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const sorted = [...profiles].sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );

  const handleSwitch = (id: string) => {
    switchProfile(id);
    onOpenChange(false);
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError("Enter a profile name.");
      return;
    }
    try {
      createProfile(trimmed);
      setShowAddDialog(false);
      setNewName("");
      setAddError(null);
      onOpenChange(false);
      navigate("/profile", { state: { edit: true, isNewProfile: true } });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not create profile.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Workspace profiles</DialogTitle>
            <DialogDescription>
              Switch between up to {MAX_WORKSPACE_PROFILES} local profiles. Each has its own
              settings, master profile, and analysis history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {sorted.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSwitch(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors text-left ${
                  p.id === activeProfileId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {profileInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Used {formatRelativeTime(p.lastUsedAt)}
                  </p>
                </div>
                {p.id === activeProfileId && (
                  <span className="text-xs text-primary font-medium">Active</span>
                )}
              </button>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              className="w-full gap-2"
              variant="outline"
              disabled={profiles.length >= MAX_WORKSPACE_PROFILES}
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4" />
              Add profile
            </Button>
            {profiles.length >= MAX_WORKSPACE_PROFILES && (
              <p className="text-xs text-muted-foreground text-center">
                Maximum {MAX_WORKSPACE_PROFILES} profiles. Adding one removes the least recently
                used.
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New profile</DialogTitle>
            <DialogDescription>
              Name your workspace profile. You will open the editor to import your data.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
            placeholder="e.g., Job search 2026"
            maxLength={40}
            className="bg-input-background"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} className="gap-2">
              <User className="w-4 h-4" />
              Create & edit profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
