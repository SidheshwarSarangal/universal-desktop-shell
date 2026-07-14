export const SHELL_PROTOCOL_VERSION = 1 as const;

export const IPC_CHANNELS = Object.freeze({
  invoke: "universal-desktop-shell:invoke",
  event: "universal-desktop-shell:event",
  rendererReady: "universal-desktop-shell:renderer-ready"
});

export const DEFAULT_MAX_PAYLOAD_BYTES = 1024 * 1024;
export const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
export const DEFAULT_EVENT_RATE_PER_SECOND = 20;
export const DEFAULT_RECOVERY_WINDOW_MS = 60_000;
export const DEFAULT_MAX_AUTOMATIC_RECOVERIES = 1;

