import { AppError, ErrorCodes } from "../../utils/errors";

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function createAbortSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

export function handleFetchError(error: unknown, timeoutMs: number): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new AppError(ErrorCodes.LLM_TIMEOUT, `Request timed out after ${timeoutMs}ms`);
  }
  if (error instanceof TypeError && error.message === "fetch failed") {
    throw new AppError(ErrorCodes.LLM_CONNECTION_REFUSED, error.message);
  }
  if (error instanceof AppError) throw error;
  throw new AppError(ErrorCodes.UNKNOWN, error instanceof Error ? error.message : String(error));
}
