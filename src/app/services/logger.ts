import { AppError, ErrorNumeric } from "../utils/errors";

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
  },
  info: (message, context) => {
    console.log(`[INFO] ${message}`, context ?? "");
  },
  warn: (message, context) => {
    console.warn(`[WARN] ${message}`, context ?? "");
  },
};

export default logger;
