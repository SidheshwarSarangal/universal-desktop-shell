import { describe, expect, it } from "vitest";
import { createFallbackDataUrl } from "../src/fallback";

describe("fallback page", () => {
  it("encodes content and carries a restrictive CSP", () => {
    const url = createFallbackDataUrl("<Unsafe>", {
      code: "FRONTEND_LOAD_FAILED",
      message: "Could not load <script>alert(1)</script>",
      retryable: true
    });
    const html = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("&lt;Unsafe&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

