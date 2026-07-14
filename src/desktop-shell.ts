import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BrowserWindow,
  app,
  ipcMain,
  screen,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Session
} from "electron";
import { ActionRouter, serializedSize } from "./action-router";
import { normalizeWindowConfig, normalizeWindowId } from "./config";
import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  IPC_CHANNELS,
  SHELL_PROTOCOL_VERSION
} from "./constants";
import { DesktopShellError, toSafeShellError } from "./errors";
import { createFallbackDataUrl } from "./fallback";
import { isFrontendUrlAllowed, isSafeExternalUrl } from "./frontend-policy";
import { createSecureWindowOptions } from "./security";
import { AtomicJsonWindowStateAdapter } from "./state-adapter";
import { normalizeRestoredState } from "./state-geometry";
import type {
  ActionDefinition,
  DesktopShellOptions,
  NormalizedWindowConfig,
  RendererEvent,
  RendererResponse,
  ShellEventName,
  ShellEventPayloads,
  ShellWindowHandle,
  ShellWindowState,
  WindowConfig,
  WindowStateAdapter
} from "./types";
import { OpaqueShellWindowHandle, type WindowHandleOperations } from "./window-handle";

type WindowRecord = {
  readonly id: string;
  readonly window: BrowserWindow;
  readonly config: NormalizedWindowConfig;
  readonly stateKey: string;
  readonly recoveryAttempts: number[];
  showingFallback: boolean;
  stateTimer?: NodeJS.Timeout;
};

let activeIpcOwner: DesktopShell | undefined;

function defaultPreloadPath(): string {
  return join(__dirname, "preload.js");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    const timer = setTimeout(resolveDelay, milliseconds);
    timer.unref();
  });
}

function requestIdFrom(candidate: unknown): string {
  if (!candidate || typeof candidate !== "object") return "rejected";
  const value = (candidate as { requestId?: unknown }).requestId;
  return typeof value === "string" && value.length <= 128 ? value : "rejected";
}

export class DesktopShell implements WindowHandleOperations {
  private readonly windows = new Map<string, WindowRecord>();
  private readonly webContentsToWindow = new Map<number, string>();
  private readonly configuredSessions = new Set<Session>();
  private readonly emitter = new EventEmitter();
  private readonly actionRouter: ActionRouter;
  private readonly eventCapabilities: Readonly<Record<string, string>>;
  private readonly maxPayloadBytes: number;
  private readonly preloadPath: string;
  private readonly stateAdapter: WindowStateAdapter;
  private readonly invokeHandler: (event: IpcMainInvokeEvent, request: unknown) => Promise<RendererResponse>;
  private readonly readyHandler: (event: IpcMainEvent, message: unknown) => void;
  private disposed = false;

  constructor(private readonly options: DesktopShellOptions = {}) {
    if (activeIpcOwner) {
      throw new DesktopShellError(
        "CONFIG_INVALID",
        "Only one DesktopShell IPC owner can exist in an Electron application."
      );
    }
    this.maxPayloadBytes = Math.max(
      1024,
      Math.min(16 * 1024 * 1024, options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES)
    );
    this.preloadPath = resolve(options.preloadPath ?? defaultPreloadPath());
    this.actionRouter = new ActionRouter(options.actions, this.maxPayloadBytes);
    this.eventCapabilities = Object.freeze({ ...(options.events ?? {}) });
    this.stateAdapter =
      options.stateAdapter ??
      new AtomicJsonWindowStateAdapter(
        resolve(options.stateDirectory ?? join(app.getPath("userData"), "universal-desktop-shell"))
      );
    this.invokeHandler = (event, request) => this.handleInvoke(event, request);
    this.readyHandler = (event, message) => this.handleRendererReady(event, message);
    ipcMain.handle(IPC_CHANNELS.invoke, this.invokeHandler);
    ipcMain.on(IPC_CHANNELS.rendererReady, this.readyHandler);
    activeIpcOwner = this;
  }

  on<Event extends ShellEventName>(
    event: Event,
    listener: (payload: ShellEventPayloads[Event]) => void
  ): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  registerAction<Input, Output>(name: string, definition: ActionDefinition<Input, Output>): void {
    this.ensureActive();
    this.actionRouter.register(name, definition);
  }

  hasWindow(windowId: string): boolean {
    const record = this.windows.get(windowId);
    return Boolean(record && !record.window.isDestroyed());
  }

  windowIds(): readonly string[] {
    return Object.freeze([...this.windows.keys()]);
  }

