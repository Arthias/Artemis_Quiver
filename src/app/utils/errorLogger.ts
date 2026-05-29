import { AppError } from "./errors";

const LOG_PREFIX = "[AppError]";

export function logAppError(err: unknown, context?: Record<string, unknown>): void {
  if (err instanceof AppError) {
    const entry = {
      ...err.toJSON(),
      context: context ?? {},
      stack: err.stack?.split("\n").slice(0, 4).join("\n"),
    };
    console.group(`${LOG_PREFIX} ${err.code}`);
    console.error("detail", entry);
    if (err.metadata && Object.keys(err.metadata).length > 0) {
      console.error("metadata", err.metadata);
    }
    console.groupEnd();
    return;
  }

  if (err instanceof Error) {
    console.error(`${LOG_PREFIX} [Uncategorized] ${err.message}`, {
      name: err.name,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 4).join("\n"),
      context,
    });
    return;
  }

  console.error(`${LOG_PREFIX} [Unknown]`, { value: String(err), context });
}

export function withErrorLogging<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  return fn().catch((err) => {
    logAppError(err, context);
    throw err;
  });
}
