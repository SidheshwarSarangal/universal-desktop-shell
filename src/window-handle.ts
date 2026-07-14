import { DesktopShellError } from "./errors";
import type { ShellWindowHandle } from "./types";

export interface WindowHandleOperations {
  show(id: string): void;
  hide(id: string): void;
  focus(id: string): void;
  minimize(id: string): void;
  maximize(id: string): void;
  restore(id: string): void;
  setFullScreen(id: string, fullscreen: boolean): void;
  isDestroyed(id: string): boolean;
  reload(id: string): Promise<void>;
  close(id: string): Promise<void>;
}

export class OpaqueShellWindowHandle implements ShellWindowHandle {
  constructor(
    readonly id: string,
    private readonly operations: WindowHandleOperations
  ) {}

  private ensureAlive(): void {
    if (this.operations.isDestroyed(this.id)) {
      throw new DesktopShellError("WINDOW_NOT_FOUND", `Window '${this.id}' is unavailable.`);
    }
  }

  show(): void {
    this.ensureAlive();
    this.operations.show(this.id);
  }
  hide(): void {
    this.ensureAlive();
    this.operations.hide(this.id);
  }
  focus(): void {
    this.ensureAlive();
    this.operations.focus(this.id);
  }
  minimize(): void {
    this.ensureAlive();
    this.operations.minimize(this.id);
  }
  maximize(): void {
    this.ensureAlive();
    this.operations.maximize(this.id);
  }
  restore(): void {
    this.ensureAlive();
    this.operations.restore(this.id);
  }
  setFullScreen(fullscreen: boolean): void {
    this.ensureAlive();
    this.operations.setFullScreen(this.id, fullscreen);
  }
  isDestroyed(): boolean {
    return this.operations.isDestroyed(this.id);
  }
  async reload(): Promise<void> {
    this.ensureAlive();
    await this.operations.reload(this.id);
  }
  async close(): Promise<void> {
    if (this.isDestroyed()) return;
    await this.operations.close(this.id);
  }
}