  async createWindow(windowId: string, input: WindowConfig): Promise<ShellWindowHandle> {
    this.ensureActive();
    if (!app.isReady()) {
      throw new DesktopShellError("CONFIG_INVALID", "Electron must be ready before creating a window.");
    }
    const id = normalizeWindowId(windowId);
    if (this.hasWindow(id)) {
      throw new DesktopShellError("WINDOW_EXISTS", `Window '${id}' already exists.`);
    }
    const config = normalizeWindowConfig(input);
    if (config.frontend.mode !== "remote" && !existsSync(this.preloadPath)) {
      throw new DesktopShellError("CONFIG_INVALID", "The shell preload bundle was not found.");
    }

    const stateKey = config.state.key ?? id;
    const savedState = config.state.enabled ? await this.stateAdapter.load(stateKey) : undefined;
    const normalizedState = normalizeRestoredState(
      savedState,
      screen.getAllDisplays().map((display) => ({ id: display.id, workArea: display.workArea })),
      config.size,
      config.minimumSize
    );
    const browserWindowFactory = this.options.browserWindowFactory ?? ((windowOptions) => new BrowserWindow(windowOptions));
    const window = browserWindowFactory(
      createSecureWindowOptions(
        config,
        id,
        config.frontend.mode === "remote" ? undefined : this.preloadPath,
        normalizedState?.bounds
      )
    );
    const record: WindowRecord = {
      id,
      window,
      config,
      stateKey,
      recoveryAttempts: [],
      showingFallback: false
    };
    this.windows.set(id, record);
    this.webContentsToWindow.set(window.webContents.id, id);
    this.configureSession(window.webContents.session);
    this.configureWindow(record);
    if (normalizedState?.maximized) window.maximize();
    if (normalizedState?.fullscreen) window.setFullScreen(true);
    this.emit("window-created", { windowId: id });

    await this.loadFrontend(record);
    return new OpaqueShellWindowHandle(id, this);
  }

  sendEvent(windowId: string, name: string, payload: unknown): void {
    const record = this.requireWindow(windowId);
    const capability = this.eventCapabilities[name];
    if (!capability) throw new DesktopShellError("ACTION_UNKNOWN", "Renderer event is not registered.");
    if (!record.config.capabilities.has(capability)) {
      throw new DesktopShellError("ACTION_FORBIDDEN", "Window cannot receive this event.");
    }
    const event: RendererEvent = Object.freeze({
      protocolVersion: SHELL_PROTOCOL_VERSION,
      name,
      payload
    });
    if (serializedSize(event) > this.maxPayloadBytes) {
      throw new DesktopShellError("REQUEST_TOO_LARGE", "Renderer event exceeds the allowed size.");
    }
    record.window.webContents.send(IPC_CHANNELS.event, event);
  }

