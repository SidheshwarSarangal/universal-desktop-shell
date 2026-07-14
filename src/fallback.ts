import type { SafeShellError } from "./errors";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createFallbackDataUrl(title: string, error: SafeShellError): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(error.message);
  const safeCode = escapeHtml(error.code);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<title>${safeTitle}</title><style>
:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#111827;color:#f9fafb}
main{max-width:34rem;padding:2rem;text-align:center}h1{font-size:1.45rem}p{line-height:1.6;color:#d1d5db}code{font-size:.8rem;color:#9ca3af}
</style></head><body><main><h1>${safeTitle} could not be displayed</h1><p>${safeMessage}</p><code>${safeCode}</code></main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

