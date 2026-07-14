import type { BrowserWindowConstructorOptions } from "electron";
import type { NormalizedWindowConfig } from "./types";

function sanitizePartitionPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

export function partitionFor(config: NormalizedWindowConfig, windowId: string): string {
  const domain = sanitizePartitionPart(config.trustDomain);
  if (config.frontend.mode === "remote") return `uds-remote-${domain}-${sanitizePartitionPart(windowId)}`;
  return `persist:uds-${domain}`;
}

export function createSecureWindowOptions(
  config: NormalizedWindowConfig,
  windowId: string,
  preloadPath: string | undefined,
  restoredBounds?: Readonly<{ x: number; y: number; width: number; height: number }>
): BrowserWindowConstructorOptions {
  const remote = config.frontend.mode === "remote";
  return {
    title: config.title,
    width: restoredBounds?.width ?? config.size.width,
    height: restoredBounds?.height ?? config.size.height,
    ...(restoredBounds ? { x: restoredBounds.x, y: restoredBounds.y } : {}),
    minWidth: config.minimumSize.width,
    minHeight: config.minimumSize.height,
    resizable: config.resizable,
    fullscreen: config.fullscreen,
    show: false,
    backgroundColor: config.backgroundColor,
    ...(config.iconPath ? { icon: config.iconPath } : {}),
    webPreferences: {
      ...(remote || !preloadPath ? {} : { preload: preloadPath }),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      partition: partitionFor(config, windowId),
      devTools: config.frontend.mode === "development"
    }
  };
}

