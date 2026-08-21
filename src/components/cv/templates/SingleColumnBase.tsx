import { spacingScale, type Spacing } from "../templates";
import { SectionFrame } from "../SectionFrame";
import { renderSectionContent } from "../renderSectionContent";
import { CVHeader } from "./CVHeader";
import type { TemplateShellProps } from "./types";

export function SingleColumnBase({ spacing, flatCard, props }: { spacing: Spacing; flatCard: boolean; props: TemplateShellProps }) {
  const { content, theme, config, bodySections } = props;
  const { padding, sectionGap } = spacingScale(spacing);

  const cardStyle = flatCard
    ? { fontFamily: theme.fontFamily, background: theme.container.background }
    : { fontFamily: theme.fontFamily, background: theme.container.background, ...theme.card };

  return (
    <div
      className={`cv-preview-card rounded-lg border border-gray-200 ${flatCard ? "" : "shadow-sm"}`}
      style={cardStyle}
    >
      <div style={{ padding }}>
        <CVHeader
          content={content} theme={theme} config={config}
          updateName={props.updateName} updateTitle={props.updateTitle} updateContactField={props.updateContactField}
        />
        <hr style={theme.divider} />
        <div style={{ marginTop: sectionGap }}>
          {bodySections.map((section, visualIdx) => (
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
              {renderSectionContent(section, {
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
              })}
            </SectionFrame>
          ))}
        </div>
      </div>
    </div>
  );
}
