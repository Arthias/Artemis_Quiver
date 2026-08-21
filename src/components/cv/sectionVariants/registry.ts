import { SummaryParagraph, SummaryCallout } from "./summary";
import { ContactStacked, ContactBadges } from "./contact";
import { SkillsTags, SkillsColumns, SkillsInline } from "./skills";
import { ExperienceClassic, ExperienceCards, ExperienceTimeline } from "./experience";
import { EducationClassic, EducationCards } from "./education";
import { CertificationsList, CertificationsTags } from "./certifications";

export const SUMMARY_COMPONENTS = { paragraph: SummaryParagraph, callout: SummaryCallout };
export const CONTACT_COMPONENTS = { stacked: ContactStacked, badges: ContactBadges };
export const SKILLS_COMPONENTS = { tags: SkillsTags, columns: SkillsColumns, inline: SkillsInline };
export const EXPERIENCE_COMPONENTS = { classic: ExperienceClassic, cards: ExperienceCards, timeline: ExperienceTimeline };
export const EDUCATION_COMPONENTS = { classic: EducationClassic, cards: EducationCards };
export const CERTIFICATIONS_COMPONENTS = { list: CertificationsList, tags: CertificationsTags };

export function pick<T extends Record<string, unknown>>(map: T, id: string, fallback: keyof T): T[keyof T] {
  return (map as any)[id] ?? map[fallback];
}
