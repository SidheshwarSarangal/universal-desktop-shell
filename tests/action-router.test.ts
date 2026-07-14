import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ActionRouter } from "../src/action-router";
import { normalizeWindowConfig } from "../src/config";
import { DesktopShellError } from "../src/errors";

const config = normalizeWindowConfig({
  title: "Actions",
  capabilities: ["math.basic"],
  frontend: { mode: "development", url: "http://localhost:5173" }
});

function request(action: string, payload: unknown) {
  return { protocolVersion: 1, requestId: "request-1", action, payload };
}

describe("ActionRouter", () => {
  it("validates and invokes an allowed action", async () => {
    const router = new ActionRouter({}, 1024);
    router.register("math.add", {
      capability: "math.basic",
      input: z.object({ left: z.number(), right: z.number() }),
      output: z.number(),
      handler: (_context, input) => input.left + input.right
    });

    await expect(
      router.invoke(request("math.add", { left: 2, right: 3 }), "main", config)
    ).resolves.toEqual({ requestId: "request-1", value: 5 });
  });

  it("rejects unknown actions", async () => {
    const router = new ActionRouter({}, 1024);
    await expect(router.invoke(request("unknown.action", {}), "main", config)).rejects.toMatchObject({
      code: "ACTION_UNKNOWN"
    });
  });

  it("rejects actions outside the window capability set", async () => {
    const router = new ActionRouter({}, 1024);
    router.register("admin.run", {
      capability: "admin",
      input: z.object({}),
      handler: () => true
    });
    await expect(router.invoke(request("admin.run", {}), "main", config)).rejects.toMatchObject({
      code: "ACTION_FORBIDDEN"
    });
  });

  it("rejects invalid and oversized payloads", async () => {
    const router = new ActionRouter({}, 128);
    router.register("math.add", {
      capability: "math.basic",
      input: z.object({ left: z.number(), right: z.number() }),
      handler: (_context, input) => input.left + input.right
    });
    await expect(router.invoke(request("math.add", { left: "2" }), "main", config)).rejects.toMatchObject({
      code: "REQUEST_INVALID"
    });
    await expect(
      router.invoke(request("math.add", { left: 2, right: 3, padding: "x".repeat(500) }), "main", config)
    ).rejects.toBeInstanceOf(DesktopShellError);
  });

  it("times out and aborts slow handlers", async () => {
    const router = new ActionRouter({}, 1024);
    router.register("math.slow", {
      capability: "math.basic",
      input: z.object({}),
      timeoutMs: 100,
      handler: (context) =>
        new Promise((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        })
    });
    await expect(router.invoke(request("math.slow", {}), "main", config)).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT"
    });
  });
});

