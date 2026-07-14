export type ShellErrorCode =
  | "CONFIG_INVALID"
  | "WINDOW_EXISTS"
  | "WINDOW_NOT_FOUND"
  | "FRONTEND_SOURCE_REJECTED"
  | "FRONTEND_LOAD_FAILED"
  | "ACTION_UNKNOWN"
  | "ACTION_FORBIDDEN"
  | "REQUEST_INVALID"
  | "REQUEST_TOO_LARGE"
  | "REQUEST_TIMEOUT"
  | "HANDLER_FAILED"
  | "SENDER_REJECTED"
  | "SHELL_DISPOSED";

export type SafeShellError = Readonly<{
  code: ShellErrorCode;
  message: string;
  retryable: boolean;
  actionNeeded?: "retry" | "reload" | "close" | "contact-support";
}>;

export class DesktopShellError extends Error {
  readonly code: ShellErrorCode;
  readonly retryable: boolean;
  readonly actionNeeded: SafeShellError["actionNeeded"];

  constructor(
    code: ShellErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      actionNeeded?: SafeShellError["actionNeeded"];
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "DesktopShellError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.actionNeeded = options.actionNeeded;
  }

  toSafeError(): SafeShellError {
    return Object.freeze({
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.actionNeeded ? { actionNeeded: this.actionNeeded } : {})
    });
  }
}

export function toSafeShellError(error: unknown): SafeShellError {
  if (error instanceof DesktopShellError) return error.toSafeError();

  return Object.freeze({
    code: "HANDLER_FAILED",
    message: "The requested operation could not be completed.",
    retryable: false,
    actionNeeded: "contact-support"
  });
}