  show(id: string): void {
    this.requireWindow(id).window.show();
  }
  hide(id: string): void {
    this.requireWindow(id).window.hide();
  }
  focus(id: string): void {
    const window = this.requireWindow(id).window;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
  minimize(id: string): void {
    this.requireWindow(id).window.minimize();
  }
  maximize(id: string): void {
    this.requireWindow(id).window.maximize();
  }
  restore(id: string): void {
    this.requireWindow(id).window.restore();
  }
  setFullScreen(id: string, fullscreen: boolean): void {
    this.requireWindow(id).window.setFullScreen(fullscreen);
  }
  isDestroyed(id: string): boolean {
    const record = this.windows.get(id);
    return !record || record.window.isDestroyed();
  }
  async reload(id: string): Promise<void> {
    await this.loadFrontend(this.requireWindow(id));
  }
  async close(id: string): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.window.isDestroyed()) return;
    await new Promise<void>((resolveClose) => {
      record.window.once("closed", resolveClose);
      record.window.close();
    });
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.windows.keys()].map((id) => this.close(id)));
  }

  async dispose(options: { closeWindows?: boolean } = {}): Promise<void> {
    if (this.disposed) return;
    if (options.closeWindows ?? true) await this.closeAll();
    this.disposed = true;
    ipcMain.removeHandler(IPC_CHANNELS.invoke);
    ipcMain.off(IPC_CHANNELS.rendererReady, this.readyHandler);
    for (const record of this.windows.values()) this.actionRouter.abortWindow(record.id, "shell-disposed");
    this.windows.clear();
    this.webContentsToWindow.clear();
    this.emitter.removeAllListeners();
    if (activeIpcOwner === this) activeIpcOwner = undefined;
  }

  private configureWindow(record: WindowRecord): void {
    const { window, config, id } = record;
    const { webContents } = window;
    const handleNavigation = (event: { preventDefault(): void }, url: string): void => {
      if (isFrontendUrlAllowed(config.frontend, url)) return;
      event.preventDefault();
      this.emit("security-rejected", { windowId: id, reason: "navigation-rejected" });
      const external = isSafeExternalUrl(url);
      if (external && this.options.onExternalLink) {
        void Promise.resolve(this.options.onExternalLink(external, id)).catch(() => undefined);
      }
    };

    webContents.on("will-navigate", handleNavigation);
    webContents.on("will-redirect", handleNavigation);
    webContents.on("will-attach-webview", (event) => {
      event.preventDefault();
      this.emit("security-rejected", { windowId: id, reason: "webview-rejected" });
    });
    webContents.setWindowOpenHandler(({ url }) => {
      this.emit("security-rejected", { windowId: id, reason: "child-window-rejected" });
      const external = isSafeExternalUrl(url);
      if (external && this.options.onExternalLink) {
        void Promise.resolve(this.options.onExternalLink(external, id)).catch(() => undefined);
      }
      return { action: "deny" };
    });

    window.once("ready-to-show", () => {
      this.emit("window-ready", { windowId: id });
      if (config.showOnReady && !window.isDestroyed()) window.show();
    });
    webContents.on("render-process-gone", (_event, details) => {
      this.emit("renderer-crashed", { windowId: id, reason: details.reason, exitCode: details.exitCode });
      void this.recoverRenderer(record);
    });
    webContents.on("unresponsive", () => this.emit("renderer-unresponsive", { windowId: id }));
    webContents.on("responsive", () => this.emit("renderer-responsive", { windowId: id }));

    const scheduleStateSave = (): void => {
      if (!config.state.enabled || window.isDestroyed()) return;
      if (record.stateTimer) clearTimeout(record.stateTimer);
      record.stateTimer = setTimeout(() => void this.persistState(record), 300);
      record.stateTimer.unref();
    };
    window.on("resize", scheduleStateSave);
    window.on("move", scheduleStateSave);
    window.on("maximize", scheduleStateSave);
    window.on("unmaximize", scheduleStateSave);
    window.on("enter-full-screen", scheduleStateSave);
    window.on("leave-full-screen", scheduleStateSave);
    window.on("close", () => void this.persistState(record));
    window.once("closed", () => {
      if (record.stateTimer) clearTimeout(record.stateTimer);
      this.actionRouter.abortWindow(id);
      this.webContentsToWindow.delete(webContents.id);
      this.windows.delete(id);
      this.emit("window-closed", { windowId: id });
    });
  }

  private configureSession(session: Session): void {
    if (this.configuredSessions.has(session)) return;
    this.configuredSessions.add(session);
    session.setPermissionRequestHandler((contents, permission, callback, details) => {
      const windowId = contents ? this.webContentsToWindow.get(contents.id) : undefined;
      const decision = this.options.permissionHandler?.({
        permission,
        requestingUrl: details.requestingUrl,
        ...(windowId ? { windowId } : {})
      });
      void Promise.resolve(decision ?? false)
        .then((allowed) => callback(Boolean(allowed)))
        .catch(() => callback(false));
    });
  }

  private async loadFrontend(record: WindowRecord): Promise<void> {
    if (record.window.isDestroyed()) return;
    record.showingFallback = false;
    const source = record.config.frontend;
    const retryAttempts = source.mode === "development" ? source.retry?.attempts ?? 0 : 0;
    const baseDelayMs = source.mode === "development" ? source.retry?.baseDelayMs ?? 400 : 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      try {
        if (source.mode === "production") await record.window.loadFile(source.indexPath);
        else await record.window.loadURL(source.url);
        this.emit("frontend-loaded", { windowId: record.id, mode: source.mode });
        if (record.config.showOnReady && !record.window.isVisible()) record.window.show();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retryAttempts) await delay(baseDelayMs * 2 ** attempt);
      }
    }

    const failure = new DesktopShellError(
      "FRONTEND_LOAD_FAILED",
      "The application interface could not be loaded.",
      { retryable: source.mode === "development", actionNeeded: "retry", cause: lastError }
    );
    this.emit("load-failed", { windowId: record.id, error: failure.toSafeError() });
    await this.showFallback(record, failure);
  }

  private async showFallback(record: WindowRecord, error: DesktopShellError): Promise<void> {
    if (record.window.isDestroyed() || record.showingFallback) return;
    record.showingFallback = true;
    try {
      await record.window.loadURL(createFallbackDataUrl(record.config.title, error.toSafeError()));
      if (record.config.showOnReady) record.window.show();
    } catch {
      // The host still receives load-failed even if the local fallback renderer is unavailable.
    }
  }

  private async recoverRenderer(record: WindowRecord): Promise<void> {
    if (record.window.isDestroyed()) return;
    const now = Date.now();
    const threshold = now - record.config.recovery.rollingWindowMs;
    while (record.recoveryAttempts[0] !== undefined && record.recoveryAttempts[0] < threshold) {
      record.recoveryAttempts.shift();
    }
    if (record.recoveryAttempts.length < record.config.recovery.maxAutomaticReloads) {
      record.recoveryAttempts.push(now);
      await this.loadFrontend(record);
      return;
    }
    await this.showFallback(
      record,
      new DesktopShellError("FRONTEND_LOAD_FAILED", "The interface stopped repeatedly and needs attention.", {
        retryable: true,
        actionNeeded: "reload"
      })
    );
  }

  private async persistState(record: WindowRecord): Promise<void> {
    const { window, config } = record;
    if (!config.state.enabled || window.isDestroyed()) return;
    const bounds = window.getNormalBounds();
    const display = screen.getDisplayMatching(bounds);
    const state: ShellWindowState = Object.freeze({
      bounds: Object.freeze({ ...bounds }),
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
      displayId: String(display.id)
    });
    try {
      await this.stateAdapter.save(record.stateKey, state);
    } catch {
      // State persistence is best effort and must never block window shutdown.
    }
  }

  private async handleInvoke(event: IpcMainInvokeEvent, request: unknown): Promise<RendererResponse> {
    const requestId = requestIdFrom(request);
    try {
      const record = this.recordForSender(event.sender.id);
      const frameUrl = event.senderFrame?.url ?? event.sender.getURL();
      const sourceAllowed = isFrontendUrlAllowed(record.config.frontend, frameUrl);
      const customAllowed = this.options.senderValidator?.(event.sender, frameUrl, record.id) ?? true;
      if (record.config.frontend.mode === "remote" || !sourceAllowed || !customAllowed) {
        this.emit("security-rejected", { windowId: record.id, reason: "ipc-sender-rejected" });
        throw new DesktopShellError("SENDER_REJECTED", "The request sender is not trusted.");
      }
      const result = await this.actionRouter.invoke(request, record.id, record.config);
      return Object.freeze({ ok: true, requestId: result.requestId, value: result.value });
    } catch (error) {
      return Object.freeze({ ok: false, requestId, error: toSafeShellError(error) });
    }
  }

  private handleRendererReady(event: IpcMainEvent, message: unknown): void {
    if (
      !message ||
      typeof message !== "object" ||
      (message as { protocolVersion?: unknown }).protocolVersion !== SHELL_PROTOCOL_VERSION
    ) {
      return;
    }
    try {
      const record = this.recordForSender(event.sender.id);
      const frameUrl = event.senderFrame?.url ?? event.sender.getURL();
      const customAllowed = this.options.senderValidator?.(event.sender, frameUrl, record.id) ?? true;
      if (!isFrontendUrlAllowed(record.config.frontend, frameUrl) || !customAllowed) return;
      this.emit("renderer-ready", { windowId: record.id });
    } catch {
      // Unknown senders are ignored.
    }
  }

  private recordForSender(webContentsId: number): WindowRecord {
    const windowId = this.webContentsToWindow.get(webContentsId);
    if (!windowId) throw new DesktopShellError("SENDER_REJECTED", "Unknown renderer sender.");
    return this.requireWindow(windowId);
  }

  private requireWindow(windowId: string): WindowRecord {
    const record = this.windows.get(windowId);
    if (!record || record.window.isDestroyed()) {
      throw new DesktopShellError("WINDOW_NOT_FOUND", `Window '${windowId}' is unavailable.`);
    }
    return record;
  }

  private ensureActive(): void {
    if (this.disposed) throw new DesktopShellError("SHELL_DISPOSED", "Desktop shell is disposed.");
  }

  private emit<Event extends ShellEventName>(event: Event, payload: ShellEventPayloads[Event]): void {
    this.emitter.emit(event, Object.freeze(payload));
  }
}

export function createDesktopShell(options: DesktopShellOptions = {}): DesktopShell {
  return new DesktopShell(options);
}
