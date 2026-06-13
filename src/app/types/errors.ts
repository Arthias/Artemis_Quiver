// Re-export consolidated error system from utils/errors
// All new code should import directly from "@/utils/errors"
export {
  ErrorDomain,
  ErrorSeverity,
  ErrorNumeric,
  ErrorCodes,
  AppError,
} from "../utils/errors";

export type { ErrorCode, ErrorRecord } from "../utils/errors";
