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

export const CVSectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("summary"),
    content: z.string().max(2000).describe("Professional summary text")
  }),
  z.object({
    type: z.literal("contact"),
    email: z.string().optional().describe("Contact email address"),
    phone: z.string().optional().describe("Contact phone number"),
    linkedin: z.string().optional().describe("LinkedIn profile URL"),
    website: z.string().optional().describe("Personal website URL"),
    location: z.string().optional().describe("City, country")
  }),
  z.object({
    type: z.literal("skills"),
    skills: z.array(z.string()).optional().describe("Flat list of skill keywords"),
    categories: z.array(z.object({
      name: z.string(),
      items: z.array(z.string())
    })).optional().describe("Grouped skills by category")
  }),
  z.object({
    type: z.literal("experience"),
    experience: z.array(ExperienceItemSchema).optional().describe("Work history items")
  }),
  z.object({
    type: z.literal("education"),
    education: z.array(EducationItemSchema).optional().describe("Education history")
  }),
  z.object({
    type: z.literal("certifications"),
    certifications: z.array(z.string()).optional().describe("Professional certifications")
  })
]);

export const CVContentSchema = z.object({
  name: z.string().describe("Candidate's full name"),
  title: z.string().describe("Professional headline / role title"),
  location: z.string().optional().describe("Primary location"),
  sections: z.array(CVSectionSchema).min(1).describe("CV section array")
});

export const ThemeConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  templateId: z.enum(["modern", "classic", "minimal"]).optional()
});

export type CVSection = z.infer<typeof CVSectionSchema>;
export type CVContent = z.infer<typeof CVContentSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
