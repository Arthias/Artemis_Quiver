// ============================================================================
// CV Builder Prompts
// Organized by task persona and optimization mode.
// Each prompt is a factory: (context) => systemMessage
// ============================================================================

// Only "standard" is reachable from the UI today. `audit`, `hiring-manager`
// and `ats-optimize` are kept deliberately — they are generic, they do not
// instruct the model to invent anything, and they are candidates for being
// wired up later. The other six modes were deleted: they were unreachable and
// two of them (bullet-optimize, skills-section) explicitly told the model to
// invent metrics and to suggest skills the profile does not contain.
export type OptimizationMode =
  | "standard"
  | "ats-optimize"
  | "audit"
  | "hiring-manager";

export interface PromptContext {
  targetRole?: string;
  industry?: string;
  jobDescription?: string;
  recommendations?: string[];
  locale?: string;
}

// ============================================================================
// Language enforcement
// Appended to every generated prompt so output — including LLM-chosen labels
// like skill category names ("Programming Languages", not just body text) —
// matches the user's selected UI language instead of silently defaulting to
// English. `locale` is expected to be an i18next language code (e.g. "en",
// "es"); unset/"en" is a no-op since English is the baseline for every prompt.
// ============================================================================

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  it: "Italian",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

export function localeInstruction(locale?: string): string {
  const code = ((locale ?? "en").split("-")[0] ?? "en").toLowerCase();
  if (!code || code === "en") return "";
  const name = LOCALE_NAMES[code] ?? code;
  const example = name === "Spanish" ? `e.g. write "Lenguajes de programación", not "Programming Languages"` : `translate every label, not just the prose`;
  return `\n\nLANGUAGE: Respond ENTIRELY in ${name}. This applies to every piece of generated text, including field/category labels the model itself invents (${example}). Never default to English or mix languages within the response.`;
}

// ============================================================================
// CV Generation (base: structured JSON from profile)
// ============================================================================

const CV_JSON_FORMAT = `You MUST return ONLY a valid JSON object. No markdown fences, no text outside the JSON.

Each section in the "sections" array MUST have a "type" field.

EXAMPLE:
{
  "name": "Jane Doe",
  "title": "Senior Software Engineer | Full-Stack Architect",
  "location": "San Francisco, CA",
  "sections": [
    { "type": "summary", "content": "Professional summary text here" },
    { "type": "contact", "email": "user@example.com", "phone": "+1 234 567 890", "linkedin": "https://linkedin.com/in/user", "website": "https://user.com", "location": "San Francisco, CA" },
    { "type": "skills", "skills": ["JavaScript", "Python", "React"], "categories": [{"name": "Languages", "items": ["JavaScript", "Python"]}, {"name": "Frameworks", "items": ["React", "Node.js"]}] },
    { "type": "experience", "experience": [{"role": "Senior Dev", "company": "Acme", "period": "2020-2023", "location": "Remote", "bullets": ["Led a team of 5 engineers, delivering 12 features on schedule", "Reduced deployment time by 40% with CI/CD automation", "Architected microservices serving 2M+ users"]}] },
    { "type": "education", "education": [{"degree": "BSc Computer Science", "institution": "MIT", "period": "2012-2016", "location": "Cambridge, MA"}] },
    { "type": "certifications", "certifications": ["AWS Solutions Architect"] }
  ]
}

TOP-LEVEL FIELDS:
1. "name" — candidate full name (required)
2. "title" — professional headline / role (required)
3. "location" — primary location (optional)

SECTION TYPES:
1. "summary" — object with "content" string
2. "contact" — object with optional email, phone, linkedin, website, location strings
3. "skills" — object with "skills" array OR "categories" array of {name, items[]}
4. "experience" — object with "experience" array of {role, company, period, location?, bullets[]}
5. "education" — object with "education" array of {degree, institution, period, location?}
6. "certifications" — object with "certifications" array of strings

RULES:
- Be FACTUAL — only include information from the profile
- Prefer "bullets" array for experience descriptions (one achievement per bullet) over a single description string
- Categorize skills when possible using the "categories" field
- Return ONLY the JSON object, no text/comments/formatting around it`;

