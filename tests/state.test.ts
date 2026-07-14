import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AtomicJsonWindowStateAdapter } from "../src/state-adapter";
import { normalizeRestoredState } from "../src/state-geometry";

describe("window state", () => {
  it("clamps restored bounds to a visible display", () => {
    const result = normalizeRestoredState(
      {
        bounds: { x: 900, y: 700, width: 500, height: 500 },
        maximized: false,
        fullscreen: false
      },
      [{ id: 1, workArea: { x: 0, y: 0, width: 1200, height: 800 } }],
      { width: 1000, height: 700 },
      { width: 640, height: 480 }
    );
    expect(result?.bounds).toEqual({ x: 560, y: 300, width: 640, height: 500 });
  });

  it("rejects fully off-screen state", () => {
    expect(
      normalizeRestoredState(
        { bounds: { x: 5000, y: 5000, width: 800, height: 600 }, maximized: false, fullscreen: false },
        [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
        { width: 1200, height: 800 },
        { width: 640, height: 480 }
      )
    ).toBeUndefined();
  });

  it("stores and loads state atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "uds-state-"));
    const adapter = new AtomicJsonWindowStateAdapter(directory);
    const state = {
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: true,
      fullscreen: false,
      displayId: "1"
    } as const;
    await adapter.save("main", state);
    await expect(adapter.load("main")).resolves.toEqual(state);
    await adapter.remove("main");
    await expect(adapter.load("main")).resolves.toBeUndefined();
  });
});
