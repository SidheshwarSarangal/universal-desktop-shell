import { z } from "zod";
import { DEFAULT_ACTION_TIMEOUT_MS, SHELL_PROTOCOL_VERSION } from "./constants";
import { DesktopShellError } from "./errors";
import type {
  ActionContext,
  ActionDefinition,
  ActionDefinitions,
  NormalizedWindowConfig,
  RendererRequest
} from "./types";

const actionNamePattern = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const requestSchema = z
  .object({
    protocolVersion: z.literal(SHELL_PROTOCOL_VERSION),
    requestId: z.string().min(1).max(128),
    action: z.string().regex(actionNamePattern),
    payload: z.unknown()
  })
  .strict();

export function serializedSize(value: unknown): number {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch (cause) {
    throw new DesktopShellError("REQUEST_INVALID", "Request payload must be serializable.", {
      cause
    });
  }
  if (json === undefined) {
    throw new DesktopShellError("REQUEST_INVALID", "Request payload must be serializable.");
  }
  return Buffer.byteLength(json, "utf8");
}

export class ActionRouter {
  private readonly actions = new Map<string, ActionDefinition<unknown, unknown>>();
  private readonly inFlight = new Map<string, Set<AbortController>>();

  constructor(
    actions: ActionDefinitions = {},
    private readonly maxPayloadBytes: number
  ) {
    for (const [name, definition] of Object.entries(actions)) this.register(name, definition);
  }

  register<Input, Output>(name: string, definition: ActionDefinition<Input, Output>): void {
    if (!actionNamePattern.test(name)) throw new TypeError(`Invalid action name: ${name}`);
    if (this.actions.has(name)) throw new TypeError(`Action is already registered: ${name}`);
    this.actions.set(name, definition as ActionDefinition<unknown, unknown>);
  }

  async invoke(
    untrustedRequest: unknown,
    windowId: string,
    config: NormalizedWindowConfig
  ): Promise<{ requestId: string; value: unknown }> {
    if (serializedSize(untrustedRequest) > this.maxPayloadBytes) {
      throw new DesktopShellError("REQUEST_TOO_LARGE", "Request exceeds the allowed size.");
    }

    const parsed = requestSchema.safeParse(untrustedRequest);
    if (!parsed.success) {
      throw new DesktopShellError("REQUEST_INVALID", "Request envelope is invalid.");
    }
    const request: RendererRequest = parsed.data;
    const definition = this.actions.get(request.action);
    if (!definition) {
      throw new DesktopShellError("ACTION_UNKNOWN", "The requested action is not registered.");
    }
    if (!config.capabilities.has(definition.capability)) {
      throw new DesktopShellError("ACTION_FORBIDDEN", "This window cannot use the requested action.");
    }

    const input = definition.input.safeParse(request.payload);
    if (!input.success) {
      throw new DesktopShellError("REQUEST_INVALID", "Action payload is invalid.");
    }

    const controller = new AbortController();
    const controllers = this.inFlight.get(windowId) ?? new Set<AbortController>();
    controllers.add(controller);
    this.inFlight.set(windowId, controllers);
    const timeoutMs = Math.max(100, Math.min(5 * 60_000, definition.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS));
    let timer: NodeJS.Timeout | undefined;

    try {
      const context: ActionContext = Object.freeze({
        windowId,
        capability: definition.capability,
        signal: controller.signal
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new DesktopShellError("REQUEST_TIMEOUT", "The operation timed out.", {
              retryable: true,
              actionNeeded: "retry"
            })
          );
          controller.abort("timeout");
        }, timeoutMs);
        timer.unref();
      });
      const value = await Promise.race([Promise.resolve(definition.handler(context, input.data)), timeout]);
      const output = definition.output?.safeParse(value);
      if (output && !output.success) {
        throw new DesktopShellError("HANDLER_FAILED", "Action returned an invalid result.");
      }
      const result = output?.data ?? value;
      if (serializedSize(result) > this.maxPayloadBytes) {
        throw new DesktopShellError("REQUEST_TOO_LARGE", "Action result exceeds the allowed size.");
      }
      return { requestId: request.requestId, value: result };
    } finally {
      if (timer) clearTimeout(timer);
      controllers.delete(controller);
      if (controllers.size === 0) this.inFlight.delete(windowId);
    }
  }

  abortWindow(windowId: string, reason = "window-closed"): void {
    const controllers = this.inFlight.get(windowId);
    if (!controllers) return;
    for (const controller of controllers) controller.abort(reason);
    this.inFlight.delete(windowId);
  }
}
