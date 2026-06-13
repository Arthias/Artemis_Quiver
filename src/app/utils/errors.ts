export enum ErrorDomain {
  APP = "APP",
  NETWORK = "NETWORK",
  LLM = "LLM",
  DB = "DB",
  EXTENSION = "EXTENSION",
  CV = "CV",
  CL = "CL",
  ANALYSIS = "ANALYSIS",
  PROFILE = "PROFILE",
}

export enum ErrorSeverity {
  CRITICAL = "CRITICAL",
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

/**
 * Numeric codes provide a decision-tree hierarchy:
 *   1xx — App / generic
 *   2xx — Network
 *   3xx — LLM
 *   4xx — Database / Storage
 *   5xx — Extension
 *   6xx — Parsing / Builders
 */
export enum ErrorNumeric {
  // Generic (1xx)
  GENERIC = 100,
  CONFIG_INVALID = 110,

  // Network (2xx)
  NETWORK_TIMEOUT = 200,
  NETWORK_ABORTED = 201,
  NETWORK_DOWN = 202,

  // LLM (3xx)
  LLM_API_FAILURE = 300,
  LLM_EMPTY_RESPONSE = 301,
  LLM_TIMEOUT = 302,
  LLM_CONNECTION_REFUSED = 303,
  LLM_MODEL_LOAD_FAILED = 304,
  LLM_CONFIG_MISSING = 305,
  LLM_RATE_LIMIT = 306,
  LLM_CONTENT_FILTERED = 307,

  // DB (4xx)
  DB_INIT_FAILED = 400,
  DB_READ_FAILED = 401,
  DB_WRITE_FAILED = 402,
  DB_DELETE_FAILED = 403,
  DB_NOT_FOUND = 404,
  DB_RECORD_LIMIT = 405,

  // Extension (5xx)
  EXT_NOT_ACTIVE = 500,
  EXT_TAB_NOT_FOUND = 501,
  EXT_PERMISSION_DENIED = 502,
  EXT_IMPORT_FAILED = 503,
  EXT_OPEN_APP_FAILED = 504,
  EXT_OVERLAY_INJECT_FAILED = 505,
  EXT_LLM_SCORE_FAILED = 506,
  EXT_FINGERPRINT_FAILED = 507,

