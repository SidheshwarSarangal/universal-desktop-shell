import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrontendSource } from "./types";

function isInside(candidate: string, parent: string): boolean {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function isFrontendUrlAllowed(source: FrontendSource, target: string): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }

  if (source.mode === "production") {
    if (url.protocol !== "file:") return false;
    try {
      return isInside(resolve(fileURLToPath(url)), dirname(resolve(source.indexPath)));
    } catch {
      return false;
    }
  }

  const allowedOrigins = source.allowedOrigins ?? [new URL(source.url).origin];
  return (url.protocol === "http:" || url.protocol === "https:") && allowedOrigins.includes(url.origin);
}

export function isSafeExternalUrl(target: string): URL | undefined {
  try {
    const url = new URL(target);
    return url.protocol === "https:" || url.protocol === "mailto:" ? url : undefined;
  } catch {
    return undefined;
  }
}
