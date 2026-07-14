import type { BrowserWindowConstructorOptions, Rectangle, WebContents } from "electron";
import type { ZodType } from "zod";
import type { SafeShellError } from "./errors";

export type ThemePreference = "light" | "dark" | "system";
export type WindowId = string;
export type CapabilityName = string;

export type ProductionFrontend = Readonly<{
  mode: "production";
  indexPath: string;
}>;

export type DevelopmentFrontend = Readonly<{
  mode: "development";
  url: string;
  allowedOrigins?: readonly string[];
  retry?: Readonly<{ attempts?: number; baseDelayMs?: number }>;
}>;

export type RemoteFrontend = Readonly<{
  mode: "remote";
  url: string;
  allowedOrigins: readonly string[];
}>;

export type FrontendSource = ProductionFrontend | DevelopmentFrontend | RemoteFrontend;

export type WindowRecoveryConfig = Readonly<{
  maxAutomaticReloads?: number;
  rollingWindowMs?: number;
}>;

export type WindowStateConfig = Readonly<{
  enabled?: boolean;
  key?: string;
}>;

export type WindowConfig = Readonly<{
  title: string;
  size?: Readonly<{ width: number; height: number }>;
  minimumSize?: Readonly<{ width: number; height: number }>;
  iconPath?: string;
  resizable?: boolean;
  fullscreen?: boolean;
  showOnReady?: boolean;
  backgroundColor?: string;
  theme?: ThemePreference;
  restoreState?: boolean | WindowStateConfig;
  trustDomain?: string;
  capabilities?: readonly CapabilityName[];
  frontend: FrontendSource;
  recovery?: WindowRecoveryConfig;
}>;

export type NormalizedWindowConfig = Readonly<{
  title: string;
  size: Readonly<{ width: number; height: number }>;
  minimumSize: Readonly<{ width: number; height: number }>;
  iconPath?: string;
  resizable: boolean;
  fullscreen: boolean;
  showOnReady: boolean;
  backgroundColor: string;
  theme: ThemePreference;
  state: Readonly<{ enabled: boolean; key?: string }>;
  trustDomain: string;
  capabilities: ReadonlySet<CapabilityName>;
  frontend: FrontendSource;
  recovery: Readonly<{ maxAutomaticReloads: number; rollingWindowMs: number }>;
}>;

export type ShellWindowState = Readonly<{
  bounds: Rectangle;
  maximized: boolean;
  fullscreen: boolean;
  displayId?: string;
}>;

export interface WindowStateAdapter {
  load(key: string): Promise<ShellWindowState | undefined>;
  save(key: string, state: ShellWindowState): Promise<void>;
  remove?(key: string): Promise<void>;
}

export type ActionContext = Readonly<{
  windowId: WindowId;
  capability: CapabilityName;
  signal: AbortSignal;
}>;

export type ActionDefinition<Input, Output> = Readonly<{
  capability: CapabilityName;
  input: ZodType<Input>;
  output?: ZodType<Output>;
  timeoutMs?: number;
  handler(context: ActionContext, input: Input): Promise<Output> | Output;
}>;

export type ActionDefinitions = Readonly<Record<string, ActionDefinition<any, any>>>;

export function defineAction<Input, Output>(
  definition: ActionDefinition<Input, Output>
): ActionDefinition<Input, Output> {
  return definition;
}

export type ShellEventPayloads = {
  "window-created": { windowId: WindowId };
  "window-ready": { windowId: WindowId };
  "renderer-ready": { windowId: WindowId };
  "frontend-loaded": { windowId: WindowId; mode: FrontendSource["mode"] };
  "load-failed": { windowId: WindowId; error: SafeShellError };
  "renderer-crashed": { windowId: WindowId; reason: string; exitCode: number };
  "renderer-unresponsive": { windowId: WindowId };
  "renderer-responsive": { windowId: WindowId };
  "window-closed": { windowId: WindowId };
  "security-rejected": { windowId?: WindowId; reason: string };
};

export type ShellEventName = keyof ShellEventPayloads;

export interface ShellWindowHandle {
  readonly id: WindowId;
  show(): void;
  hide(): void;
  focus(): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
  setFullScreen(fullscreen: boolean): void;
  isDestroyed(): boolean;
  reload(): Promise<void>;
  close(): Promise<void>;
}

export type ExternalLinkHandler = (url: URL, windowId: WindowId) => void | Promise<void>;

export type PermissionRequest = Readonly<{
  permission: string;
  requestingUrl: string;
  windowId?: WindowId;
}>;

export type PermissionHandler = (request: PermissionRequest) => boolean | Promise<boolean>;

export type BrowserWindowFactory = (
  options: BrowserWindowConstructorOptions
) => import("electron").BrowserWindow;

export type SenderValidator = (contents: WebContents, frameUrl: string, windowId: WindowId) => boolean;

export type DesktopShellOptions = Readonly<{
  preloadPath?: string;
  stateAdapter?: WindowStateAdapter;
  stateDirectory?: string;
  maxPayloadBytes?: number;
  actions?: ActionDefinitions;
  events?: Readonly<Record<string, CapabilityName>>;
  onExternalLink?: ExternalLinkHandler;
  permissionHandler?: PermissionHandler;
  browserWindowFactory?: BrowserWindowFactory;
  senderValidator?: SenderValidator;
  debug?: boolean;
}>;

export type RendererRequest = Readonly<{
  protocolVersion: number;
  requestId: string;
  action: string;
  payload: unknown;
}>;

export type RendererResponse =
  | Readonly<{ ok: true; requestId: string; value: unknown }>
  | Readonly<{ ok: false; requestId: string; error: SafeShellError }>;

export type RendererEvent = Readonly<{
  protocolVersion: number;
  name: string;
  payload: unknown;
}>;
