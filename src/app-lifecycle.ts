import { app } from "electron";
import { createDesktopShell, type DesktopShell } from "./desktop-shell";
import type { DesktopShellOptions, ShellWindowHandle } from "./types";

export type DesktopAppLifecycleOptions = Readonly<{
  shell?: DesktopShellOptions;
  primaryWindowId?: string;
  singleInstance?: boolean;
  quitWhenAllWindowsClosed?: boolean;
  createPrimary(shell: DesktopShell): Promise<ShellWindowHandle>;
}>;

export type DesktopAppController = Readonly<{
  shell: DesktopShell;
  primary: ShellWindowHandle;
  stop(): Promise<void>;
}>;

export async function runDesktopShellApp(
  options: DesktopAppLifecycleOptions
): Promise<DesktopAppController | undefined> {
  const useSingleInstance = options.singleInstance ?? true;
  if (useSingleInstance && !app.requestSingleInstanceLock()) {
    app.quit();
    return undefined;
  }

  await app.whenReady();
  const shell = createDesktopShell(options.shell);
  let primary = await options.createPrimary(shell);
  const primaryWindowId = options.primaryWindowId ?? primary.id;

  const focusPrimary = (): void => {
    if (shell.hasWindow(primaryWindowId)) shell.focus(primaryWindowId);
  };
  const secondInstance = (): void => focusPrimary();
  const activate = (): void => {
    if (shell.hasWindow(primaryWindowId)) {
      focusPrimary();
      return;
    }
    void options.createPrimary(shell).then((handle) => {
      primary = handle;
    });
  };
  const windowAllClosed = (): void => {
    if (options.quitWhenAllWindowsClosed ?? true) app.quit();
  };

  app.on("second-instance", secondInstance);
  app.on("activate", activate);
  app.on("window-all-closed", windowAllClosed);

  return Object.freeze({
    shell,
    get primary() {
      return primary;
    },
    async stop(): Promise<void> {
      app.off("second-instance", secondInstance);
      app.off("activate", activate);
      app.off("window-all-closed", windowAllClosed);
      await shell.dispose();
    }
  });
}

