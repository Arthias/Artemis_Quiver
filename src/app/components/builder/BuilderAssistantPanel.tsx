import { useTranslation } from "react-i18next";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";

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
}

export function BuilderAssistantPanel({
  suggestions,
  chatMessage,
  chatLoading,
  onChatMessageChange,
  onSubmit,
  accentClass = "text-purple-500",
  panelBg = "bg-muted/30",
}: BuilderAssistantPanelProps) {
  const { t } = useTranslation();
  return (
    <div className={`w-96 flex flex-col ${panelBg} border-l border-border`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${accentClass}`} />
          <h3 className="font-semibold">{t("builder.aiAssistant")}</h3>
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
      </div>
    </div>
  );
}
