import { useTranslation } from "react-i18next";
import { Card } from "../ui/card";

interface ThemeConfig {
  primaryColor: string;
  templateId?: string;
}

interface ThemeConfigPanelProps {
  config: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
}

const THEMES: { id: string; labelKey: string }[] = [
  { id: "modern", labelKey: "builder.modern" },
  { id: "classic", labelKey: "builder.classic" },
  { id: "minimal", labelKey: "builder.minimal" },
];

export function ThemeConfigPanel({ config, onChange }: ThemeConfigPanelProps) {
  const { t } = useTranslation();
  return (
    <Card className="p-3 mt-3 bg-muted/50 border-dashed">
      <div className="text-sm font-medium mb-2">{t("builder.themeConfig")}</div>
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.theme")}</label>
          <select
            value={config.templateId || "modern"}
            onChange={(e) => onChange({ ...config, templateId: e.target.value as any })}
            className="text-sm border rounded px-2 py-1 bg-background text-foreground"
          >
            {THEMES.map((th) => (
              <option key={th.id} value={th.id}>{t(th.labelKey)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.primaryColor")}</label>
          <input
            type="color"
            value={config.primaryColor}
            onChange={(e) => onChange({ ...config, primaryColor: e.target.value })}
            className="w-8 h-8 border rounded cursor-pointer p-0"
          />
        </div>
      </div>
    </Card>
  );
}
