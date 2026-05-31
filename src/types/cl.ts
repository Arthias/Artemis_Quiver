import { z } from "zod";

export const CLContentSchema = z.object({
  senderName: z.string().min(1).describe("Your full name"),
  senderTitle: z.string().optional().describe("Your professional title"),
  date: z.string().optional().describe("Letter date"),
  recipientName: z.string().optional().describe("Hiring manager name"),
  companyName: z.string().optional().describe("Company name"),
  companyLocation: z.string().optional().describe("Company city, state"),
  position: z.string().optional().describe("Target position"),
  subject: z.string().optional().describe("Re: subject line"),
  salutation: z.string().describe("Greeting line, e.g. 'Dear Hiring Manager,'"),
  bodyParagraphs: z.array(z.string()).min(1).describe("Letter body paragraphs"),
  closing: z.string().describe("Sign-off, e.g. 'Sincerely,'"),
});

export type CLContent = z.infer<typeof CLContentSchema>;
