import { z } from "zod";

const ExperienceItemSchema = z.object({
  role: z.string(),
  company: z.string(),
  period: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
  bullets: z.array(z.string()).optional()
});

const EducationItemSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  period: z.string(),
  location: z.string().optional()
});

const PageBreakSchema = z.object({ pageBreakBefore: z.boolean().optional() });

const CVSectionSchema = z.discriminatedUnion("type", [
  PageBreakSchema.extend({
    type: z.literal("summary"),
    content: z.string().max(2000).describe("Professional summary text")
  }),
  PageBreakSchema.extend({
    type: z.literal("contact"),
    email: z.string().optional().describe("Contact email address"),
    phone: z.string().optional().describe("Contact phone number"),
    linkedin: z.string().optional().describe("LinkedIn profile URL"),
    website: z.string().optional().describe("Personal website URL"),
    location: z.string().optional().describe("City, country")
  }),
  PageBreakSchema.extend({
    type: z.literal("skills"),
    skills: z.array(z.string()).optional().describe("Flat list of skill keywords"),
    categories: z.array(z.object({
      name: z.string(),
      items: z.array(z.string())
    })).optional().describe("Grouped skills by category")
  }),
  PageBreakSchema.extend({
    type: z.literal("experience"),
    experience: z.array(ExperienceItemSchema).optional().describe("Work history items")
  }),
  PageBreakSchema.extend({
    type: z.literal("education"),
    education: z.array(EducationItemSchema).optional().describe("Education history")
  }),
  PageBreakSchema.extend({
    type: z.literal("certifications"),
    certifications: z.array(z.string()).optional().describe("Professional certifications")
  })
]);

const CVContentSchema = z.object({
  name: z.string().describe("Candidate's full name"),
  title: z.string().describe("Professional headline / role title"),
  location: z.string().optional().describe("Primary location"),
  sections: z.array(CVSectionSchema).min(1).describe("CV section array")
});

export const TEMPLATE_IDS = ["classic", "modern", "executive", "minimal"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const SECTION_TYPES = [
  "summary", "contact", "skills", "experience", "education", "certifications",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SUMMARY_VARIANTS = ["paragraph", "callout"] as const;
export const CONTACT_VARIANTS = ["stacked", "badges"] as const;
export const SKILLS_VARIANTS = ["tags", "columns", "inline"] as const;
export const EXPERIENCE_VARIANTS = ["classic", "cards", "timeline"] as const;
export const EDUCATION_VARIANTS = ["classic", "cards"] as const;
export const CERTIFICATIONS_VARIANTS = ["list", "tags"] as const;

export const SECTION_VARIANTS_BY_TYPE: Record<SectionType, readonly string[]> = {
  summary: SUMMARY_VARIANTS,
  contact: CONTACT_VARIANTS,
  skills: SKILLS_VARIANTS,
  experience: EXPERIENCE_VARIANTS,
  education: EDUCATION_VARIANTS,
  certifications: CERTIFICATIONS_VARIANTS,
};

const ThemeConfigSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS).default("classic"),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  headingFont: z.string().min(1),
  bodyFont: z.string().min(1),
  sectionVariants: z.record(z.string(), z.string()).default({}),
});

export type CVSection = z.infer<typeof CVSectionSchema>;
export type CVContent = z.infer<typeof CVContentSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
