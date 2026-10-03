---
tags: [api, llm, prompt-engineering, fabrication, defect, analysis, proposals]
status: in-progress
last_updated: 2026-10-03
---

# Fabrication Surface Analysis

> [!WARNING] Nothing in this document is implemented
> A code analysis was produced on **2026-10-03**. **No code was changed.** Every
> change under "Proposed changes" is a **proposal, not a decision**, and the
> known defect this analyses is still present and still disclosed-not-fixed in
> `README.md` and `PRIVACY.md`.

> [!NOTE] Scope, and a deliberate boundary
> This page records **findings about this repository's code**. The companion
> analysis quotes Bruno's actual career data to show what came out of the
> generator and what went in, and `CLAUDE.md` bars that material from this
> public repo — so it belongs in `F:\Dev\Profile`, not here, and this page
> reproduces none of it. **The two documents are deliberately not copies of each
> other.** If you need the worked example, go and find the Profile-side
> document; everything you need to change the code is here.
>
> ⚠️ **As of 2026-10-03 the Profile-side document (`quiver-profile-format-analysis.md`)
> could not be located on disk.** It was written to a session scratch folder that
> no longer exists, so it was never moved into `Profile/`. **It needs
> regenerating.** This page is not a substitute for it: the worked
> input-versus-output comparison is the evidence, and it is not reproduced here.

---

## Why this page exists

`CLAUDE.md` states the defect plainly: the generator fabricates credentials,
overriding supplied context with priors about what a CV should look like.
Correct qualifications and titles go in, different ones come out.

The question this analysis asked was narrower and more useful: **where exactly
in the code does a fabricated claim become possible, and which of those places
is cheapest to close?** The answer is four distinct surfaces, and they are
independent — closing one does not close the others.

---

## 1. The profile enters the prompt verbatim

The single most important structural fact, and the one that invalidates a
category of proposals before they are made.

In all five call sites — `jobAnalysisService.ts` (analysis and follow-up),
`cvBuilderService.ts` (generate and edit), `clBuilderService.ts` — the profile
markdown is **string-interpolated into a user message under a
`## Candidate profile` heading**:

```ts
{ role: "user", content: `## Candidate profile\n\n${profileMarkdown}${jobPart}` }
```

**There is no parsing, no chunking, no summarisation, and no extraction.** The
profile is one opaque string from the editor to the model.

**There is no consumer anywhere in the codebase for structural markers in the
profile.** Nothing reads a tag, a field name, a delimiter or a front-matter
block out of the profile text. Any structure a profile carries is structure
*only the model sees*, and the model treats it as prose like everything else.

> [!IMPORTANT] This is why an earlier tagged-profile format failed, and it is
> the key fact for anyone proposing another one.
> A format whose benefit depends on code honouring it will deliver nothing,
> because no such code exists. A tagged format can still help — but only to the
> extent that the *model* reads tags more reliably than prose, which is a
> prompt-engineering bet, not an architectural change. Anyone proposing a new
> profile format should state which of those two things they are claiming. The
> first requires writing a consumer; the second requires measuring.

---

## 2. The few-shot examples contain the fabrications

Examples in the prompt are the most imitable text in the context. Two of them
contain exactly the shapes that come out of the generator.

### `CL_JSON_FORMAT` — `prompts.ts:255`

The first example body paragraph reads, in part:

> *"With 8 years of experience in full-stack development, I have honed skills in
> React, Node.js, and cloud architecture that align closely with the
> requirements of this role."*

The structure is the problem, not the content: **one depth claim governing a
three-item list whose last item is a broad architectural domain.** A model
copying this sentence's shape produces a quantified claim of depth attached to
whatever three things are nearest to hand, with the vaguest one last.

**This is the direct template for a false claim generated on 2026-10-02.** The
generated sentence was the same shape with substituted nouns. The example is not
*a* source of that fabrication; it is the pattern it was copied from.

### `CV_JSON_FORMAT` — `prompts.ts:71`

The education example:

```json
{ "degree": "BSc Computer Science", "institution": "MIT", "period": "2012-2016" }
```

**`"MIT"` and `"BSc Computer Science"` are still in the file.** They sit
**above** the rule at `prompts.ts:90`:

```
- Be FACTUAL — only include information from the profile
```

So the prompt contains a concrete, plausible, prestigious degree-and-institution
pair and, nineteen lines later, an instruction not to invent one. The
instruction is abstract and the example is concrete. Conferred-degree claims are
the single highest-severity class of false claim in this workspace — mechanically
checkable, and capable of ending a process on its own — and the prompt supplies
a ready-made one.

---

## 3. There is no schema enforcement anywhere

Verified across all four adapters (`OpenAICompatibleAdapter`,
`AnthropicAdapter`, `GeminiAdapter`, `WebLLMAdapter`): **no `response_format`,
no `responseSchema`, no `json_schema`, no tool/function calling, no grammar or
GBNF constraint.** The grep returns nothing in `src/`.

What happens instead:

1. **JSON is requested in prose** — `"You MUST return ONLY a valid JSON
   object"`, plus an example.
