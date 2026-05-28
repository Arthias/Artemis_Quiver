import { z } from "zod";

/**
 * Schema definitions for structured CV content generation
 * @module cvTypes
 */

// ============================================================================
// Experience Item Schema
// ============================================================================
const ExperienceItemSchema = z.object({
  role: z.string(),
  company: z.string(),
  period: z.string(),
  description: z.string().optional()
});

// ============================================================================
// Education Item Schema  
// ============================================================================
const EducationItemSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  period: z.string()
});

// ============================================================================
// CV Section Types - discriminated union by type field
// ============================================================================
export const CVSectionSchema = z.discriminatedUnion("type", [
  // Summary Section
  z.object({
    type: z.literal("summary"),
    content: z.string().max(1000).describe("Professional summary text")
  }),
  
  // Contact Information Section
  z.object({
    type: z.literal("contact"),
    email: z.string().email().optional().describe("Contact email address"),
    phone: z.string().optional().describe("Contact phone number"),
    linkedin: z.string().url().optional().describe("LinkedIn profile URL"),
    website: z.string().url().optional().describe("Personal website URL")
  }),
  
  // Skills Section
  z.object({
    type: z.literal("skills"),
    skills: z.array(z.string()).min(1).describe("Array of skill keywords")
  }),
  
  // Work Experience Section
  z.object({
    type: z.literal("experience"),
    experience: z.array(ExperienceItemSchema).optional().describe("Work history items")
  }),
  
  // Education Section
  z.object({
    type: z.literal("education"),
    education: z.array(EducationItemSchema).optional().describe("Education history")
  }),
  
  // Certifications Section
  z.object({
    type: z.literal("certifications"),
    certifications: z.array(z.string()).optional().describe("Professional certifications")
  })
]);

// ============================================================================
// CV Content Root Schema  
// ============================================================================
export const CVContentSchema = z.object({
  sections: z.array(CVSectionSchema).min(1).describe("CV section array, at least one required")
});

// ============================================================================
// Theme Configuration Schema
// ============================================================================
export const ThemeConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  templateId: z.enum(["modern", "classic", "minimal"]).optional()
});

// ============================================================================
// Type Exports (for TypeScript consumers) 
// ============================================================================

export type CVSection = z.infer<typeof CVSectionSchema>;
export type CVContent = z.infer<typeof CVContentSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
