export { ActionRouter, serializedSize } from "./action-router";
export { runDesktopShellApp } from "./app-lifecycle";
export type { DesktopAppController, DesktopAppLifecycleOptions } from "./app-lifecycle";
export { normalizeWindowConfig, normalizeWindowId } from "./config";
export { IPC_CHANNELS, SHELL_PROTOCOL_VERSION } from "./constants";
export { createDesktopShell, DesktopShell } from "./desktop-shell";
export { defineAction } from "./types";
export { DesktopShellError, toSafeShellError } from "./errors";
export type { SafeShellError, ShellErrorCode } from "./errors";
export { createFallbackDataUrl } from "./fallback";
export { isFrontendUrlAllowed, isSafeExternalUrl } from "./frontend-policy";
export { createSecureWindowOptions, partitionFor } from "./security";
export { AtomicJsonWindowStateAdapter } from "./state-adapter";
export { centeredBounds, normalizeRestoredState } from "./state-geometry";
export type { DisplayArea } from "./state-geometry";
export type {
  ActionContext,
  ActionDefinition,
  ActionDefinitions,
  CapabilityName,
  DesktopShellOptions,
  DevelopmentFrontend,
  ExternalLinkHandler,
  FrontendSource,
  NormalizedWindowConfig,
  PermissionHandler,
  PermissionRequest,
  ProductionFrontend,
  RemoteFrontend,
  RendererEvent,
  RendererRequest,
  RendererResponse,
  ShellEventName,
  ShellEventPayloads,
  ShellWindowHandle,
  ShellWindowState,
  ThemePreference,
  WindowConfig,
  WindowId,
  WindowStateAdapter
} from "./types";
