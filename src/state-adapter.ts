import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShellWindowState, WindowStateAdapter } from "./types";

const safeKey = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseState(value: unknown): ShellWindowState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const bounds = candidate.bounds;
  if (!bounds || typeof bounds !== "object") return undefined;
  const rectangle = bounds as Record<string, unknown>;
  if (
    !isFiniteNumber(rectangle.x) ||
    !isFiniteNumber(rectangle.y) ||
    !isFiniteNumber(rectangle.width) ||
    !isFiniteNumber(rectangle.height) ||
    rectangle.width < 100 ||
    rectangle.height < 100
  ) {
    return undefined;
  }
  if (typeof candidate.maximized !== "boolean" || typeof candidate.fullscreen !== "boolean") {
    return undefined;
  }

  return Object.freeze({
    bounds: Object.freeze({
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height
    }),
    maximized: candidate.maximized,
    fullscreen: candidate.fullscreen,
    ...(typeof candidate.displayId === "string" ? { displayId: candidate.displayId } : {})
  });
}

export class AtomicJsonWindowStateAdapter implements WindowStateAdapter {
  constructor(private readonly directory: string) {}

  private pathFor(key: string): string {
    if (!safeKey.test(key)) throw new TypeError("Invalid window state key.");
    return join(this.directory, `${key}.json`);
  }

  async load(key: string): Promise<ShellWindowState | undefined> {
    try {
      const data = await readFile(this.pathFor(key), "utf8");
      return parseState(JSON.parse(data) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
        return undefined;
      }
      throw error;
    }
  }

  async save(key: string, state: ShellWindowState): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const destination = this.pathFor(key);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, destination);
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

