import type { Rectangle } from "electron";
import type { ShellWindowState } from "./types";

export type DisplayArea = Readonly<{ id: string | number; workArea: Rectangle }>;

function intersectionArea(a: Rectangle, b: Rectangle): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

export function normalizeRestoredState(
  state: ShellWindowState | undefined,
  displays: readonly DisplayArea[],
  defaults: Readonly<{ width: number; height: number }>,
  minimum: Readonly<{ width: number; height: number }>
): ShellWindowState | undefined {
  if (!state || displays.length === 0) return undefined;
  const bounds = state.bounds;
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return undefined;

  const display = displays.reduce<DisplayArea | undefined>((best, item) => {
    if (!best) return item;
    return intersectionArea(bounds, item.workArea) > intersectionArea(bounds, best.workArea) ? item : best;
  }, undefined);
  if (!display || intersectionArea(bounds, display.workArea) < 64 * 64) return undefined;

  const width = Math.min(Math.max(bounds.width, minimum.width), display.workArea.width);
  const height = Math.min(Math.max(bounds.height, minimum.height), display.workArea.height);
  const x = Math.min(Math.max(bounds.x, display.workArea.x), display.workArea.x + display.workArea.width - width);
  const y = Math.min(Math.max(bounds.y, display.workArea.y), display.workArea.y + display.workArea.height - height);

  return Object.freeze({
    bounds: Object.freeze({ x, y, width, height }),
    maximized: Boolean(state.maximized),
    fullscreen: Boolean(state.fullscreen),
    displayId: String(display.id)
  });
}

export function centeredBounds(
  area: Rectangle,
  defaults: Readonly<{ width: number; height: number }>
): Rectangle {
  const width = Math.min(defaults.width, area.width);
  const height = Math.min(defaults.height, area.height);
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height
  };
}

