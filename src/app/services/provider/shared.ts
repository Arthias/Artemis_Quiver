import { AppError, ErrorCodes } from "../../utils/errors";

export function normalizeBaseUrl(url: string): string {
  // Adapters append their own "/v1/..." (or "/v1beta/...") suffix, so a
  // user-supplied base URL that already ends in "/v1" (the documented format
  // for OpenRouter, OpenAI, etc.) would otherwise double up into "/v1/v1/...".
  return url.replace(/\/+$/, "").replace(/\/v1$/i, "");
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