  // Builder / Parser (6xx)
  CV_JSON_PARSE = 600,
  CV_SCHEMA_INVALID = 601,
  CV_GENERATION_FAILED = 602,
  CL_GENERATION_FAILED = 603,
  CL_EDIT_FAILED = 604,
  ANALYSIS_FAILED = 605,
  ANALYSIS_FOLLOWUP_FAILED = 606,
  PROFILE_MERGE_FAILED = 607,
  PROFILE_CHAT_FAILED = 608,
}

export interface ErrorRecord {
  code: string;
  numericCode: ErrorNumeric;
  domain: ErrorDomain;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  userMessageKey?: string;
  retryable: boolean;
  retryStrategy?: "immediate" | "corrective" | "backoff";
  httpStatus?: number;
  /** Hint for developers on root cause / fix */
  debugHint?: string;
}

export const ErrorCodes = {
  // ── Generic ─────────────────────────────────────────────────────────
  CONFIG_INVALID: "ERR_CONFIG_INVALID",

  // ── Network ─────────────────────────────────────────────────────────
  NETWORK_TIMEOUT: "ERR_NETWORK_TIMEOUT",
  NETWORK_ABORTED: "ERR_NETWORK_ABORTED",
  NETWORK_DOWN: "ERR_NETWORK_DOWN",

  // ── LLM / AI Provider ──────────────────────────────────────────────
  LLM_API_FAILURE: "ERR_LLM_API_FAILURE",
  LLM_EMPTY_RESPONSE: "ERR_LLM_EMPTY_RESPONSE",
  LLM_TIMEOUT: "ERR_LLM_TIMEOUT",
  LLM_CONNECTION_REFUSED: "ERR_LLM_CONNECTION_REFUSED",
  LLM_MODEL_LOAD_FAILED: "ERR_LLM_MODEL_LOAD_FAILED",
  LLM_CONFIG_MISSING: "ERR_LLM_CONFIG_MISSING",
  LLM_RATE_LIMIT: "ERR_LLM_RATE_LIMIT",
  LLM_CONTENT_FILTERED: "ERR_LLM_CONTENT_FILTERED",

  // ── Database ────────────────────────────────────────────────────────
  DB_INIT_FAILED: "ERR_DB_INIT_FAILED",
  DB_READ_FAILED: "ERR_DB_READ_FAILED",
  DB_WRITE_FAILED: "ERR_DB_WRITE_FAILED",
  DB_DELETE_FAILED: "ERR_DB_DELETE_FAILED",
  DB_NOT_FOUND: "ERR_DB_NOT_FOUND",
  DB_RECORD_LIMIT: "ERR_DB_RECORD_LIMIT",

  // ── Extension ───────────────────────────────────────────────────────
  EXT_NOT_ACTIVE: "ERR_EXT_NOT_ACTIVE",
  EXT_TAB_NOT_FOUND: "ERR_EXT_TAB_NOT_FOUND",
  EXT_PERMISSION_DENIED: "ERR_EXT_PERMISSION_DENIED",
  EXT_IMPORT_FAILED: "ERR_EXT_IMPORT_FAILED",
  EXT_OPEN_APP_FAILED: "ERR_EXT_OPEN_APP_FAILED",
  EXT_OVERLAY_INJECT_FAILED: "ERR_EXT_OVERLAY_INJECT_FAILED",
  EXT_LLM_SCORE_FAILED: "ERR_EXT_LLM_SCORE_FAILED",
  EXT_FINGERPRINT_FAILED: "ERR_EXT_FINGERPRINT_FAILED",

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

  // ── Generic ────────────────────────────────────────────────────────
  UNKNOWN: "ERR_UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const ERROR_CATALOG: Record<ErrorCode, ErrorRecord> = {
  // ── Generic ─────────────────────────────────────────────────────────
  [ErrorCodes.CONFIG_INVALID]: {
    code: ErrorCodes.CONFIG_INVALID,
    numericCode: ErrorNumeric.CONFIG_INVALID,
    domain: ErrorDomain.APP,
    severity: ErrorSeverity.ERROR,
    message: "Invalid configuration",
    userMessage: "A setting is invalid. Check the configuration page.",
    retryable: false,
    debugHint: "Missing or malformed required config values.",
  },

  // ── Network ─────────────────────────────────────────────────────────
  [ErrorCodes.NETWORK_TIMEOUT]: {
    code: ErrorCodes.NETWORK_TIMEOUT,
    numericCode: ErrorNumeric.NETWORK_TIMEOUT,
    domain: ErrorDomain.NETWORK,
    severity: ErrorSeverity.ERROR,
    message: "Network request timed out",
    userMessage: "The request timed out. Check your connection and try again.",
    retryable: true,
    retryStrategy: "backoff",
  },
  [ErrorCodes.NETWORK_ABORTED]: {
    code: ErrorCodes.NETWORK_ABORTED,
    numericCode: ErrorNumeric.NETWORK_ABORTED,
    domain: ErrorDomain.NETWORK,
    severity: ErrorSeverity.WARNING,
    message: "Network request was aborted",
    userMessage: "The request was cancelled.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.NETWORK_DOWN]: {
    code: ErrorCodes.NETWORK_DOWN,
    numericCode: ErrorNumeric.NETWORK_DOWN,
    domain: ErrorDomain.NETWORK,
    severity: ErrorSeverity.CRITICAL,
    message: "Network is unreachable",
    userMessage: "No internet connection. Check your network.",
    retryable: true,
    retryStrategy: "backoff",
  },

  // ── LLM ────────────────────────────────────────────────────────────
  [ErrorCodes.LLM_API_FAILURE]: {
    code: ErrorCodes.LLM_API_FAILURE,
    numericCode: ErrorNumeric.LLM_API_FAILURE,
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
    numericCode: ErrorNumeric.LLM_EMPTY_RESPONSE,
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
    numericCode: ErrorNumeric.LLM_TIMEOUT,
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
    numericCode: ErrorNumeric.LLM_CONNECTION_REFUSED,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.CRITICAL,
    message: "LLM server connection refused",
    userMessage: "Cannot connect to the AI model. Make sure the server is running and check Settings.",
    retryable: true,
    retryStrategy: "backoff",
    debugHint: "Server may be down or URL/port is misconfigured.",
  },
  [ErrorCodes.LLM_MODEL_LOAD_FAILED]: {
    code: ErrorCodes.LLM_MODEL_LOAD_FAILED,
    numericCode: ErrorNumeric.LLM_MODEL_LOAD_FAILED,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.CRITICAL,
    message: "LLM model failed to load",
    userMessage: "The AI model could not be loaded. Try a different model or restart the server.",
    retryable: true,
    retryStrategy: "corrective",
    debugHint: "Model file may be corrupt, GPU out of memory, or model name is incorrect.",
  },
  [ErrorCodes.LLM_CONFIG_MISSING]: {
    code: ErrorCodes.LLM_CONFIG_MISSING,
    numericCode: ErrorNumeric.LLM_CONFIG_MISSING,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.ERROR,
    message: "LLM endpoint not configured",
    userMessage: "No AI provider is configured. Go to Settings to set up an LLM endpoint.",
    retryable: false,
    debugHint: "Primary or secondary endpoint URL/model are empty.",
  },
  [ErrorCodes.LLM_RATE_LIMIT]: {
    code: ErrorCodes.LLM_RATE_LIMIT,
    numericCode: ErrorNumeric.LLM_RATE_LIMIT,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.WARNING,
    message: "LLM rate limit exceeded",
    userMessage: "Too many requests. Wait a moment and try again.",
    retryable: true,
    retryStrategy: "backoff",
    debugHint: "Server returned 429 or connection was throttled.",
  },
  [ErrorCodes.LLM_CONTENT_FILTERED]: {
    code: ErrorCodes.LLM_CONTENT_FILTERED,
    numericCode: ErrorNumeric.LLM_CONTENT_FILTERED,
    domain: ErrorDomain.LLM,
    severity: ErrorSeverity.WARNING,
    message: "LLM response was filtered",
    userMessage: "The response was blocked by content filters. Try rephrasing your request.",
    retryable: false,
    debugHint: "Cloud provider content safety filter triggered.",
  },

  // ── Database ────────────────────────────────────────────────────────
  [ErrorCodes.DB_INIT_FAILED]: {
    code: ErrorCodes.DB_INIT_FAILED,
    numericCode: ErrorNumeric.DB_INIT_FAILED,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.CRITICAL,
    message: "Database initialization failed",
    userMessage: "Could not initialize storage. Try clearing browser data for this site.",
    retryable: false,
    debugHint: "IndexedDB may be unavailable or corrupted.",
  },
  [ErrorCodes.DB_READ_FAILED]: {
    code: ErrorCodes.DB_READ_FAILED,
    numericCode: ErrorNumeric.DB_READ_FAILED,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.ERROR,
    message: "Database read failed",
    userMessage: "Could not read data. Try reloading the page.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Dexie query failed — check schema version compatibility.",
  },
  [ErrorCodes.DB_WRITE_FAILED]: {
    code: ErrorCodes.DB_WRITE_FAILED,
    numericCode: ErrorNumeric.DB_WRITE_FAILED,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.ERROR,
    message: "Database write failed",
    userMessage: "Could not save data. Try again.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Put/add operation failed — possibly a quota issue.",
  },
  [ErrorCodes.DB_DELETE_FAILED]: {
    code: ErrorCodes.DB_DELETE_FAILED,
    numericCode: ErrorNumeric.DB_DELETE_FAILED,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.ERROR,
    message: "Database delete failed",
    userMessage: "Could not delete data. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.DB_NOT_FOUND]: {
    code: ErrorCodes.DB_NOT_FOUND,
    numericCode: ErrorNumeric.DB_NOT_FOUND,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.WARNING,
    message: "Record not found in database",
    userMessage: "The requested record was not found. It may have been deleted.",
    retryable: false,
    debugHint: "Key lookup returned undefined — data may have been evicted.",
  },
  [ErrorCodes.DB_RECORD_LIMIT]: {
    code: ErrorCodes.DB_RECORD_LIMIT,
    numericCode: ErrorNumeric.DB_RECORD_LIMIT,
    domain: ErrorDomain.DB,
    severity: ErrorSeverity.WARNING,
    message: "Record limit reached",
    userMessage: "Maximum number of records reached. Old records are being cleaned up.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "LRU eviction triggered or batch write hit capacity.",
  },

  // ── Extension ───────────────────────────────────────────────────────
  [ErrorCodes.EXT_NOT_ACTIVE]: {
    code: ErrorCodes.EXT_NOT_ACTIVE,
    numericCode: ErrorNumeric.EXT_NOT_ACTIVE,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.WARNING,
    message: "Extension context not active",
    userMessage: "The extension is not active on this page.",
    retryable: false,
  },
  [ErrorCodes.EXT_TAB_NOT_FOUND]: {
    code: ErrorCodes.EXT_TAB_NOT_FOUND,
    numericCode: ErrorNumeric.EXT_TAB_NOT_FOUND,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.WARNING,
    message: "Extension could not find the app tab",
    userMessage: "Open Artemis Quiver in a tab first, then try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.EXT_PERMISSION_DENIED]: {
    code: ErrorCodes.EXT_PERMISSION_DENIED,
    numericCode: ErrorNumeric.EXT_PERMISSION_DENIED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "Extension permission denied",
    userMessage: "The extension does not have permission to access this page.",
    retryable: false,
  },
  [ErrorCodes.EXT_IMPORT_FAILED]: {
    code: ErrorCodes.EXT_IMPORT_FAILED,
    numericCode: ErrorNumeric.EXT_IMPORT_FAILED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "Extension import failed",
    userMessage: "Could not import job data from the page. Try copying the text manually.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Page content extraction returned empty or tab communication failed.",
  },
  [ErrorCodes.EXT_OPEN_APP_FAILED]: {
    code: ErrorCodes.EXT_OPEN_APP_FAILED,
    numericCode: ErrorNumeric.EXT_OPEN_APP_FAILED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "Could not open app tab",
    userMessage: "Could not open the main app. Try opening it manually.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.EXT_OVERLAY_INJECT_FAILED]: {
    code: ErrorCodes.EXT_OVERLAY_INJECT_FAILED,
    numericCode: ErrorNumeric.EXT_OVERLAY_INJECT_FAILED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "Overlay injection failed",
    userMessage: "Could not inject the overlay into the page.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "Script injection may be blocked by CSP or permissions.",
  },
  [ErrorCodes.EXT_LLM_SCORE_FAILED]: {
    code: ErrorCodes.EXT_LLM_SCORE_FAILED,
    numericCode: ErrorNumeric.EXT_LLM_SCORE_FAILED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "LLM scoring from extension failed",
    userMessage: "Could not get a match score from the extension. Check Settings.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.EXT_FINGERPRINT_FAILED]: {
    code: ErrorCodes.EXT_FINGERPRINT_FAILED,
    numericCode: ErrorNumeric.EXT_FINGERPRINT_FAILED,
    domain: ErrorDomain.EXTENSION,
    severity: ErrorSeverity.ERROR,
    message: "Fingerprint generation failed",
    userMessage: "Could not generate a profile fingerprint. Make sure you have a saved profile.",
    retryable: true,
    retryStrategy: "immediate",
    debugHint: "LLM call or profile data retrieval failed from extension context.",
  },

  // ── CV ─────────────────────────────────────────────────────────────
  [ErrorCodes.CV_JSON_PARSE]: {
    code: ErrorCodes.CV_JSON_PARSE,
    numericCode: ErrorNumeric.CV_JSON_PARSE,
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
    numericCode: ErrorNumeric.CV_SCHEMA_INVALID,
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
    numericCode: ErrorNumeric.CV_GENERATION_FAILED,
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
    numericCode: ErrorNumeric.CL_GENERATION_FAILED,
    domain: ErrorDomain.CL,
    severity: ErrorSeverity.ERROR,
    message: "Cover letter generation failed",
    userMessage: "Cover letter generation failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.CL_EDIT_FAILED]: {
    code: ErrorCodes.CL_EDIT_FAILED,
    numericCode: ErrorNumeric.CL_EDIT_FAILED,
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
    numericCode: ErrorNumeric.ANALYSIS_FAILED,
    domain: ErrorDomain.ANALYSIS,
    severity: ErrorSeverity.ERROR,
    message: "Job analysis failed",
    userMessage: "Job analysis failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.ANALYSIS_FOLLOWUP_FAILED]: {
    code: ErrorCodes.ANALYSIS_FOLLOWUP_FAILED,
    numericCode: ErrorNumeric.ANALYSIS_FOLLOWUP_FAILED,
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
    numericCode: ErrorNumeric.PROFILE_MERGE_FAILED,
    domain: ErrorDomain.PROFILE,
    severity: ErrorSeverity.ERROR,
    message: "Profile merge failed",
    userMessage: "Could not merge the profile. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },
  [ErrorCodes.PROFILE_CHAT_FAILED]: {
    code: ErrorCodes.PROFILE_CHAT_FAILED,
    numericCode: ErrorNumeric.PROFILE_CHAT_FAILED,
    domain: ErrorDomain.PROFILE,
    severity: ErrorSeverity.ERROR,
    message: "Profile assistant chat failed",
    userMessage: "Assistant response failed. Try again.",
    retryable: true,
    retryStrategy: "immediate",
  },

  // ── Generic ────────────────────────────────────────────────────────
  [ErrorCodes.UNKNOWN]: {
    code: ErrorCodes.UNKNOWN,
    numericCode: ErrorNumeric.GENERIC,
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
  public readonly numericCode: ErrorNumeric;
  public readonly domain: ErrorDomain;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly retryStrategy: "immediate" | "corrective" | "backoff" | undefined;
  public readonly record: ErrorRecord;
  public readonly timestamp: number;
  public metadata: Record<string, unknown>;
  public readonly userMessageKey: string | undefined;

  constructor(code: ErrorCode, message?: string, metadata?: Record<string, unknown>) {
    const record = ERROR_CATALOG[code];
    if (!record) {
      throw new Error(`[AppError] Unknown error code: ${code}. Register it in ERROR_CATALOG.`);
    }
    super(message ?? record.message);
    this.name = "AppError";
    this.code = code;
    this.numericCode = record.numericCode;
    this.domain = record.domain;
    this.severity = record.severity;
    this.retryable = record.retryable;
    this.retryStrategy = record.retryStrategy;
    this.record = record;
    this.timestamp = Date.now();
    this.metadata = metadata ?? {};
    this.userMessageKey = record.userMessageKey;
  }

  get userMessage(): string {
    return this.record.userMessage;
  }

  toJSON(): Record<string, unknown> {
    return {
      numericCode: this.numericCode,
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
