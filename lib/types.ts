export type IssueLevel = "error" | "warning";

export type CheckScope = "slide" | "presentation";

export type CheckDefinition = {
  id: string;
  name: string;
  description: string;
  level: IssueLevel;
  scope: CheckScope;
  default_enabled: boolean;
};

export type SlideElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string | null;
  is_title?: boolean;
};

export type SlideIssue = {
  check_id: string;
  level: IssueLevel;
  message: string;
  element_id: string | null;
};

export type PresentationIssue = {
  check_id: string;
  level: IssueLevel;
  message: string;
  slide_numbers?: number[];
};

export type SlideReport = {
  number: number;
  width_emu: number;
  height_emu: number;
  elements: SlideElement[];
  issues: SlideIssue[];
};

export type CheckReport = {
  filename: string;
  slides_count: number;
  applied_checks: string[];
  presentation_issues: PresentationIssue[];
  slides: SlideReport[];
};

export type ApiErrorCode =
  | "UNSUPPORTED_TYPE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE"
  | "ARCHIVE_TOO_LARGE"
  | "MACROS_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN_CHECK"
  | "INTERNAL_ERROR";

export type HistoryRecord = {
  id: string;
  filename: string;
  createdAt: string;
  durationMs: number;
  enabledChecks: string[];
  report: CheckReport;
};

export type EventType =
  | "upload_started"
  | "check_success"
  | "check_error"
  | "switch_changed"
  | "locale_changed"
  | "theme_changed";

export type EventLogRecord = {
  ts: number;
  type: EventType;
  payload: Record<string, unknown>;
};
