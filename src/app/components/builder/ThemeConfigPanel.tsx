import { Card } from "../ui/card";

interface ThemeConfig {
  primaryColor: string;
  templateId?: string;
}

interface ThemeConfigPanelProps {
  config: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
}

const THEMES = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic (Serif)" },
  { id: "minimal", label: "Minimal" },
];

export function ThemeConfigPanel({ config, onChange }: ThemeConfigPanelProps) {
  return (
    <Card className="p-3 mt-3 bg-muted/50 border-dashed">
      <div className="text-sm font-medium mb-2">Theme Configuration</div>
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Theme</label>
          <select
            value={config.templateId || "modern"}
            onChange={(e) => onChange({ ...config, templateId: e.target.value as any })}
            className="text-sm border rounded px-2 py-1 bg-background text-foreground"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Primary Color</label>
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
