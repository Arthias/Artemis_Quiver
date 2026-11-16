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

/** Languages a CV or cover letter can be written in, chosen per document. */
export const OUTPUT_LANGUAGES = Object.keys(LOCALE_NAMES);

/** "es-ES" -> "es"; anything unsupported -> "en". */
export function outputLanguage(locale?: string): string {
  const code = ((locale ?? "en").split("-")[0] ?? "en").toLowerCase();
  return code in LOCALE_NAMES ? code : "en";
}

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
    { "type": "education", "education": [{"degree": "<exactly as in the profile>", "institution": "<exactly as in the profile>", "period": "<as in the profile>", "location": "<as in the profile>"}] },
    { "type": "certifications", "certifications": ["AWS Solutions Architect"] },
    { "type": "languages", "languages": ["<language> (<level exactly as in the profile>)"] }
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
7. "languages" — object with "languages" array of strings, each "<language> (<level>)"; include it whenever the profile lists languages

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

EXAMPLE (shape only — never reuse its wording or facts):
{
  "senderName": "Jane Doe",
  "senderTitle": "Senior Software Engineer",
  "date": "May 29, 2026",
  "salutation": "Dear Acme hiring team,",
  "bodyParagraphs": [
    "Acme's Senior Engineer role asks for someone who can scale a React and Node platform while mentoring a growing team, which is the work I have done for the past four years at TechCo.",
    "The posting puts CI/CD ownership first: at TechCo I rebuilt our pipeline and cut deployment time by 40%. It also asks for experience with high-traffic services, and I designed the microservices that now serve over 2 million users. On mentoring, I lead a team of five engineers who shipped 12 major features on schedule last year.",
    "I would be glad to talk through how I could do the same for Acme's platform team."
  ],
  "closing": "Kind regards,"
}

FIELDS:
- "senderName" (required), "senderTitle" (optional), "date" (optional)
- "salutation" (required) — address the company's team, or a named person only if the job description names one
- "bodyParagraphs" (required) — exactly 3 plain-prose strings
- "closing" (required)
- Do not add recipient address, company location or "Re:" subject fields.

RULES:
- 150–250 words across the body. Short and specific beats complete.
- Plain prose only: no bullet points, dashes-as-lists, headings or markdown. The letter is often pasted into a plain text box.
- Be FACTUAL: every claim must come from the candidate profile. If the profile has no evidence for a requirement, leave that requirement out — never stretch or invent.
- Return ONLY the JSON object`;

export function clGeneratePrompt(
  _company: string,
  _role: string,
  hasJobDescription: boolean,
  locale?: string,
): string {
  const parts: string[] = [
    "You write short, precise cover letters that a recruiter can read in thirty seconds.",
  ];

  if (hasJobDescription) {
    parts.push("A job description is provided. Pick the 2–3 requirements it stresses most AND for which the candidate profile has concrete evidence. Those requirements drive the whole letter.");
  } else {
    parts.push("No job description is provided. Use the candidate's 2–3 strongest, most concrete achievements instead.");
  }

  parts.push(`
STRUCTURE (3 paragraphs):
1. Opening, 1–2 sentences: name the role and the single strongest reason the candidate fits. Do not open with "I am writing to", "I am excited to apply" or similar.
2. Evidence, 3–4 sentences: for each chosen requirement, name it in the employer's terms and answer it with one specific piece of evidence from the profile (employer, what was done, a number when the profile has one).
3. Close, 1–2 sentences: a direct invitation to talk. No "thank you for your time and consideration", no restating the letter.

AVOID: "passionate", "team player", "proven track record", "I believe I would be a great fit", "dynamic", and any sentence that would fit any job.
If a draft is provided, reuse its facts but follow this structure and length.

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
- Keep plain prose (no bullets or markdown) and stay under about 250 words unless asked otherwise
- Return ONLY valid JSON, no text outside

${CL_JSON_FORMAT}${localeInstruction(locale)}`;
}


