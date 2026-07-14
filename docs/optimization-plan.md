# Optimization Plan

## 1. Purpose

This plan converts the recommendations in *Generalized Desktop Window Container — Optimization Guide for Windows/Linux App Shell* into a measurable optimization program for the Universal Desktop Shell.

The goal is not to optimize blindly or maximize benchmark scores. The goal is to provide a shell that starts promptly, remains responsive, uses resources proportionately, recovers predictably, and behaves consistently across Windows and Linux without weakening its security boundaries.

No implementation choice or performance target in this document is final until representative host applications and test environments are agreed.

## 2. Optimization principles

1. Measure before changing behavior.
2. Separate perceived startup performance from total initialization time.
3. Keep business services off the renderer's critical path.
4. Prefer one primary window until a real multi-window use case exists.
5. Minimize preload and IPC surface area for both performance and security.
6. Do not trade away isolation, validation, or safe failure behavior for speed.
7. Use budgets and regression thresholds rather than one-time benchmark results.
8. Test packaged applications; development-server performance is not representative of production.
9. Assign optimizations to the component that owns the relevant work.
10. Make optional features pay their cost only when enabled.

## 3. Responsibility boundary

The optimization guide covers concerns across the whole desktop application. The shell should coordinate with the host but should not absorb unrelated responsibilities.

### Owned by the Universal Desktop Shell

- Window creation and time to first meaningful shell display
- Development and packaged-frontend loading
- Lightweight preload behavior
- Window event and listener management
- Window state capture, validation, and restoration
- Renderer crash and unresponsive-state presentation
- IPC envelope conventions, payload limits, cancellation hooks, and event backpressure
- Shell performance marks and normalized lifecycle events
- Loading and fallback surfaces
- Cross-platform window behavior

### Owned by the host application

- Electron application startup and single-instance policy, unless lifecycle ownership is explicitly delegated
- Business-service initialization and sequencing
- Gmail, database, Nodrica, portal, AI, and Playwright process management
- Update checks and update installation
- Application-wide shutdown and durable task recovery
- Product logging, support bundles, and telemetry destinations
- Packaging configuration, installers, signing, and distribution

### Owned by the frontend

- Bundle size and route-level code splitting
- Rendering performance, list virtualization, and UI data paging
- Image, font, and other asset optimization
- Accessibility and focus behavior
- Avoiding unnecessary polling, rerenders, and large in-memory UI state
- Displaying host and shell progress meaningfully

The shell may expose measurement and control hooks for these areas without implementing their internal logic.

## 4. Performance model

Optimization should use a shared lifecycle vocabulary:

| Mark | Meaning | Primary owner |
| --- | --- | --- |
| `process-start` | Host process begins execution. | Host |
| `app-ready` | Electron reports that native APIs are ready. | Host |
| `window-created` | Primary native window has been constructed. | Shell |
| `shell-visible` | A safe loading or application surface is visible. | Shell |
| `frontend-load-start` | Loading of the configured frontend begins. | Shell |
| `frontend-loaded` | Main document finishes loading successfully. | Shell |
| `frontend-interactive` | Frontend reports that primary interaction is available. | Frontend |
| `host-ready` | Required host capabilities are available. | Host |
| `fully-ready` | Product-defined readiness criteria are satisfied. | Host |

The shell must not report `frontend-loaded` as equivalent to `frontend-interactive` or `host-ready`. Conflating these marks would hide the real bottleneck.

## 5. Baseline and measurement plan

Before implementing optimizations:

1. Select a minimal plain-HTML fixture and one representative framework frontend.
2. Define cold-start and warm-start test procedures.
3. Test development and packaged production modes separately.
4. Record Windows and Linux hardware, OS, display scale, power mode, and package format.
5. Run enough repetitions to report median and slow-tail results rather than a single run.
6. Record memory only after defined lifecycle points and idle periods.
7. Store benchmark results with the shell version and test fixture revision.

Minimum metrics:

- process start to app ready;
- app ready to window creation;
- process start to visible shell;
- frontend load start to loaded;
- process start to frontend interactive;
- process start to host ready;
- main-process and renderer resident memory after startup and after idle;
- renderer CPU while idle;
- IPC request latency by payload class;
- event throughput and dropped/coalesced event count;
- packaged artifact size;
- renderer crash recovery time and repeated-crash behavior.

## 6. Performance budgets

Budgets must be approved after the baseline. The project should record them in a machine-readable form when implementation begins.

Each budget should define:

- metric name and lifecycle marks;
- target and maximum regression threshold;
- Windows and Linux expectations;
- cold versus warm conditions;
- fixture and hardware class;
- sampling method;
- whether failure blocks a release or only generates a warning.

