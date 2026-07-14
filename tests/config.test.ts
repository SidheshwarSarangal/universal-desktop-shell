import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWindowConfig, normalizeWindowId } from "../src/config";
import { DesktopShellError } from "../src/errors";

function productionFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "uds-config-"));
  const indexPath = join(directory, "index.html");
  writeFileSync(indexPath, "<!doctype html>", "utf8");
  return indexPath;
}

describe("normalizeWindowConfig", () => {
  it("applies reusable defaults", () => {
    const result = normalizeWindowConfig({
      title: "Example",
      frontend: { mode: "production", indexPath: productionFixture() }
    });

    expect(result.size).toEqual({ width: 1200, height: 800 });
    expect(result.minimumSize).toEqual({ width: 640, height: 480 });
    expect(result.capabilities.size).toBe(0);
    expect(result.trustDomain).toBe("application");
    expect(result.recovery.maxAutomaticReloads).toBe(1);
  });

  it("normalizes explicit development origins", () => {
    const result = normalizeWindowConfig({
      title: "Development",
      frontend: {
        mode: "development",
        url: "http://localhost:5173/app",
        allowedOrigins: ["http://localhost:5173/ignored"]
      }
    });

    expect(result.frontend).toMatchObject({
      mode: "development",
      allowedOrigins: ["http://localhost:5173"]
    });
  });

  it("rejects non-loopback plain HTTP development sources", () => {
    expect(() =>
      normalizeWindowConfig({
        title: "Unsafe",
        frontend: { mode: "development", url: "http://192.168.1.10:5173" }
      })
    ).toThrowError(DesktopShellError);
  });

  it("rejects non-loopback plain HTTP origins and embedded credentials", () => {
    expect(() =>
      normalizeWindowConfig({
        title: "Unsafe origin",
        frontend: {
          mode: "development",
          url: "https://dev.example.test",
          allowedOrigins: ["http://192.168.1.10:5173"]
        }
      })
    ).toThrowError(/local machine/i);
    expect(() =>
      normalizeWindowConfig({
        title: "Credentials",
        frontend: { mode: "development", url: "https://user:secret@example.test" }
      })
    ).toThrowError(/credentials/i);
  });

  it("rejects privileged capabilities for remote content", () => {
    expect(() =>
      normalizeWindowConfig({
        title: "Remote",
        capabilities: ["files.read"],
        frontend: {
          mode: "remote",
          url: "https://example.com/app",
          allowedOrigins: ["https://example.com"]
        }
      })
    ).toThrowError(/cannot receive privileged capabilities/i);
  });

  it("rejects a missing production entry", () => {
    expect(() =>
      normalizeWindowConfig({
        title: "Missing",
        frontend: { mode: "production", indexPath: "/does/not/exist/index.html" }
      })
    ).toThrowError(/not readable/i);
  });

  it("rejects malformed identifiers", () => {
    expect(() => normalizeWindowId("../main")).toThrowError(/Window ID/);
  });
});
