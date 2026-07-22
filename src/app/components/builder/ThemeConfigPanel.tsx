import { useTranslation } from "react-i18next";
import { Card } from "../ui/card";

export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
}

interface ThemeConfigPanelProps {
  config: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
}

const FONT_OPTIONS = [
  { value: "'Inter', -apple-system, sans-serif", label: "Inter (Sans)" },
  { value: "'Georgia', 'Times New Roman', serif", label: "Georgia (Serif)" },
  { value: "'Playfair Display', Georgia, serif", label: "Playfair Display" },
  { value: "'Roboto', -apple-system, sans-serif", label: "Roboto (Sans)" },
  { value: "'Open Sans', -apple-system, sans-serif", label: "Open Sans" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman (Serif)" },
  { value: "'Courier New', monospace", label: "Courier New (Mono)" },
];

export function ThemeConfigPanel({ config, onChange }: ThemeConfigPanelProps) {
  const { t } = useTranslation();
  return (
    <Card className="p-3 mt-3 bg-muted/50 border-dashed">
      <div className="text-sm font-medium mb-2">{t("builder.themeConfig")}</div>
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.primaryColor")}</label>
          <input
            type="color"
            value={config.primaryColor}
            onChange={(e) => onChange({ ...config, primaryColor: e.target.value })}
            className="w-8 h-8 border rounded cursor-pointer p-0"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.accentColor")}</label>
          <input
            type="color"
            value={config.accentColor}
            onChange={(e) => onChange({ ...config, accentColor: e.target.value })}
            className="w-8 h-8 border rounded cursor-pointer p-0"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.textColor")}</label>
          <input
            type="color"
            value={config.textColor}
            onChange={(e) => onChange({ ...config, textColor: e.target.value })}
            className="w-8 h-8 border rounded cursor-pointer p-0"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.headingFont")}</label>
          <select
            value={config.headingFont}
            onChange={(e) => onChange({ ...config, headingFont: e.target.value })}
            className="text-sm border rounded px-2 py-1 bg-background text-foreground max-w-[180px]"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("builder.bodyFont")}</label>
          <select
            value={config.bodyFont}
            onChange={(e) => onChange({ ...config, bodyFont: e.target.value })}
            className="text-sm border rounded px-2 py-1 bg-background text-foreground max-w-[180px]"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}