2. **It is extracted by brace matching** — `extractJsonObject()` in
   `utils/jsonParse.ts`, which finds the outermost `{`…`}` and parses it. This
   exists because models wrapped output in markdown fences (bug #9).
3. **It is retried up to four attempts** (`MAX_RETRIES = 3`), and from the third
   attempt the failed output is fed back with *"Fix the JSON formatting error
   above"*.
4. **Retries fire on syntax errors only.** The retry condition is a thrown parse
   error. Semantically perfect JSON containing a fabricated degree parses on the
   first attempt and is returned.

> [!IMPORTANT] **No code anywhere compares generated output against the profile.**
> A fabricated claim is not an error condition in this codebase. It parses as
> success, renders, and exports.

---

## 4. Two channels with no precedence rule

### The posting and the profile arrive together

Both services concatenate them into **one user message**:

```
## Candidate profile
<profile markdown>

## Job description
<posting text>
```

Nothing in the system prompt says which of the two is a source of facts about
the candidate and which is a target to aim at. Two bodies of plausible
professional prose sit adjacent and undifferentiated, and the posting is the one
written to describe an ideal person. The failure mode this invites is the
posting's requirements migrating into the candidate's history, which is exactly
the observed behaviour.

### The second channel: a draft re-injected as authority

`clBuilderService.ts:49` appends the analysis stage's `coverLetterDraft` as:

```
## Draft to refine (from job analysis)
<seedDraft>
```

This is the more dangerous of the two, for three reasons:

1. **It is unverified LLM output.** The analysis stage's draft was generated
   under the same conditions as everything else here and was never checked
   against the profile.
2. **It arrives as authoritative prose**, framed as a thing to refine rather
   than a thing to question. "Refine" instructs the model to preserve content.
3. **It is closest to the point of generation.** A first-pass error entering
   this way is not a claim the model has to invent — it is a claim already
   written down in the context, in finished prose, that the model is being asked
   to polish.

So a fabrication introduced at analysis time is **laundered into the final
letter** with no step in between that could catch it.

---

## 5. Proposed changes

> [!WARNING] Proposals, not decisions. Nothing below is implemented.

### The constraint that governs all of them

**This tool is meant to stay light and run on a small model — gemma 4 e4b class.**
That is a product decision, not a limitation to engineer around, and it changes
which fixes are worth making:

- **A small model copies nearby plausible phrasing more readily than a large
  one.** So **prompt hygiene matters more here, not less.** The few-shot content
  in §2 is a bigger liability on a small model than it would be on a frontier
  one.
- **Any LLM-based verifier would be as weak as the generator.** Asking the same
  class of model to audit its own output buys the appearance of a check.

### Proposed

1. **Strip the contaminating few-shot content.** Remove `"MIT"`, `"BSc Computer
   Science"` and the `8 years … React, Node.js, and cloud architecture`
   sentence. Cheapest change on this page and it removes the two documented
   templates.
2. **Make the examples structurally uncopyable.** Replace realistic values with
   obvious placeholders (`"<degree from profile>"`, `"<institution from
   profile>"`) so the example teaches **shape** and cannot supply **content**.
   Keep the shape — bug #10 is a reminder that a clear example is what got the
   model producing valid sections at all; the schema example must not be
   removed, only drained.
3. **Add one line of precedence** to the system prompts: *the candidate profile
   is the only source of facts about the candidate; the job posting is the target
   to address, never a source of the candidate's history.* One sentence, both
   builders, and it names the §4 failure mode directly instead of relying on
   `Be FACTUAL`.
4. **Stop re-injecting unverified prose.** Either drop the `## Draft to refine`
   channel, or mark it explicitly as unverified draft text whose claims must be
   re-derived from the profile. Dropping it is the honest option; the draft's
   value was convenience.
5. **Wire `validate_claims.py` into the output path as a deterministic flag,
   not a gate.** An implementation already exists at
   `F:\Dev\Profile\scripts\validate_claims.py`, outside this repo, and already
   enforces the two mechanically checkable rules that matter most
   (`degree-conferred`, `bachiller-mistranslation`). A flag surfaces a suspect
   claim next to the generated text and leaves the decision with the user; a
   gate that blocks generation would make a false positive cost an entire
   output. **Note the repo boundary: the script lives outside this public repo
   and the wiring has to respect that** — this is an integration question, not a
   copy-the-file question, and it is unresolved.

### Considered and rejected

**Schema enforcement** (`response_format` / `responseSchema` / grammars).
**Rejected: provider support varies and local inference is the target.** The
four adapters span OpenAI-compatible servers, Anthropic, Gemini and WebLLM, and
structured-output support differs across all four and across local server
versions. Building on it means either a feature-detection matrix or a quietly
degraded path on the configuration Quiver is actually for. And it would not help
here anyway: **the failure is semantic, not syntactic.** A schema guarantees
`{"institution": "MIT"}` is well-formed. It has nothing to say about whether it
is true.

**A second LLM verification pass.** **Rejected: it doubles cost to have a weak
model audit itself.** On a small local model that is two slow generations
instead of one, and the auditor shares the generator's priors about what a CV
should look like — the exact priors causing the defect. A deterministic check
(proposal 5) catches the highest-severity class reliably and for free.

---

## 6. Stale documentation found on the way

Both are in this vault, both would mislead an agent, and **neither is fixed.**

**`60-Roadmap/Public Beta Release.md`** (`last_updated: 2026-08-05`) still
describes the distribution strategy as a separate public artifacts repo,
`Arthias/Artemis-Quiver-Releases`, with the source repo staying private. Both
halves are now wrong: **`CLAUDE.md` records that releases repo as archived**,
releases are published on this repo via `.github/workflows/release.yml`, and
**this repo is public.** The whole "without making the repo public" premise of
the document is gone. `release/README.md` still links to the archived repo's
releases page too.

**`20-APIs/AI Prompt Templates.md`** (`last_updated: 2026-06-13`) documents
**ten CV optimization modes** and a **`classifyEditIntent()`** function. Neither
exists. `OptimizationMode` in `prompts.ts:13` is a three-member union —
`"standard" | "ats-optimize" | "audit"` — and `prompts.ts` carries a comment
explaining that only `standard` is reachable from the UI and that two of the
removed modes explicitly told the model to embellish. `classifyEditIntent`
returns no matches anywhere in `src/`.

That second one matters more than it looks: it is a prompt-engineering reference
describing prompts that were **deliberately deleted because they instructed
fabrication**, which makes it a document that could get them reinstated.

---

## Related

- [[AI Prompt Templates|Prompt Engineering Specs]] — **stale, see §6**
- [[../30-Features/Document Builders|CV & Cover Letter Builders]]
- [[../30-Bugs-and-Fixes/_Index|Bug Fixes Log]] — bugs #9, #10 and #31 are the
  history behind §3's brace-matching and retry design
