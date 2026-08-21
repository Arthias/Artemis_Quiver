import type { CVContent, CVSection, ThemeConfig } from "../../../types/cv";
import type { CVTheme } from "../cvThemes";

export interface TemplateShellProps {
  content: CVContent;
  theme: CVTheme;
  config: ThemeConfig;
  bodySections: CVSection[];
  dragVisualIdx: number | null;
  collapsed: Set<string>;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onMove: (from: number, to: number) => void;
  onToggleCollapse: (type: string) => void;
  onTogglePageBreak: (type: string) => void;
  updateName: (v: string) => void;
  updateTitle: (v: string) => void;
  updateContactField: (field: string, value: string) => void;
  updateSummaryContent: (v: string) => void;
  updateSkillsSection: (s: Extract<CVSection, { type: "skills" }>) => void;
  updateExperienceItem: (i: number, item: any) => void;
  addExperienceItem: () => void;
  removeExperienceItem: (i: number) => void;
  updateEducationItem: (i: number, item: any) => void;
  addEducationItem: () => void;
  removeEducationItem: (i: number) => void;
  updateCertification: (i: number, v: string) => void;
  addCertification: () => void;
  removeCertification: (i: number) => void;
}
