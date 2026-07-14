import type { SafeShellError } from "./errors";

export type RendererActionMap = Record<string, { input: unknown; output: unknown }>;
export type RendererEventMap = Record<string, unknown>;

export class RendererBridgeError extends Error {
  readonly code: SafeShellError["code"];
  readonly retryable: boolean;
  readonly actionNeeded: SafeShellError["actionNeeded"];

  constructor(error: SafeShellError) {
    super(error.message);
    this.name = "RendererBridgeError";
    this.code = error.code;
    this.retryable = error.retryable;
    this.actionNeeded = error.actionNeeded;
  }
}

export interface UniversalDesktopShellBridge<
  Actions extends RendererActionMap = RendererActionMap,
  Events extends RendererEventMap = RendererEventMap
> {
  readonly protocolVersion: number;
  invoke<Name extends Extract<keyof Actions, string>>(
    action: Name,
    payload: Actions[Name]["input"]
  ): Promise<Actions[Name]["output"]>;
  on<Name extends Extract<keyof Events, string>>(
    event: Name,
    listener: (payload: Events[Name]) => void
  ): () => void;
  ready(): void;
}

declare global {
  interface Window {
    readonly universalDesktopShell?: UniversalDesktopShellBridge;
  }
}

export function getDesktopShellBridge<
  Actions extends RendererActionMap = RendererActionMap,
  Events extends RendererEventMap = RendererEventMap
>(): UniversalDesktopShellBridge<Actions, Events> {
  if (!window.universalDesktopShell) {
    throw new Error("Universal Desktop Shell bridge is unavailable in this window.");
  }
  return window.universalDesktopShell as UniversalDesktopShellBridge<Actions, Events>;
}

