import type { ApiErrorCode, CheckDefinition, CheckReport } from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class CheckRequestError extends Error {
  code: ApiErrorCode;
  retryAfter: number | null;

  constructor(code: ApiErrorCode, retryAfter: number | null = null) {
    super(code);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function validateFile(file: File): ApiErrorCode | null {
  if (!file.name.toLowerCase().endsWith(".pptx")) return "UNSUPPORTED_TYPE";
  if (file.size > MAX_FILE_BYTES) return "FILE_TOO_LARGE";
  return null;
}

export async function fetchChecks(): Promise<CheckDefinition[]> {
  const response = await fetch(`${API_BASE}/api/checks`);
  if (!response.ok) throw new CheckRequestError("INTERNAL_ERROR");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new CheckRequestError("INTERNAL_ERROR");
  return data as CheckDefinition[];
}

export async function submitCheck(
  file: File,
  enabledChecks: string[],
): Promise<CheckReport> {
  const body = new FormData();
  body.append("file", file);
  body.append("enabled_checks", JSON.stringify(enabledChecks));

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/check`, { method: "POST", body });
  } catch {
    throw new CheckRequestError("INTERNAL_ERROR");
  }

  if (response.ok) {
    const data: unknown = await response.json().catch(() => null);
    if (!isReport(data)) throw new CheckRequestError("INTERNAL_ERROR");
    return data;
  }

  const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
  const code = await readErrorCode(response);
  throw new CheckRequestError(code, retryAfter);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  return null;
}

async function readErrorCode(response: Response): Promise<ApiErrorCode> {
  const data: unknown = await response.json().catch(() => null);
  const code =
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error &&
    typeof data.error === "object" &&
    "code" in data.error &&
    typeof data.error.code === "string"
      ? data.error.code
      : "";

  if (isApiErrorCode(code)) return code;
  if (response.status === 429) return "RATE_LIMITED";
  if (response.status === 504) return "TIMEOUT";
  return "INTERNAL_ERROR";
}

function isApiErrorCode(code: string): code is ApiErrorCode {
  return (
    code === "UNSUPPORTED_TYPE" ||
    code === "FILE_TOO_LARGE" ||
    code === "INVALID_FILE" ||
    code === "ARCHIVE_TOO_LARGE" ||
    code === "MACROS_NOT_ALLOWED" ||
    code === "RATE_LIMITED" ||
    code === "TIMEOUT" ||
    code === "UNKNOWN_CHECK" ||
    code === "INTERNAL_ERROR"
  );
}

function isReport(data: unknown): data is CheckReport {
  if (!data || typeof data !== "object") return false;
  const report = data as CheckReport;
  return (
    typeof report.filename === "string" &&
    typeof report.slides_count === "number" &&
    Array.isArray(report.slides) &&
    Array.isArray(report.presentation_issues)
  );
}
