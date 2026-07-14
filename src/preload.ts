import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, SHELL_PROTOCOL_VERSION } from "./constants";
import { RendererBridgeError, type UniversalDesktopShellBridge } from "./renderer";
import type { RendererEvent, RendererResponse } from "./types";

type Listener = (payload: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

ipcRenderer.on(IPC_CHANNELS.event, (_event, candidate: unknown) => {
  if (!candidate || typeof candidate !== "object") return;
  const envelope = candidate as Partial<RendererEvent>;
  if (
    envelope.protocolVersion !== SHELL_PROTOCOL_VERSION ||
    typeof envelope.name !== "string" ||
    envelope.name.length > 128
  ) {
    return;
  }
  for (const listener of listeners.get(envelope.name) ?? []) listener(envelope.payload);
});

let sequence = 0;
function createRequestId(): string {
  sequence = (sequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${sequence.toString(36)}`;
}

const bridge: UniversalDesktopShellBridge = Object.freeze({
  protocolVersion: SHELL_PROTOCOL_VERSION,
  async invoke(action: string, payload: unknown): Promise<unknown> {
    if (typeof action !== "string" || action.length === 0 || action.length > 128) {
      throw new TypeError("Action name is invalid.");
    }
    const requestId = createRequestId();
    const response = (await ipcRenderer.invoke(IPC_CHANNELS.invoke, {
      protocolVersion: SHELL_PROTOCOL_VERSION,
      requestId,
      action,
      payload
    })) as RendererResponse;
    if (!response || response.requestId !== requestId || typeof response.ok !== "boolean") {
      throw new Error("The desktop host returned an invalid response.");
    }
    if (!response.ok) throw new RendererBridgeError(response.error);
    return response.value;
  },
  on(event: string, listener: Listener): () => void {
    if (typeof event !== "string" || event.length === 0 || event.length > 128) {
      throw new TypeError("Event name is invalid.");
    }
    if (typeof listener !== "function") throw new TypeError("Event listener must be a function.");
    const eventListeners = listeners.get(event) ?? new Set<Listener>();
    eventListeners.add(listener);
    listeners.set(event, eventListeners);
    return () => {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) listeners.delete(event);
    };
  },
  ready(): void {
    ipcRenderer.send(IPC_CHANNELS.rendererReady, { protocolVersion: SHELL_PROTOCOL_VERSION });
  }
});

contextBridge.exposeInMainWorld("universalDesktopShell", bridge);

