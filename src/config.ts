import { accessSync, constants as fsConstants } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import {
  DEFAULT_MAX_AUTOMATIC_RECOVERIES,
  DEFAULT_RECOVERY_WINDOW_MS
} from "./constants";
import { DesktopShellError } from "./errors";
import type { FrontendSource, NormalizedWindowConfig, WindowConfig } from "./types";

const identifierPattern = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;

const finiteDimension = z.number().finite().int().min(100).max(32_768);
const sizeSchema = z.object({ width: finiteDimension, height: finiteDimension }).strict();

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) {
    throw new DesktopShellError(
      "CONFIG_INVALID",
      `${label} must start with a letter and contain only letters, numbers, dot, underscore, colon, or hyphen.`
    );
  }
}

function normalizeHttpOrigin(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DesktopShellError("CONFIG_INVALID", `${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DesktopShellError("CONFIG_INVALID", `${label} must use HTTP or HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new DesktopShellError("CONFIG_INVALID", `${label} must not contain credentials.`);
  }
  return parsed.origin;
}

function assertSecureDevelopmentOrigin(origin: string): void {
  const parsed = new URL(origin);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol === "http:" && !loopbackHosts.has(parsed.hostname)) {
    throw new DesktopShellError(
      "CONFIG_INVALID",
      "Plain HTTP development origins are restricted to the local machine."
    );
  }
}

function validateFrontend(frontend: FrontendSource): FrontendSource {
  if (frontend.mode === "production") {
    if (!isAbsolute(frontend.indexPath)) {
      throw new DesktopShellError("CONFIG_INVALID", "Production indexPath must be absolute.");
    }
    try {
      accessSync(frontend.indexPath, fsConstants.R_OK);
    } catch (cause) {
      throw new DesktopShellError("CONFIG_INVALID", "Production indexPath is not readable.", {
        cause
      });
    }
    return Object.freeze({ mode: "production", indexPath: resolve(frontend.indexPath) });
  }

  let parsed: URL;
  try {
    parsed = new URL(frontend.url);
  } catch {
    throw new DesktopShellError("CONFIG_INVALID", "Frontend URL is invalid.");
  }
  if (frontend.mode === "development") {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new DesktopShellError("CONFIG_INVALID", "Development URL must use HTTP or HTTPS.");
    }
    if (parsed.username || parsed.password) {
      throw new DesktopShellError("CONFIG_INVALID", "Development URL must not contain credentials.");
    }
    assertSecureDevelopmentOrigin(parsed.origin);
    const allowedOrigins = frontend.allowedOrigins?.length
      ? frontend.allowedOrigins.map((origin) => normalizeHttpOrigin(origin, "Development origin"))
      : [parsed.origin];
    for (const origin of allowedOrigins) assertSecureDevelopmentOrigin(origin);
    const attempts = Math.max(0, Math.min(10, frontend.retry?.attempts ?? 3));
    const baseDelayMs = Math.max(100, Math.min(10_000, frontend.retry?.baseDelayMs ?? 400));
    return Object.freeze({
      mode: "development",
      url: parsed.href,
      allowedOrigins: Object.freeze([...new Set(allowedOrigins)]),
      retry: Object.freeze({ attempts, baseDelayMs })
    });
  }

  if (parsed.protocol !== "https:") {
    throw new DesktopShellError("CONFIG_INVALID", "Remote frontend URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new DesktopShellError("CONFIG_INVALID", "Remote frontend URL must not contain credentials.");
  }
  if (frontend.allowedOrigins.length === 0) {
    throw new DesktopShellError("CONFIG_INVALID", "Remote frontend requires allowedOrigins.");
  }
  const allowedOrigins = frontend.allowedOrigins.map((origin) => {
    const normalized = normalizeHttpOrigin(origin, "Remote origin");
    if (!normalized.startsWith("https://")) {
      throw new DesktopShellError("CONFIG_INVALID", "Remote origins must use HTTPS.");
    }
    return normalized;
  });
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new DesktopShellError(
      "CONFIG_INVALID",
      "Remote frontend origin must appear in allowedOrigins."
    );
  }
  return Object.freeze({
    mode: "remote",
    url: parsed.href,
    allowedOrigins: Object.freeze([...new Set(allowedOrigins)])
  });
}

export function normalizeWindowId(windowId: string): string {
  assertIdentifier(windowId, "Window ID");
  return windowId;
}

export function normalizeWindowConfig(config: WindowConfig): NormalizedWindowConfig {
  const title = config.title.trim();
  if (title.length === 0 || title.length > 200) {
    throw new DesktopShellError("CONFIG_INVALID", "Window title must contain 1 to 200 characters.");
  }

  const size = sizeSchema.parse(config.size ?? { width: 1200, height: 800 });
  const minimumSize = sizeSchema.parse(config.minimumSize ?? { width: 640, height: 480 });
  if (minimumSize.width > size.width || minimumSize.height > size.height) {
    throw new DesktopShellError(
      "CONFIG_INVALID",
      "Minimum window dimensions cannot exceed initial dimensions."
    );
  }

  const trustDomain = config.trustDomain?.trim() ||
    (config.frontend.mode === "development"
      ? "development"
      : config.frontend.mode === "remote"
        ? "remote"
        : "application");
  assertIdentifier(trustDomain, "Trust domain");

  const capabilities = new Set(config.capabilities ?? []);
  for (const capability of capabilities) assertIdentifier(capability, "Capability");
  if (config.frontend.mode === "remote" && capabilities.size > 0) {
    throw new DesktopShellError(
      "CONFIG_INVALID",
      "Remote frontend windows cannot receive privileged capabilities."
    );
  }

  const stateConfig = typeof config.restoreState === "object" ? config.restoreState : undefined;
  const stateEnabled = config.restoreState === true || stateConfig?.enabled === true;
  if (stateConfig?.key) assertIdentifier(stateConfig.key, "Window state key");

  const maxAutomaticReloads = Math.max(
    0,
    Math.min(3, config.recovery?.maxAutomaticReloads ?? DEFAULT_MAX_AUTOMATIC_RECOVERIES)
  );
  const rollingWindowMs = Math.max(
    10_000,
    Math.min(10 * 60_000, config.recovery?.rollingWindowMs ?? DEFAULT_RECOVERY_WINDOW_MS)
  );

  return Object.freeze({
    title,
    size: Object.freeze(size),
    minimumSize: Object.freeze(minimumSize),
    ...(config.iconPath ? { iconPath: resolve(config.iconPath) } : {}),
    resizable: config.resizable ?? true,
    fullscreen: config.fullscreen ?? false,
    showOnReady: config.showOnReady ?? true,
    backgroundColor: config.backgroundColor ?? "#111827",
    theme: config.theme ?? "system",
    state: Object.freeze({
      enabled: stateEnabled,
      ...(stateConfig?.key ? { key: stateConfig.key } : {})
    }),
    trustDomain,
    capabilities,
    frontend: validateFrontend(config.frontend),
    recovery: Object.freeze({ maxAutomaticReloads, rollingWindowMs })
  });
}