Initial budgets should focus on regressions attributable to the shell. The shell should not promise total application startup time when host services and frontend code are outside its control.

## 7. Startup optimization workstream

### 7.1 Keep the critical path short

The path to a visible shell should contain only:

1. Electron readiness;
2. validated shell configuration;
3. primary window construction;
4. loading of a small local surface or the configured frontend.

Gmail, databases, portal automation, AI models, update checks, analytics, and other business services should not be imported or initialized by the shell.

### 7.2 Loading surface strategy

Choose one strategy through measurement:

- load the application frontend immediately when its initial document is reliably fast; or
- show a minimal bundled local loading surface, then transition to the application frontend.

The loading surface must be local, small, theme-aware, accessible, and free of privileged APIs. It should communicate real states instead of showing an indefinite animation.

Avoid creating a separate heavy splash `BrowserWindow` unless testing proves that it improves experience enough to justify additional process, lifecycle, and focus complexity.

### 7.3 Preload critical path

The preload bundle should:

- expose only the bridge contract;
- avoid imports from business packages;
- avoid synchronous filesystem or network work;
- avoid large schemas, caches, or eager initialization when a lightweight equivalent is possible;
- record its initialization duration in debug measurements;
- be inspected for accidental dependency growth in packaged builds.

Validation must not be removed for performance. If schema startup cost becomes material, measure smaller compiled schemas or validation placement while retaining equivalent enforcement.

### 7.4 Production asset loading

- Load packaged local assets in production.
- Keep development-server discovery and retry logic out of production bundles where practical.
- Verify asset paths inside the actual package format.
- Ensure missing or corrupted assets reach a small local fallback screen quickly.
- Avoid remote font, script, or stylesheet dependencies on the first display path.

### 7.5 Host coordination

The shell should expose readiness marks so the host can initialize optional services after the window is usable. The shell must not secretly schedule or own those services.

Single-instance locking and deferred update checks are recommended host optimizations. Their exact placement depends on the unresolved application-lifecycle ownership decision.

## 8. Memory and resource optimization workstream

### 8.1 Window count

- Use one primary window by default.
- Introduce additional windows only for documented isolation or user-experience needs.
- Do not keep hidden renderer windows as background workers.
- Measure the full process cost of every new window, not only the JavaScript heap.

### 8.2 Cleanup and ownership

For each window lifecycle, define ownership of:

- event listeners;
- timers and intervals;
- IPC handlers and subscriptions;
- abort controllers and pending requests;
- window references;
- temporary files or session resources.

Cleanup must be idempotent and tested across normal close, failed load, renderer crash, and application quit. Long-lived main-process listeners must not retain destroyed windows.

### 8.3 Window reuse policy

Do not assume that hiding is always faster or destroying is always leaner. The host should select a documented policy based on usage:

- destroy infrequently used windows to reclaim renderer resources;
- reuse frequently reopened windows only when retained state and memory are acceptable;
- never reuse a window across trust levels without resetting its session and capabilities.

### 8.4 Background behavior

Retain normal Chromium background throttling unless a measured, user-visible requirement justifies changing it. Background jobs belong outside the renderer and should not rely on keeping a hidden window active.

### 8.5 Data ownership

The bridge should send identifiers, summaries, and bounded pages rather than full datasets. The renderer should not become the source of truth for durable application state.

## 9. IPC and event optimization workstream

### 9.1 Request envelope

A versioned conceptual envelope should include:

```ts
type RequestEnvelope = {
  protocolVersion: number;
  requestId: string;
  action: string;
  payload: unknown;
};
```

This is a planning shape, not a final API. Authentication and sender verification occur outside the data supplied by the renderer and must not trust renderer-declared identity.

### 9.2 Payload policy

- Define maximum serialized request and response sizes.
- Limit nesting, item count, string length, and binary data.
- Prefer pagination or opaque handles for large results.
- Do not pass screenshots, large logs, attachments, or files through routine IPC messages.
- Measure serialization and structured-clone cost, not only handler execution time.

Opaque handles require explicit lifetime, authorization, expiry, and cleanup rules so they do not become a security bypass or resource leak.

### 9.3 Progress events

Use progress events for meaningful state changes rather than frequent renderer polling. High-frequency producers must support:

- throttling or sampling;
- batching or coalescing superseded updates;
- bounded queues;
- slow-consumer behavior;
- listener cleanup;
- sequence numbers where missed updates matter.

Progress events should convey current state, allowing the UI to recover after a missed intermediate event.

### 9.4 Cancellation and timeouts

Long-running host requests should support cancellation where the underlying operation permits it. Define:

