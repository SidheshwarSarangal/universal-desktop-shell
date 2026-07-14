import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isFrontendUrlAllowed, isSafeExternalUrl } from "../src/frontend-policy";

describe("frontend source policy", () => {
  it("allows production assets only below the configured root", () => {
    const root = mkdtempSync(join(tmpdir(), "uds-policy-"));
    const indexPath = join(root, "index.html");
    const asset = pathToFileURL(join(root, "assets", "app.js")).href;
    const outside = pathToFileURL(join(root, "..", "secret.txt")).href;

    expect(isFrontendUrlAllowed({ mode: "production", indexPath }, asset)).toBe(true);
    expect(isFrontendUrlAllowed({ mode: "production", indexPath }, outside)).toBe(false);
  });

  it("uses exact origins rather than prefixes", () => {
    const source = {
      mode: "development" as const,
      url: "http://localhost:5173",
      allowedOrigins: ["http://localhost:5173"]
    };
    expect(isFrontendUrlAllowed(source, "http://localhost:5173/route")).toBe(true);
    expect(isFrontendUrlAllowed(source, "http://localhost:5173.attacker.test")).toBe(false);
  });

  it("allows only HTTPS and mailto external targets", () => {
    expect(isSafeExternalUrl("https://example.com")?.hostname).toBe("example.com");
    expect(isSafeExternalUrl("mailto:support@example.com")?.protocol).toBe("mailto:");
    expect(isSafeExternalUrl("file:///etc/passwd")).toBeUndefined();
    expect(isSafeExternalUrl("javascript:alert(1)")).toBeUndefined();
  });
});
