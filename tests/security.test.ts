import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWindowConfig } from "../src/config";
import { createSecureWindowOptions, partitionFor } from "../src/security";

function config(mode: "production" | "remote") {
  if (mode === "remote") {
    return normalizeWindowConfig({
      title: "Remote",
      frontend: {
        mode: "remote",
        url: "https://example.com",
        allowedOrigins: ["https://example.com"]
      }
    });
  }
  const directory = mkdtempSync(join(tmpdir(), "uds-security-"));
  const indexPath = join(directory, "index.html");
  writeFileSync(indexPath, "<!doctype html>", "utf8");
  return normalizeWindowConfig({ title: "Local", frontend: { mode, indexPath } });
}

describe("secure BrowserWindow policy", () => {
  it("locks mandatory preferences", () => {
    const normalized = config("production");
    const options = createSecureWindowOptions(normalized, "main", "/app/preload.js");

    expect(options.webPreferences).toMatchObject({
      preload: "/app/preload.js",
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
      devTools: false
    });
    expect(partitionFor(normalized, "main")).toBe("persist:uds-application");
  });

  it("removes preload and persistence from remote content", () => {
    const normalized = config("remote");
    const options = createSecureWindowOptions(normalized, "help", "/app/preload.js");

    expect(options.webPreferences?.preload).toBeUndefined();
    expect(options.webPreferences?.partition).toBe("uds-remote-remote-help");
  });
});

