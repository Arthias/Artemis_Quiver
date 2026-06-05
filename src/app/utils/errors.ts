enum ErrorDomain {
  LLM = "LLM",
  CV = "CV",
  CL = "CL",
  ANALYSIS = "ANALYSIS",
  PROFILE = "PROFILE",
  NETWORK = "NETWORK",
  APP = "APP",
}

enum ErrorSeverity {
  CRITICAL = "CRITICAL",
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

export interface ErrorRecord {
  code: string;
  domain: ErrorDomain;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryStrategy?: "immediate" | "corrective" | "backoff";
  httpStatus?: number;
  /** Hint for developers on root cause / fix */
  debugHint?: string;
}

export const ErrorCodes = {
  // ── LLM / AI Provider ──────────────────────────────────────────────
  LLM_API_FAILURE: "ERR_LLM_API_FAILURE",
  LLM_EMPTY_RESPONSE: "ERR_LLM_EMPTY_RESPONSE",
  LLM_TIMEOUT: "ERR_LLM_TIMEOUT",
  LLM_CONNECTION_REFUSED: "ERR_LLM_CONNECTION_REFUSED",

  // ── CV Builder ─────────────────────────────────────────────────────
  CV_JSON_PARSE: "ERR_CV_JSON_PARSE",
  CV_SCHEMA_INVALID: "ERR_CV_SCHEMA_INVALID",
  CV_GENERATION_FAILED: "ERR_CV_GENERATION_FAILED",

  // ── Cover Letter Builder ───────────────────────────────────────────
  CL_GENERATION_FAILED: "ERR_CL_GENERATION_FAILED",
  CL_EDIT_FAILED: "ERR_CL_EDIT_FAILED",

  // ── Job Analysis ───────────────────────────────────────────────────
  ANALYSIS_FAILED: "ERR_ANALYSIS_FAILED",
  ANALYSIS_FOLLOWUP_FAILED: "ERR_ANALYSIS_FOLLOWUP_FAILED",

  // ── Profile ────────────────────────────────────────────────────────
  PROFILE_MERGE_FAILED: "ERR_PROFILE_MERGE_FAILED",
  PROFILE_CHAT_FAILED: "ERR_PROFILE_CHAT_FAILED",

  // ── Network ────────────────────────────────────────────────────────
  NETWORK_TIMEOUT: "ERR_NETWORK_TIMEOUT",
  NETWORK_ABORTED: "ERR_NETWORK_ABORTED",

  // ── Generic ────────────────────────────────────────────────────────
  UNKNOWN: "ERR_UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const ERROR_CATALOG: Record<ErrorCode, ErrorRecord> = {
  // ── LLM ────────────────────────────────────────────────────────────
  [ErrorCodes.LLM_API_FAILURE]: {
    code: ErrorCodes.LLM_API_FAILURE,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.ERROR,
    message: "LLM API request failed",
    userMessage: "The AI model server returned an error. Check Settings > Test connection.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Check provider URL, model name, and that the server is running.",
  },
  [ErrorCodes.LLM_EMPTY_RESPONSE]: {
    code: ErrorCodes.LLM_EMPTY_RESPONSE,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.ERROR,
    message: "LLM returned an empty response",
    userMessage: "The AI model returned an empty response. Try again.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Model may have been unloaded or hit a context limit.",
  },
  [ErrorCodes.LLM_TIMEOUT]: {
    code: ErrorCodes.LLM_TIMEOUT,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.ERROR,
    message: "LLM request timed out",
    userMessage: "The request timed out. Try a shorter job description or check your model is responsive.",
    retryable: true,
    retryStrategy: "backoff",
    debugHint: "Profile or job description may be too long for the model context window.",
  },
  [ErrorCodes.LLM_CONNECTION_REFUSED]: {
    code: ErrorCodes.LLM_CONNECTION_REFUSED,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.CRITICAL,
    message: "LLM server connection refused",
    userMessage: "Cannot connect to the AI model. Make sure the server is running and check Settings.",
    retryable: true,
    retryStrategy: "backoff",
    debugHint: "Server may be down or URL/port is misconfigured.",
  },

  // ── CV ─────────────────────────────────────────────────────────────
  [ErrorCodes.CV_JSON_PARSE]: {
    code: ErrorCodes.CV_JSON_PARSE,
    domain: ErrorDomain.CV,
    severity: ErrorSeverity.ERROR,
    message: "CV JSON parse failure from model response",
    userMessage: "The AI model returned an invalid format. Try adjusting your profile or job description.",
    retryable: true,
    retryStrategy: "corrective",
    debugHint: "Model output could not be parsed as JSON. Check raw response for truncation or trailing commas.",
  },
  [ErrorCodes.CV_SCHEMA_INVALID]: {
    code: ErrorCodes.CV_SCHEMA_INVALID,
    domain: ErrorDomain.CV,
    severity: ErrorSeverity.ERROR,
    message: "CV JSON failed schema validation",
    userMessage: "The AI model generated a CV that doesn't match the expected structure. Try again.",
    retryable: true,
    retryStrategy: "corrective",
    debugHint: "Missing required fields (name, sections) or unknown section types.",
  },
  [ErrorCodes.CV_GENERATION_FAILED]: {
    code: ErrorCodes.CV_GENERATION_FAILED,
    domain: ErrorDomain.CV,
    severity: ErrorSeverity.ERROR,
    message: "CV generation failed after all retries",
    userMessage: "CV generation failed after multiple attempts. Try a shorter profile or job description.",
    retryable: false,
    debugHint: "All 4 attempts failed. Model may not support structured JSON output well.",
  },

  // ── CL ─────────────────────────────────────────────────────────────
  [ErrorCodes.CL_GENERATION_FAILED]: {
    code: ErrorCodes.CL_GENERATION_FAILED,
    domain: ErrorDomain.CL,
    severity: ErrorSeverity.ERROR,
    message: "Cover letter generation failed",
    userMessage: "Cover letter generation failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.CL_EDIT_FAILED]: {
    code: ErrorCodes.CL_EDIT_FAILED,
    domain: ErrorDomain.CL,
    severity: ErrorSeverity.ERROR,
    message: "Cover letter edit failed",
    userMessage: "Could not apply changes to the cover letter. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },

  // ── Analysis ───────────────────────────────────────────────────────
  [ErrorCodes.ANALYSIS_FAILED]: {
    code: ErrorCodes.ANALYSIS_FAILED,
    domain: ErrorDomain.ANALYSIS,
    severity: ErrorSeverity.ERROR,
    message: "Job analysis failed",
    userMessage: "Job analysis failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.ANALYSIS_FOLLOWUP_FAILED]: {
    code: ErrorCodes.ANALYSIS_FOLLOWUP_FAILED,
    domain: ErrorDomain.ANALYSIS,
    severity: ErrorSeverity.ERROR,
    message: "Analysis follow-up chat failed",
    userMessage: "Failed to get a response. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },

  // ── Profile ────────────────────────────────────────────────────────
  [ErrorCodes.PROFILE_MERGE_FAILED]: {
    code: ErrorCodes.PROFILE_MERGE_FAILED,
    domain: ErrorDomain.PROFILE,
    severity: ErrorSeverity.ERROR,
    message: "Profile merge failed",
    userMessage: "Could not merge the profile. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.PROFILE_CHAT_FAILED]: {
    code: ErrorCodes.PROFILE_CHAT_FAILED,
    domain: ErrorDomain.PROFILE,
    severity: ErrorSeverity.ERROR,
    message: "Profile assistant chat failed",
    userMessage: "Assistant response failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },

  // ── Network ────────────────────────────────────────────────────────
  [ErrorCodes.NETWORK_TIMEOUT]: {
    code: ErrorCodes.NETWORK_TIMEOUT,
    domain: ErrorDomain.NETWORK,
    severity: ErrorSeverity.ERROR,
    message: "Network request timed out",
    userMessage: "The request timed out. Check your connection and try again.",
    retryable: true,
    retryStrategy: "backoff",
  },
  [ErrorCodes.NETWORK_ABORTED]: {
    code: ErrorCodes.NETWORK_ABORTED,
    domain: ErrorDomain.NETWORK,
    severity: ErrorSeverity.WARNING,
    message: "Network request was aborted",
    userMessage: "The request was cancelled.",
    retryable: true,
    retryStrategy: "immediate",
  },

  // ── Generic ────────────────────────────────────────────────────────
  [ErrorCodes.UNKNOWN]: {
    code: ErrorCodes.UNKNOWN,
    domain: ErrorDomain.APP,
    severity: ErrorSeverity.ERROR,
    message: "An unexpected error occurred",
    userMessage: "Something went wrong. Try again.",
    retryable: false,
    debugHint: "Uncategorized error — check the caught exception for details.",
  },
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly domain: ErrorDomain;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly retryStrategy: "immediate" | "corrective" | "backoff" | undefined;
  public readonly record: ErrorRecord;
  public readonly timestamp: number;
  public metadata: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, metadata?: Record<string, unknown>) {
    const record = ERROR_CATALOG[code];
    if (!record) {
      throw new Error(`[AppError] Unknown error code: ${code}. Register it in ERROR_CATALOG.`);
    }
    super(message ?? record.message);
    this.name = "AppError";
    this.code = code;
    this.domain = record.domain;
    this.severity = record.severity;
    this.retryable = record.retryable;
    this.retryStrategy = record.retryStrategy;
    this.record = record;
    this.timestamp = Date.now();
    this.metadata = metadata ?? {};
  }

  get userMessage(): string {
    return this.record.userMessage;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      domain: this.domain,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      retryable: this.retryable,
      timestamp: this.timestamp,
      metadata: this.metadata,
    };
  }
}
