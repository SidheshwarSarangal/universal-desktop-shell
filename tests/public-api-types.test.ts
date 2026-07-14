import { z } from "zod";
import { describe, expect, it } from "vitest";
import { defineAction, type DesktopShellOptions } from "../src";

describe("public action typing", () => {
  it("infers handler input and preserves output", async () => {
    const action = defineAction({
      capability: "math.basic",
      input: z.object({ value: z.number() }),
      output: z.object({ doubled: z.number() }),
      handler: (_context, input) => ({ doubled: input.value * 2 })
    });
    const options: DesktopShellOptions = { actions: { "math.double": action } };

    expect(options.actions?.["math.double"]?.capability).toBe("math.basic");
    await expect(
      Promise.resolve(action.handler(
        { windowId: "main", capability: "math.basic", signal: new AbortController().signal },
        { value: 4 }
      ))
    ).resolves.toEqual({ doubled: 8 });
  });
});