function cvGeneratePrompt(ctx: PromptContext): string {
  const parts: string[] = [
    "You are an expert CV writer and career coach. Generate a professional CV in structured JSON from the candidate profile.",
  ];

  if (ctx.industry) {
    parts.push(`\nIndustry context: ${ctx.industry}. Tailor language, keywords, and emphasis to this industry's norms.`);
  }

  if (ctx.targetRole) {
    parts.push(`\nTarget role: ${ctx.targetRole}. Emphasize experience, skills, and achievements that directly support this role. Use role-specific terminology where appropriate.`);
  }

  parts.push(`
GENERAL OPTIMIZATION GUIDELINES:
- Summary: Write 2-3 concise sentences that communicate role, years of experience, key strengths, and value proposition. Avoid generic phrases like "results-driven" or "team player" — use specific, substantive claims.
- Experience descriptions: Use strong action verbs (led, drove, designed, implemented, optimized). Prefer measurable achievements over responsibility-listing. Use the pattern: Action + What + Result/Impact.
- Skills: Order by relevance to the target role. Group by category if the list is long.
- Overall: Be concise. Every line should serve a purpose. Cut filler.`);

  parts.push(`\n${CV_JSON_FORMAT}`);

  return parts.join("\n");
}

// ============================================================================
// ATS Optimization (#3)
// ============================================================================

function atsOptimizePrompt(_ctx: PromptContext): string {
  return `You are an ATS (Applicant Tracking System) optimization expert. Rewrite the CV content so it ranks well with automated screeners while remaining natural and readable to human reviewers.

Job description provided below. Use it to identify:
1. Required skills, tools, and certifications — ensure these appear verbatim where the profile supports them
2. Preferred qualifications — weave these in naturally where applicable
3. Industry terminology and keywords from the posting
4. Action verbs and phrasing patterns used in the job description

ATS GUIDELINES:
- Use the exact keyword phrasing from the job description (not synonyms) where the profile supports it
- Place critical keywords in context (within experience descriptions and skills, not forced into a keyword dump)
- Avoid tables, columns, or special characters that confuse parsers
- Use standard section headings (Summary, Experience, Education, Skills)
- Spell out acronyms on first use, then use the acronym
- Do NOT fabricate skills or experience that aren't in the profile
- Keep the language natural — keyword stuffing is detectable by modern ATS

Return the full CV content optimized for ATS.`;
}

// ============================================================================
// CV Audit (#5)
// ============================================================================

function auditPrompt(ctx: PromptContext): string {
  return `You are a senior hiring manager and resume reviewer with 15+ years of experience across ${ctx.industry ?? "multiple industries"}. Audit the candidate's CV and provide frank, specific feedback.

AUDIT CRITERIA:
1. VAGUENESS: Flag any description that lacks specifics (team size, scope, technologies, outcomes)
2. WORDINESS: Cut redundant phrases, filler adjectives, and unnecessarily long sentences
3. IMPACT: Identify bullets that state responsibilities but don't communicate results
4. LEADERSHIP: Note where leadership, initiative, or ownership could be better highlighted
5. INNOVATION: Identify areas where the candidate solved problems or improved things that read as routine
6. STRUCTURE: Assess section ordering, readability, whether the most important content is prominent
7. TONE: Evaluate whether the voice is confident vs. passive, active vs. descriptive
8. GAPS: Point out any missing context (dates, technologies, scope) that a hiring manager would wonder about

For each issue found, provide:
- Location (which section)
- The problem (what's weak)
- A suggested rewrite (how to fix it)

Return the audit in a structured format. Be direct — the candidate wants honest feedback, not encouragement.`;
}

// ============================================================================
// Hiring Manager Roleplay (#10)
// ============================================================================

function hiringManagerPrompt(ctx: PromptContext): string {
  return `You are a hiring manager at a ${ctx.industry ?? "leading"} company looking to fill a ${ctx.targetRole ?? "senior-level"} role. You review 200+ resumes for every open position. Be direct, critical, and specific about what would make you shortlist or reject this candidate.

ANSWER THESE QUESTIONS IN YOUR FEEDBACK:
1. Would you invite this candidate for an interview? Why or why not?
2. What is the first thing that makes you hesitate?
3. What specific changes would increase your confidence in this candidate?
4. What's missing that you'd expect to see for this level of role?
5. Is there anything on this resume that raises a red flag?
6. If you interviewed this person, what are the top 3 things you'd want to verify or probe deeper?

Be specific. Reference particular lines or sections of the resume. Don't just say "add more metrics" — point to where and what kind. The candidate wants actionable, honest feedback from the person who actually makes hiring decisions.`;
}

// ============================================================================
// CV Edit System Prompt (general)
// ============================================================================

// Note: callers are responsible for appending `localeInstruction(locale)` —
// see `selectPrompt` (routes through here for edit-mode) and
// `cvBuilderService.editCv` (calls this directly).
export function cvEditPrompt(userRequest: string): string {
  return `You are an expert CV editor. Apply the user's requested changes to the CV JSON below.

General quality standards for all edits:
- Experience descriptions should use strong action verbs and measurable outcomes
- Summary should be concise and value-focused
- Skills should be relevant and well-organized
- Avoid vague or generic language throughout

User request: ${userRequest}

Return ONLY the revised JSON object — no markdown wrappers, no text, no commentary. Each section MUST have a "type" field.`;
}