- when cancellation is acknowledged;
- whether it is best-effort or guaranteed;
- what happens after renderer reload or close;
- default and maximum timeouts;
- cleanup of late responses;
- idempotency requirements for retries.

### 9.5 Error normalization

Use bounded, user-safe errors containing a stable code, short message, retryability, and required user action. Stack traces and large nested causes remain outside renderer-facing responses.

## 10. Window state optimization workstream

Persist only necessary state:

- normal bounds;
- maximized or fullscreen state where desired;
- display identity only as a hint;
- optional theme preference if the host assigns ownership to the shell.

State writes should be debounced and finalized during orderly shutdown when possible. Avoid synchronous disk writes on resize and move events.

On restore:

1. validate data types and reasonable bounds;
2. account for changed monitor layouts and display scaling;
3. ensure a usable portion of the window remains visible;
4. clamp dimensions to current work areas and configured minimums;
5. fall back to centered defaults when state is invalid or off-screen.

The shell should use an injected persistence adapter or host-owned storage rather than introducing a product database.

## 11. Responsiveness and recovery workstream

### 11.1 Unresponsive renderer

Detect and report unresponsive and responsive transitions. Provide host policy hooks for wait, reload, or close behavior. Avoid automatically destroying work without user or host policy.

### 11.2 Renderer crash

On renderer termination:

- retain backend state outside the renderer;
- show a minimal recovery surface where possible;
- allow controlled reload;
- record a redacted diagnostic event;
- stop automatic reload after a bounded number of failures in a time window;
- expose a stable failure state instead of entering an infinite crash loop.

### 11.3 Load failure

Normalize failure categories such as missing local asset, refused development connection, certificate failure, unreachable host, and invalid source. Retry only categories and modes for which retry is safe and useful.

### 11.4 Shutdown

The shell should emit close intent and cleanup events. The host owns task cancellation, durable state, child processes, logs, and final quit decisions. Any close delay must have a timeout and visible recovery policy so a failed service cannot trap the application indefinitely.

## 12. Cross-platform optimization workstream

### Windows

- Validate `.ico` assets at packaged resolutions.
- Test first launch, warm launch, installer launch, and high-DPI scaling.
- Verify window state across display connection and scaling changes.
- Measure the packaged application rather than an unpacked development tree.

### Linux

- Test at least the selected package formats and supported distributions.
- Test on the display systems and desktop environments selected for support.
- Avoid assuming that optional secret-service, tray, notification, or desktop integration is present.
- Verify sandbox behavior in packaged environments; do not disable it globally as a convenience workaround.
- Validate icon discovery, focus behavior, and window-state restoration across target desktops.

### Shared defaults

- Prefer the native window frame initially.
- Apply the system or saved theme before the first meaningful paint to reduce flashing.
- Test common 100%, 125%, 150%, and higher display scaling where supported.
- Keep platform branches isolated and covered by platform-specific tests.

## 13. Packaging and artifact optimization workstream

Packaging belongs primarily to the host, but the shell should publish constraints and diagnostics.

- Separate runtime dependencies from development-only tools.
- Audit the packaged dependency and file inventory.
- Track unpacked size, installer size, and installed size independently.
- Detect accidental inclusion of tests, fixtures, source maps, caches, logs, and unused platform binaries.
- Bundle the frontend before packaging and verify that no development URL is required.
- Keep native modules to the minimum necessary because they increase size and cross-platform build complexity.
- Verify asset integrity and loading from the real installed layout.
- Defer update checks until after usable startup unless a critical policy explicitly requires otherwise.
- Sign and verify public releases and define rollback behavior before automatic updates are enabled.

Package targets such as a Windows installer or Linux AppImage/DEB are host release decisions, not hard-coded shell requirements.

## 14. Observability without distortion

Performance instrumentation should be lightweight, redacted, and optional in production.

The shell should emit durations and categorical context rather than sensitive content. Useful fields include:

- shell and host version;
- operating system and architecture;
- packaged or development mode;
- lifecycle mark and duration;
- window count;
- frontend source category, not full sensitive URL;
- normalized failure code;
- recovery attempt count.

Avoid synchronous logging on hot paths. Batch or buffer diagnostics carefully with bounded memory, and let the host choose storage, rotation, consent, and export policy.

## 15. Additional optimizations beyond the source guide

### 15.1 Prevent configuration-driven regressions

Validate configuration once before window creation and normalize it into an immutable internal form. This prevents repeated parsing and makes performance and security behavior predictable.

### 15.2 Control dependency growth

Add bundle and dependency-size reporting in continuous integration. A small source change can otherwise pull a large transitive dependency into the main or preload bundle unnoticed.

