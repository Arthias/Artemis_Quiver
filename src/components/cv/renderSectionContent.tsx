import { Plus } from "lucide-react";
import type { CVSection, ThemeConfig } from "../../types/cv";
import type { CVTheme } from "./cvThemes";
import { resolveVariant } from "./templates";
import { ExperienceItemCard, EducationItemCard, SkillsView } from "./EditComponents";
import { SUMMARY_COMPONENTS, CERTIFICATIONS_COMPONENTS, pick } from "./sectionVariants/registry";

export interface SectionRenderDeps {
  theme: CVTheme;
  config: ThemeConfig;
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

export function renderSectionContent(section: CVSection, deps: SectionRenderDeps): React.ReactNode | null {
  switch (section.type) {
    case "summary": {
      const s = section;
      const Variant = pick(SUMMARY_COMPONENTS, resolveVariant(deps.config, "summary"), "paragraph");
      return <Variant content={s.content} theme={deps.theme} onSave={deps.updateSummaryContent} />;
    }
    case "experience": {
      const s = section;
      const items = s.experience ?? [];
      const variant = resolveVariant(deps.config, "experience");
      return (
        <div>
          <div className="space-y-5">
            {items.map((exp, idx) => (
              <ExperienceItemCard
                key={idx} item={exp as any} variant={variant} theme={deps.theme}
                onUpdate={(item) => deps.updateExperienceItem(idx, item)}
                onRemove={() => deps.removeExperienceItem(idx)}
              />
            ))}
          </div>
          <button onClick={deps.addExperienceItem}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium print:hidden"
            style={{ color: deps.theme.title.color }}>
            <Plus className="w-3.5 h-3.5" /> Add experience
          </button>
        </div>
      );
    }
    case "skills": {
      const s = section;
      return (
        <SkillsView
          skills={s}
          onUpdateSkillsSection={deps.updateSkillsSection}
          theme={deps.theme}
          variant={resolveVariant(deps.config, "skills")}
        />
      );
    }
    case "education": {
      const s = section;
      const items = s.education ?? [];
      const variant = resolveVariant(deps.config, "education");
      return (
        <div>
          <div className="space-y-4">
            {items.map((edu, idx) => (
              <EducationItemCard
                key={idx} item={edu as any} variant={variant} theme={deps.theme}
                onUpdate={(item) => deps.updateEducationItem(idx, item)}
                onRemove={() => deps.removeEducationItem(idx)}
              />
            ))}
          </div>
          <button onClick={deps.addEducationItem}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium print:hidden"
            style={{ color: deps.theme.title.color }}>
            <Plus className="w-3.5 h-3.5" /> Add education
          </button>
        </div>
      );
    }
    case "certifications": {
      const s = section;
      const certs = s.certifications ?? [];
      const Variant = pick(CERTIFICATIONS_COMPONENTS, resolveVariant(deps.config, "certifications"), "list");
      return (
        <div>
          <Variant
            certifications={certs} theme={deps.theme}
            onUpdate={deps.updateCertification} onRemove={deps.removeCertification}
          />
          <button onClick={deps.addCertification}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium print:hidden"
            style={{ color: deps.theme.title.color }}>
            <Plus className="w-3.5 h-3.5" /> Add certification
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}
