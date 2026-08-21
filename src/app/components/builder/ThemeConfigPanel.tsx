import { useTranslation } from "react-i18next";
import { Card } from "../ui/card";
import type { SectionType, TemplateId, ThemeConfig } from "../../../types/cv";
import { SECTION_VARIANTS_BY_TYPE } from "../../../types/cv";
import { TEMPLATE_PRESETS, applyTemplatePreset, resolveVariant } from "../../../components/cv/templates";

export type { ThemeConfig } from "../../../types/cv";

interface ThemeConfigPanelProps {
  config: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
  showTemplateSelector?: boolean;
  presentSections?: SectionType[];
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

const TEMPLATE_ORDER: TemplateId[] = ["classic", "modern", "executive", "minimal"];

export function ThemeConfigPanel({ config, onChange, showTemplateSelector = true, presentSections }: ThemeConfigPanelProps) {
  const { t } = useTranslation();

  const variantSections = (presentSections ?? []).filter(
    (type) => (SECTION_VARIANTS_BY_TYPE[type]?.length ?? 0) > 1
  );

  return (
    <Card className="p-3 mt-3 bg-muted/50 border-dashed">
      <div className="text-sm font-medium mb-2">{t("builder.themeConfig")}</div>
      <div className="flex flex-wrap items-start gap-4">
        {showTemplateSelector && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("builder.template")}</label>
            <div className="flex gap-1">
              {TEMPLATE_ORDER.map((id) => {
                const preset = TEMPLATE_PRESETS[id];
                return (
                  <button
                    key={id}
                    onClick={() => onChange(applyTemplatePreset(id))}
                    title={t(preset.descriptionKey)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      config.templateId === id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {t(preset.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

      {showTemplateSelector && variantSections.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-border">
          <div className="text-xs font-medium mb-2 text-muted-foreground">{t("builder.sectionStyles")}</div>
          <div className="flex flex-wrap gap-4">
            {variantSections.map((type) => {
              const variants = SECTION_VARIANTS_BY_TYPE[type];
              const active = resolveVariant(config, type);
              return (
                <div key={type}>
                  <label className="block text-xs text-muted-foreground mb-1">{t(`builder.sectionType.${type}`)}</label>
                  <div className="flex gap-1">
                    {variants.map((variantId) => (
                      <button
                        key={variantId}
                        onClick={() => onChange({ ...config, sectionVariants: { ...config.sectionVariants, [type]: variantId } })}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          active === variantId
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {t(`builder.variant.${variantId}`)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