### 15.3 Test listener and window leaks

Run repeated create/load/close cycles and assert stable listener counts, window references, renderer process count, and memory trend. A one-window smoke test will not reveal lifecycle leaks.

### 15.4 Guard against recovery storms

Use bounded retry policies with backoff for development-server loading and renderer recovery. A tight reload loop wastes CPU, floods logs, and makes the app unusable.

### 15.5 Preserve responsiveness under event load

Benchmark burst traffic and slow consumers, not only single IPC calls. Confirm that progress events cannot starve window lifecycle messages or user interactions.

### 15.6 Validate artifact contents

Include an automated packaged-artifact inspection step. This catches development servers, debug settings, unnecessary assets, and missing production files before runtime testing.

### 15.7 Use feature flags sparingly

Optional loading screens, state persistence, diagnostics, and multi-window behavior should be independently selectable. Feature flags must have explicit defaults and test coverage so combinations do not create an unbounded configuration matrix.

## 16. Optimization phases

### Phase 1: Establish the baseline

1. Confirm responsibility boundaries and lifecycle ownership.
2. Select frontend fixtures and platform test environments.
3. Implement lifecycle measurement definitions in the test design.
4. Benchmark cold/warm startup, memory, idle CPU, IPC, and artifact size.
5. Approve initial budgets and regression thresholds.

Output: reproducible baseline report and performance-budget proposal.

### Phase 2: Optimize the startup path

1. Minimize window construction and preload work.
2. Select and test the loading-surface strategy.
3. Verify local production asset loading.
4. Add accurate readiness marks.
5. Coordinate deferred host-service startup without moving services into the shell.

Output: startup profile with before/after results.

### Phase 3: Bound memory and IPC

1. Implement and test window cleanup ownership.
2. Define payload, queue, subscription, and timeout limits.
3. Add event coalescing and cancellation behavior where needed.
4. Test repeated window lifecycles and traffic bursts.
5. Confirm one-window defaults and document exceptions.

Output: memory trend, IPC load results, and approved resource limits.

### Phase 4: Improve recovery and cross-platform behavior

1. Implement bounded renderer and load recovery.
2. Validate window state across monitor changes.
3. Test supported display scales and Linux/Windows environments.
4. Verify safe shutdown coordination.
5. Record platform-specific deviations.

Output: recovery tests and cross-platform behavior matrix.

### Phase 5: Optimize packaged artifacts and prevent regressions

1. Inspect package contents and dependency growth.
2. Track installed and distributable sizes.
3. Run packaged performance tests.
4. Add budget checks and trend reports to continuous integration.
5. Require evidence for optimizations that add complexity.

Output: artifact report, automated regression gates, and residual tradeoff record.

## 17. Optimization acceptance checklist

- [ ] Shell performance marks have precise, non-overlapping definitions.
- [ ] Cold and warm baselines exist for Windows and Linux packaged builds.
- [ ] Approved budgets include targets and regression thresholds.
- [ ] A local shell or frontend surface appears without waiting for business services.
- [ ] Preload contains no heavy business imports or synchronous startup work.
- [ ] One primary window is the default and hidden renderer workers are not used.
- [ ] Repeated create/load/close testing shows no unbounded listener, process, or memory growth.
- [ ] IPC payloads, queues, subscriptions, timeouts, and cancellations are bounded.
- [ ] High-frequency progress is batched, sampled, or coalesced appropriately.
- [ ] Window state restoration handles disconnected displays and scaling changes.
- [ ] Renderer recovery is useful but cannot enter an unlimited reload loop.
- [ ] Development tools and development-server behavior are absent from production by default.
- [ ] Packaged artifact contents and size are inspected automatically.
- [ ] Performance logging is redacted, bounded, and off hot paths.
- [ ] Security controls remain enabled in all benchmarked configurations.
- [ ] Optimization regressions are checked continuously rather than only before the first release.

## 18. Decisions required before implementation

1. Does the shell own Electron application lifecycle or only window lifecycle?
2. Which frontend fixtures represent expected real applications?
3. Which Windows and Linux environments define initial support?
4. Is a separate loading surface needed, and what states must it show?
5. What persistence adapter owns window state?
6. Which IPC workload classes and payload sizes are expected?
7. What cold-start, memory, idle CPU, and artifact-size budgets are realistic?
8. Which performance checks block a release?
9. Which optional features are included in version one?
10. Which packaging tasks belong to the shell repository versus example host applications?

These decisions should be made alongside the security review because several performance choices—preload design, session reuse, remote content, retry behavior, and diagnostics—also affect the threat model.
