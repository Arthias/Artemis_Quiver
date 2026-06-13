import { AppError, ErrorNumeric } from "../utils/errors";
import { addErrorLog } from "../db/errorLogRepo";

type Logger = {
  error: (err: Error | AppError, context?: Record<string, any>) => void;
  info: (message: string, context?: Record<string, any>) => void;
  warn: (message: string, context?: Record<string, any>) => void;
};

const logger: Logger = {
  error: (err, context) => {
    const numericCode = err instanceof AppError ? err.numericCode : ErrorNumeric.GENERIC;
    const codeStr = err instanceof AppError ? err.code : "ERR_UNKNOWN";
    const domain = err instanceof AppError ? err.domain : "APP";
    const severity = err instanceof AppError ? err.severity : "ERROR";
    const message = err.message;

    console.error(
      `[${numericCode}|${domain}|${severity}] ${message}`,
      {
        code: codeStr,
        ...context,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }
    );

    addErrorLog({
      timestamp: new Date().toISOString(),
      message,
      stack: err.stack,
      source: domain.toLowerCase() as any,
      code: codeStr,
      numericCode,
      severity,
      metadata: context,
    }).catch((e) => {
      // Fallback: log to console if DB write fails
      console.error("[Logger] Failed to persist error to DB:", e);
    });
  },
  info: (message, context) => {
    console.log(`[INFO] ${message}`, context ?? "");
  },
  warn: (message, context) => {
    console.warn(`[WARN] ${message}`, context ?? "");
  },
};

export default logger;
