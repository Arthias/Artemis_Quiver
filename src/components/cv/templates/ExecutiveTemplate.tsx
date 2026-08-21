import { spacingScale } from "../templates";
import { SectionFrame } from "../SectionFrame";
import { renderSectionContent, type SectionRenderDeps } from "../renderSectionContent";
import { CVHeader } from "./CVHeader";
import type { TemplateShellProps } from "./types";
import { TEMPLATE_PRESETS } from "../templates";

const GRID_TYPES = new Set(["skills", "education", "certifications"]);

export function ExecutiveTemplate(props: TemplateShellProps) {
  const { content, theme, config, bodySections } = props;
  const preset = TEMPLATE_PRESETS.executive;
  const { padding } = spacingScale(preset.spacing);

  const deps: SectionRenderDeps = {
    theme, config,
    updateSummaryContent: props.updateSummaryContent,
    updateSkillsSection: props.updateSkillsSection,
    updateExperienceItem: props.updateExperienceItem,
    addExperienceItem: props.addExperienceItem,
    removeExperienceItem: props.removeExperienceItem,
    updateEducationItem: props.updateEducationItem,
    addEducationItem: props.addEducationItem,
    removeEducationItem: props.removeEducationItem,
    updateCertification: props.updateCertification,
    addCertification: props.addCertification,
    removeCertification: props.removeCertification,
  };

  const frame = (section: (typeof bodySections)[number], visualIdx: number) => (
    <SectionFrame
      key={section.type}
      sectionType={section.type}
      pageBreakBefore={section.pageBreakBefore}
      visualIdx={visualIdx}
      total={bodySections.length}
      theme={theme}
      dragVisualIdx={props.dragVisualIdx}
      isCollapsed={props.collapsed.has(section.type)}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragEnd={props.onDragEnd}
      onMove={props.onMove}
      onToggleCollapse={props.onToggleCollapse}
      onTogglePageBreak={props.onTogglePageBreak}
    >
      {renderSectionContent(section, deps)}
    </SectionFrame>
  );

  const flowEntries = bodySections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !GRID_TYPES.has(s.type));
  const skillsEntry = bodySections.map((s, i) => ({ s, i })).find(({ s }) => s.type === "skills");
  const eduEntry = bodySections.map((s, i) => ({ s, i })).find(({ s }) => s.type === "education");
  const certEntry = bodySections.map((s, i) => ({ s, i })).find(({ s }) => s.type === "certifications");

  return (
    <div className="cv-preview-card rounded-lg border border-gray-200 shadow-sm" style={{ fontFamily: theme.fontFamily, background: theme.container.background, ...theme.card }}>
      <div style={{ padding }}>
        <CVHeader
          content={content} theme={theme} config={config}
          updateName={props.updateName} updateTitle={props.updateTitle} updateContactField={props.updateContactField}
        />

        {flowEntries.map(({ s, i }) => frame(s, i))}

        {(skillsEntry || eduEntry || certEntry) && (
          <div className="grid grid-cols-1 md:grid-cols-2 print-grid-2 gap-6 pt-2 border-t" style={{ borderColor: String(theme.divider.borderTop ?? "#e2e8f0").split(" ").pop() }}>
            <div>{skillsEntry && frame(skillsEntry.s, skillsEntry.i)}</div>
            <div>
              {eduEntry && frame(eduEntry.s, eduEntry.i)}
              {certEntry && frame(certEntry.s, certEntry.i)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
