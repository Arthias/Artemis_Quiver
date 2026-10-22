import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { usePersistentFlag } from "../../hooks/usePersistentFlag";

interface Suggestion {
  title: string;
  hint: string;
  prompt: string;
}

interface BuilderAssistantPanelProps {
  suggestions: Suggestion[];
  chatMessage: string;
  chatLoading: boolean;
  onChatMessageChange: (value: string) => void;
  onSubmit: (message?: string) => void;
  accentClass?: string;
  panelBg?: string;
  /** Rendered under the input, e.g. the result of the last request. */
  footer?: ReactNode;
}

export function BuilderAssistantPanel({
  suggestions,
  chatMessage,
  chatLoading,
  onChatMessageChange,
  onSubmit,
  accentClass = "text-purple-500",
  panelBg = "bg-muted/30",
  footer,
}: BuilderAssistantPanelProps) {
  const { t } = useTranslation();
  // One preference for every page that shows the assistant.
  const [collapsed, setCollapsed] = usePersistentFlag("artemis:assistantCollapsed");

  if (collapsed) {
    return (
      <div className={`h-full w-12 flex flex-col items-center gap-3 py-3 ${panelBg} border-l border-border`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(false)}
          aria-label={t("builder.expandAssistant")}
          title={t("builder.expandAssistant")}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={t("builder.aiAssistant")}
          title={t("builder.aiAssistant")}
          className="p-1 rounded hover:bg-accent/50"
        >
          <Sparkles className={`w-5 h-5 ${accentClass}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full w-96 flex flex-col ${panelBg} border-l border-border`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${accentClass}`} />
          <h3 className="font-semibold flex-1">{t("builder.aiAssistant")}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -my-1 -mr-2"
            onClick={() => setCollapsed(true)}
            aria-label={t("builder.collapseAssistant")}
            title={t("builder.collapseAssistant")}
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("builder.assistantDesc")}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {suggestions.map((s) => (
          <Card
            key={s.title}
            className="p-3 bg-card hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => onSubmit(s.prompt)}
          >
            <p className="text-sm font-medium">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <Textarea
          value={chatMessage}
          onChange={(e) => onChatMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={t("builder.chatPlaceholder")}
          className="resize-none bg-input-background border-border text-sm"
          rows={3}
          disabled={chatLoading}
        />
        <Button
          onClick={() => onSubmit()}
          disabled={!chatMessage.trim() || chatLoading}
          className="w-full mt-2"
          size="sm"
        >
          {chatLoading ? t("builder.applying") : t("builder.applyChanges")}
        </Button>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
