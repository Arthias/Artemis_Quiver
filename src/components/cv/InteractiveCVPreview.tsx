import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { SECTION_TYPES, emptySection, type BodySectionType, type CVContent, type CVSection, type StringListSectionType, type ThemeConfig } from "../../types/cv";
import { SECTION_LABELS } from "./EditComponents";
import type { CVTheme } from "./cvThemes";
import { ClassicTemplate } from "./templates/ClassicTemplate";
import { ModernTemplate } from "./templates/ModernTemplate";
import { ExecutiveTemplate } from "./templates/ExecutiveTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";
import type { TemplateShellProps } from "./templates/types";

const TEMPLATE_COMPONENTS: Record<ThemeConfig["templateId"], React.ComponentType<TemplateShellProps>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  executive: ExecutiveTemplate,
  minimal: MinimalTemplate,
};

interface InteractiveCVPreviewProps {
  content: CVContent;
  onContentChange: (content: CVContent) => void;
  theme: CVTheme;
  config: ThemeConfig;
}

export function InteractiveCVPreview({ content, onContentChange, theme, config }: InteractiveCVPreviewProps) {
  const { t } = useTranslation();
  const [dragVisualIdx, setDragVisualIdx] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const bodySections = useMemo(() =>
    content.sections.filter(s => s.type !== "contact"),
    [content.sections]
  );

  const bodyIndices = useMemo(() =>
    content.sections
      .map((s, i) => s.type !== "contact" ? i : -1)
      .filter((i): i is number => i !== -1),
    [content.sections]
  );

  const moveSection = useCallback((fromVisualIdx: number, toVisualIdx: number) => {
    if (fromVisualIdx === toVisualIdx) return;
    const sections = [...content.sections];
    const fromActual = bodyIndices[fromVisualIdx];
    const toActual = bodyIndices[toVisualIdx];
    if (fromActual === undefined || toActual === undefined) return;
    const [moved] = sections.splice(fromActual, 1);
    if (!moved) return;
    const insertAt = toActual > fromActual ? toActual - 1 : toActual;
    sections.splice(insertAt, 0, moved);
    onContentChange({ ...content, sections });
  }, [content, onContentChange, bodyIndices]);

  const handleDragStart = useCallback((visualIdx: number) => {
    setDragVisualIdx(visualIdx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, visualIdx: number) => {
    e.preventDefault();
    if (dragVisualIdx === null || dragVisualIdx === visualIdx) return;
    moveSection(dragVisualIdx, visualIdx);
    setDragVisualIdx(visualIdx);
  }, [dragVisualIdx, moveSection]);

  const handleDragEnd = useCallback(() => {
    setDragVisualIdx(null);
  }, []);

  const toggleCollapse = (type: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const togglePageBreak = (sectionType: string) => {
    updateSection(sections => sections.map(s =>
      s.type === sectionType
        ? { ...s, pageBreakBefore: s.pageBreakBefore ? undefined : true } as CVSection
        : s
    ));
  };

  const updateSection = useCallback((updater: (prev: CVSection[]) => CVSection[]) => {
    onContentChange({ ...content, sections: updater(content.sections) });
  }, [content, onContentChange]);

  const updateName = useCallback((name: string) => {
    onContentChange({ ...content, name });
  }, [content, onContentChange]);

  const updateTitle = useCallback((title: string) => {
    onContentChange({ ...content, title });
  }, [content, onContentChange]);

  const updateContactField = useCallback((field: string, value: string) => {
    updateSection(sections => sections.map(s =>
      s.type === "contact" ? { ...s, [field]: value } as CVSection : s
    ));
  }, [updateSection]);

  const updateSummaryContent = useCallback((value: string) => {
    updateSection(sections => sections.map(s =>
      s.type === "summary" ? { ...s, content: value } as CVSection : s
    ));
  }, [updateSection]);

  const updateSkillsSection = useCallback((section: Extract<CVSection, { type: "skills" }>) => {
    updateSection(sections => sections.map(s =>
      s.type === "skills" ? section : s
    ));
  }, [updateSection]);

  const updateExperienceItem = useCallback((idx: number, item: Record<string, any>) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      const items = [...(s.experience ?? [])];
      items[idx] = item as any;
      return { ...s, experience: items } as CVSection;
    }));
  }, [updateSection]);

  const addExperienceItem = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      const items = s.experience ?? [];
      return { ...s, experience: [...items, { role: "", company: "", period: "", location: "", bullets: [] }] } as CVSection;
    }));
  }, [updateSection]);

  const removeExperienceItem = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "experience") return s;
      return { ...s, experience: (s.experience ?? []).filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const updateEducationItem = useCallback((idx: number, item: Record<string, any>) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      const items = [...(s.education ?? [])];
      items[idx] = item as any;
      return { ...s, education: items } as CVSection;
    }));
  }, [updateSection]);

  const addEducationItem = useCallback(() => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      const items = s.education ?? [];
      return { ...s, education: [...items, { degree: "", institution: "", period: "" }] } as CVSection;
    }));
  }, [updateSection]);

  const removeEducationItem = useCallback((idx: number) => {
    updateSection(sections => sections.map(s => {
      if (s.type !== "education") return s;
      return { ...s, education: (s.education ?? []).filter((_, i) => i !== idx) } as CVSection;
    }));
  }, [updateSection]);

  const setList = useCallback((type: StringListSectionType, fn: (items: string[]) => string[]) => {
    updateSection(sections => sections.map(s =>
      s.type === type ? { ...s, [type]: fn((s as Record<string, unknown>)[type] as string[] ?? []) } as CVSection : s
    ));
  }, [updateSection]);

  const updateListItem = useCallback((type: StringListSectionType, idx: number, val: string) =>
    setList(type, items => items.map((v, i) => (i === idx ? val : v))), [setList]);
  const addListItem = useCallback((type: StringListSectionType) =>
    setList(type, items => [...items, ""]), [setList]);
  const removeListItem = useCallback((type: StringListSectionType, idx: number) =>
    setList(type, items => items.filter((_, i) => i !== idx)), [setList]);

  const removeSection = useCallback((type: string) => {
    updateSection(sections => sections.filter(s => s.type !== type));
  }, [updateSection]);

  const addSection = useCallback((type: BodySectionType) => {
    updateSection(sections => [...sections, emptySection(type)]);
  }, [updateSection]);

  const missingSections = SECTION_TYPES.filter(
    (type): type is BodySectionType => type !== "contact" && !content.sections.some(s => s.type === type)
  );
  const addLabels = { certifications: t("cv.addCertification"), languages: t("cv.addLanguage") };

  const Template = TEMPLATE_COMPONENTS[config.templateId] ?? ClassicTemplate;

  return (
    <>
    <Template
      content={content}
      theme={theme}
      config={config}
      bodySections={bodySections}
      dragVisualIdx={dragVisualIdx}
      collapsed={collapsed}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onMove={moveSection}
      onToggleCollapse={toggleCollapse}
      onTogglePageBreak={togglePageBreak}
      updateName={updateName}
      updateTitle={updateTitle}
      updateContactField={updateContactField}
      updateSummaryContent={updateSummaryContent}
      updateSkillsSection={updateSkillsSection}
      updateExperienceItem={updateExperienceItem}
      addExperienceItem={addExperienceItem}
      removeExperienceItem={removeExperienceItem}
      updateEducationItem={updateEducationItem}
      addEducationItem={addEducationItem}
      removeEducationItem={removeEducationItem}
      updateListItem={updateListItem}
      addListItem={addListItem}
      removeListItem={removeListItem}
      addLabels={addLabels}
      onRemoveSection={removeSection}
    />
    {missingSections.length > 0 && (
      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs text-muted-foreground">{t("cv.addSection")}</span>
        {missingSections.map(type => (
          <button key={type} onClick={() => addSection(type)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs hover:bg-muted">
            <Plus className="w-3 h-3" /> {SECTION_LABELS[type] ?? type}
          </button>
        ))}
      </div>
    )}
    </>
  );
}
