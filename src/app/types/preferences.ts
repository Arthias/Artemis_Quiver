// The profile's two derived layers (Profile-Management-Spec §3): the
// preferences card and the fingerprint, plus the Flow run settings Quiver owns
// and sends in PUT /api/sync. Every preference is unset by default; unset
// means no filtering.
import { z } from "zod";

export const LEVELS = ["entry", "mid", "senior", "staff_principal", "manager", "director_plus"] as const;
export type Level = (typeof LEVELS)[number];

/** null = no opinion; true = anywhere reachable; false = never; list = only these places. */
const ModeSettingSchema = z.union([z.boolean(), z.array(z.string())]).nullable().default(null);

const LanguageSchema = z.object({
  name: z.string().min(1),
  /** CEFR (A1–C2), "native", or free text; null = not stated. */
  level: z.string().nullable().default(null),
});

export const ProfilePreferencesSchema = z.object({
  home_country: z.string().nullable().default(null),
  work_authorisation: z.array(z.string()).default([]),
  remote_from: z.array(z.string()).default([]),
  relocation_countries: z.array(z.string()).default([]),
  work_modes: z
    .object({ remote: ModeSettingSchema, hybrid: ModeSettingSchema, onsite: ModeSettingSchema })
    .default({ remote: null, hybrid: null, onsite: null }),
  // Flow and older data store plain names; both are read.
  languages: z
    .array(z.union([z.string().transform((name) => ({ name, level: null })), LanguageSchema]))
    .default([]),
  has_degree: z.boolean().nullable().default(null),
  fields: z.array(z.string()).default([]),
  levels: z.array(z.enum(LEVELS)).default([]),
  skills: z.array(z.string()).default([]),
  years: z.number().nonnegative().nullable().default(null),
  domains: z.array(z.string()).default([]),
  /** Alignment row weights; null = Flow's defaults. */
  weights: z.record(z.string(), z.number()).nullable().default(null),
  schema_version: z.literal(1).default(1),
});

export type ProfilePreferences = z.infer<typeof ProfilePreferencesSchema>;
export type ProfileLanguage = ProfilePreferences["languages"][number];
export type ModeSetting = ProfilePreferences["work_modes"]["remote"];

export const emptyPreferences = (): ProfilePreferences => ProfilePreferencesSchema.parse({});

/** A layer built from another one: by hand, or generated and not edited since. */
export interface Layer<T> {
  value: T;
  origin: "manual" | "generated";
  /** Hash of the source when this was built or last edited (master markdown for
   * preferences, preferences JSON for the fingerprint). Stale when it differs. */
  sourceHash: string;
  updatedAt: string;
}

export const FINGERPRINT_MAX = 300;

export interface FlowBacklogSettings {
  soft_cap: number | null;
  hard_cap: number | null;
  /** Hard cap's score bar; null = archive_score_threshold. */
  hard_cap_min_score: number | null;
  archive_retention_days: number;
  archive_score_threshold: number;
  stale_new_days: number | null;
  skip_aggregator_boards: boolean;
}

/** Everything Flow needs to run, owned here and sent in the sync bundle. */
export interface FlowRunConfig {
  /** Which of Quiver's endpoints Flow uses. */
  llmEndpoint: "primary" | "secondary";
  /** Separate models for Flow's cheap and full scoring passes; empty = the endpoint's model. */
  softModel: string;
  hardModel: string;
  backlog: FlowBacklogSettings;
  apply: { daily_cap: number | null; review_by: string | null };
  prescore: { enabled: boolean; threshold: number };
}

/** Flow's own defaults, so a fresh install behaves the same either side. */
export const defaultFlowRunConfig = (): FlowRunConfig => ({
  llmEndpoint: "primary",
  softModel: "",
  hardModel: "",
  backlog: {
    soft_cap: 50,
    hard_cap: 150,
    hard_cap_min_score: null,
    archive_retention_days: 30,
    archive_score_threshold: 20,
    stale_new_days: null,
    skip_aggregator_boards: false,
  },
  apply: { daily_cap: null, review_by: null },
  prescore: { enabled: false, threshold: 60 },
});
