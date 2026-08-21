import type { CVSection, SectionType, TemplateId, ThemeConfig } from "../../types/cv";

export type Spacing = "compact" | "comfortable" | "spacious";

export interface TemplatePreset {
  id: TemplateId;
  labelKey: string;
  descriptionKey: string;
  spacing: Spacing;
  flatCard: boolean;
  defaultColors: { primaryColor: string; accentColor: string; textColor: string };
  defaultFonts: { headingFont: string; bodyFont: string };
  defaultVariants: Partial<Record<SectionType, string>>;
}

const INTER = "'Inter', -apple-system, sans-serif";
const GEORGIA = "'Georgia', 'Times New Roman', serif";

export const TEMPLATE_PRESETS: Record<TemplateId, TemplatePreset> = {
  classic: {
    id: "classic",
    labelKey: "builder.templateClassic",
    descriptionKey: "builder.templateClassicDesc",
    spacing: "comfortable",
    flatCard: false,
    defaultColors: { primaryColor: "#1e293b", accentColor: "#2563eb", textColor: "#475569" },
    defaultFonts: { headingFont: GEORGIA, bodyFont: INTER },
    defaultVariants: {
      summary: "paragraph", contact: "stacked", skills: "tags",
      experience: "classic", education: "classic", certifications: "list",
    },
  },
  modern: {
    id: "modern",
    labelKey: "builder.templateModern",
    descriptionKey: "builder.templateModernDesc",
    spacing: "comfortable",
    flatCard: false,
    defaultColors: { primaryColor: "#0f172a", accentColor: "#4f46e5", textColor: "#334155" },
    defaultFonts: { headingFont: INTER, bodyFont: INTER },
    defaultVariants: {
      summary: "paragraph", contact: "stacked", skills: "tags",
      experience: "cards", education: "classic", certifications: "list",
    },
  },
  executive: {
    id: "executive",
    labelKey: "builder.templateExecutive",
    descriptionKey: "builder.templateExecutiveDesc",
    spacing: "compact",
    flatCard: false,
    defaultColors: { primaryColor: "#0f172a", accentColor: "#4338ca", textColor: "#475569" },
    defaultFonts: { headingFont: INTER, bodyFont: INTER },
    defaultVariants: {
      summary: "paragraph", contact: "badges", skills: "columns",
      experience: "cards", education: "cards", certifications: "list",
    },
  },
  minimal: {
    id: "minimal",
    labelKey: "builder.templateMinimal",
    descriptionKey: "builder.templateMinimalDesc",
    spacing: "spacious",
    flatCard: true,
    defaultColors: { primaryColor: "#111827", accentColor: "#111827", textColor: "#374151" },
    defaultFonts: { headingFont: INTER, bodyFont: INTER },
    defaultVariants: {
      summary: "paragraph", contact: "stacked", skills: "inline",
      experience: "classic", education: "classic", certifications: "list",
    },
  },
};

export function applyTemplatePreset(id: TemplateId): ThemeConfig {
  const preset = TEMPLATE_PRESETS[id];
  return {
    templateId: id,
    primaryColor: preset.defaultColors.primaryColor,
    accentColor: preset.defaultColors.accentColor,
    textColor: preset.defaultColors.textColor,
    headingFont: preset.defaultFonts.headingFont,
    bodyFont: preset.defaultFonts.bodyFont,
    sectionVariants: { ...preset.defaultVariants },
  };
}

export function resolveVariant(config: ThemeConfig, sectionType: SectionType): string {
  const preset = TEMPLATE_PRESETS[config.templateId];
  return config.sectionVariants[sectionType] ?? preset.defaultVariants[sectionType] ?? "";
}

export function spacingScale(spacing: Spacing): { padding: string; sectionGap: string } {
  switch (spacing) {
    case "compact": return { padding: "1.75rem", sectionGap: "1.25rem" };
    case "spacious": return { padding: "3rem", sectionGap: "2rem" };
    default: return { padding: "2.5rem", sectionGap: "1.5rem" };
  }
}

export function sectionsPresent(sections: CVSection[]): SectionType[] {
  return sections.map(s => s.type);
}
