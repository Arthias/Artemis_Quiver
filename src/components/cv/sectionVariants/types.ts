import type { CVSection } from "../../../types/cv";
import type { CVTheme } from "../cvThemes";

export type ExperienceItem = NonNullable<Extract<CVSection, { type: "experience" }>["experience"]>[number];
export type EducationItem = NonNullable<Extract<CVSection, { type: "education" }>["education"]>[number];
export type ContactSection = Extract<CVSection, { type: "contact" }>;
export type SkillsSection = Extract<CVSection, { type: "skills" }>;

export interface ExperienceVariantProps {
  item: ExperienceItem;
  theme: CVTheme;
}

export interface EducationVariantProps {
  item: EducationItem;
  theme: CVTheme;
}

export interface SummaryVariantProps {
  content: string;
  theme: CVTheme;
  onSave: (v: string) => void;
}

export interface ContactVariantProps {
  contact: ContactSection;
  theme: CVTheme;
  onUpdateField: (field: string, value: string) => void;
}

export interface SkillsVariantProps {
  skills: SkillsSection;
  theme: CVTheme;
}

export interface CertificationsVariantProps {
  certifications: string[];
  theme: CVTheme;
  onUpdate: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
}