// ============================================================================
// Prompt routing — selects the right prompt based on optimization mode
// ============================================================================

export function selectPrompt(
  mode: OptimizationMode,
  userRequest: string | undefined,
  ctx: PromptContext
): string {
  const base = (() => {
    switch (mode) {
      case "standard":
        return cvGeneratePrompt(ctx);
      case "ats-optimize":
        return atsOptimizePrompt(ctx);
      case "audit":
        return auditPrompt(ctx);
      case "hiring-manager":
        return hiringManagerPrompt(ctx);
      default:
        return userRequest
          ? cvEditPrompt(userRequest)
          : cvGeneratePrompt(ctx);
    }
  })();
  return `${base}${localeInstruction(ctx.locale)}`;
}

// ============================================================================
// Cover Letter Builder Prompts
// ============================================================================

const CL_JSON_FORMAT = `You MUST return ONLY a valid JSON object. No markdown fences, no text outside the JSON.

EXAMPLE:
{
  "senderName": "Jane Doe",
  "senderTitle": "Senior Software Engineer",
  "date": "May 29, 2026",
  "recipientName": "Hiring Manager",
  "companyName": "Acme Corp",
  "companyLocation": "San Francisco, CA",
  "position": "Senior Engineer",
  "subject": "Application for Senior Engineer Position",
  "salutation": "Dear Hiring Manager,",
  "bodyParagraphs": [
    "I am writing to express my strong interest in the Senior Engineer position at Acme Corp. With 8 years of experience in full-stack development, I have honed skills in React, Node.js, and cloud architecture that align closely with the requirements of this role.",
    "In my current role at TechCo, I led a team of 5 engineers delivering 12 major features on schedule. I reduced deployment time by 40% through CI/CD automation and architected microservices serving 2M+ users.",
    "I would welcome the opportunity to discuss how my technical leadership and product instincts can drive impact at Acme Corp."
  ],
  "closing": "Sincerely,"
}

TOP-LEVEL FIELDS:
1. "senderName" — your full name (required)
2. "senderTitle" — your professional title (optional)
3. "date" — letter date string (optional)
4. "recipientName" — hiring manager name if known (optional, default "Hiring Manager")
5. "companyName" — target company (optional)
6. "companyLocation" — company city, state (optional)
7. "position" — target position title (optional)
8. "subject" — Re: subject line (optional)
9. "salutation" — greeting line (required, e.g. "Dear Hiring Manager,")
10. "bodyParagraphs" — array of paragraph strings (required, at least 1)
11. "closing" — sign-off (required, e.g. "Sincerely,")

RULES:
- Be FACTUAL — only include information from the candidate profile
- Write 3-4 paragraphs: opening (role interest + fit), middle (key achievements), closing (enthusiasm + call to action)
- Use professional business letter tone
- Return ONLY the JSON object, no text/comments/formatting around it`;

export function clGeneratePrompt(
  _company: string,
  _role: string,
  hasJobDescription: boolean,
  locale?: string,
): string {
  const parts: string[] = [
    "You are an expert cover letter writer and career coach.",
  ];

  if (hasJobDescription) {
    parts.push("The candidate has provided a job description below. Tailor the cover letter to that specific role, mirroring key requirements and showing how the candidate's experience addresses them.");
  }

  parts.push(`
WRITING GUIDELINES:
- Opening paragraph: State the role you're applying for, express enthusiasm, and give a 1-sentence overview of why you're a strong fit.
- Middle paragraphs (1-2): Highlight 2-3 specific achievements or experiences from the profile that directly map to job requirements. Use metrics where possible.
- Closing paragraph: Reiterate enthusiasm, mention desire for an interview, and thank the reader.
- Tone: Professional, confident, specific. Avoid clichés like "I am writing to apply" (instead, lead with enthusiasm and fit).
- If no job description is provided, write a general but compelling letter highlighting the candidate's strongest attributes.

${CL_JSON_FORMAT}`);

  return `${parts.join("\n")}${localeInstruction(locale)}`;
}

export function clEditPrompt(userRequest: string, locale?: string): string {
  return `You are a cover letter editor. Apply the user's requested changes to the cover letter JSON below.

User request: "${userRequest}"

RULES:
- Preserve all fields unless the user explicitly asks to change them
- Modify only the bodyParagraphs unless otherwise requested
- Keep the same tone unless asked to change it
- Return ONLY valid JSON, no text outside

${CL_JSON_FORMAT}${localeInstruction(locale)}`;
}


