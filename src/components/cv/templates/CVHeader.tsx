import type { CVContent, CVSection, ThemeConfig } from "../../../types/cv";
import type { CVTheme } from "../cvThemes";
import { InlineInput } from "../InlineEdit";
import { resolveVariant } from "../templates";
import { CONTACT_COMPONENTS, pick } from "../sectionVariants/registry";

export function CVHeader({
  content, theme, config, updateName, updateTitle, updateContactField,
}: {
  content: CVContent;
  theme: CVTheme;
  config: ThemeConfig;
  updateName: (v: string) => void;
  updateTitle: (v: string) => void;
  updateContactField: (field: string, value: string) => void;
}) {
  const contact = content.sections.find(s => s.type === "contact") as Extract<CVSection, { type: "contact" }> | undefined;
  const Contact = pick(CONTACT_COMPONENTS, resolveVariant(config, "contact"), "stacked");
  const stacked = resolveVariant(config, "contact") !== "badges";

  return (
    <div className={stacked ? "mb-6" : "border-b pb-6 mb-6"} style={stacked ? undefined : { borderColor: String(theme.divider.borderTop ?? "#e2e8f0").split(" ").pop() }}>
      <div className={`flex flex-col md:flex-row gap-4 ${stacked ? "md:justify-between md:items-start" : "md:items-end justify-between"}`}>
        <div className="flex-1">
          <InlineInput value={content.name} onSave={updateName} placeholder="Your Name" style={theme.name} />
          <div className="mt-1">
            <InlineInput value={content.title} onSave={updateTitle} placeholder="Professional Title" style={theme.title} />
          </div>
        </div>
        {stacked && contact && <Contact contact={contact} theme={theme} onUpdateField={updateContactField} />}
      </div>
      {!stacked && contact && <Contact contact={contact} theme={theme} onUpdateField={updateContactField} />}
    </div>
  );
}
