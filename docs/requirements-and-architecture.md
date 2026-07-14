# Requirements and Architecture

## 1. Document status

This document defines the current understanding of the Universal Desktop Shell. It is a requirements baseline for discussion, not a final implementation contract.

Detailed optimization and security policies are intentionally deferred until the next design review. The architecture must nevertheless preserve clear boundaries so those policies can be added without redesigning the entire package.

## 2. Problem statement

Multiple desktop products may need a real application window while using different frontend technologies. Reimplementing window creation, lifecycle handling, loading behavior, and frontend-to-backend communication for every product creates duplication and inconsistent behavior.

The project should provide one reusable desktop window container that:

- works on Windows and Linux;
- is independent of the frontend framework;
- is independent of product-specific business logic;
- can load a development frontend or a packaged production frontend;
- provides a controlled integration point for host application capabilities.

## 3. Goals

### 3.1 Primary goals

1. Create and manage a real desktop application window.
2. Load any browser-compatible frontend into that window.
3. Support Windows and Linux from one shared implementation.
4. Allow each host application to configure the window without changing the container.
5. Keep frontend, container, and backend responsibilities separate.
6. Provide lifecycle events and predictable error behavior.
7. Establish a restricted communication boundary between the frontend and host application.

### 3.2 Quality goals

- Reusable across unrelated applications
- Simple to integrate and configure
- Predictable in development and production
- Testable without embedding product logic
- Maintainable as Electron and operating systems evolve
- Secure by design, with detailed policy to be finalized separately

## 4. Non-goals

The first version is not intended to:

- implement a frontend or UI component library;
- implement application business logic;
- provide databases, AI features, authentication, or automation;
- display native UI frameworks that cannot run in a browser;
- act as a web application server;
- define installers, auto-update infrastructure, or code-signing policy;
- expose unrestricted operating-system or Node.js functionality to a frontend.

Packaging and distribution may become related projects, but they should not be coupled to the core window abstraction without a deliberate decision.

## 5. Terminology

| Term | Meaning |
| --- | --- |
| Container | The reusable package that creates and manages a desktop window. |
| Host application | The product that starts Electron, configures the container, and supplies backend actions. |
| Frontend | Browser-compatible UI loaded into the window. |
| Main process | Electron process responsible for application and native window operations. |
| Renderer | Browser environment in which the frontend runs. |
| Preload bridge | Restricted interface through which the renderer requests approved host operations. |
| Development source | A frontend URL served by a development tool. |
| Production source | A packaged local frontend entry file and its assets. |

## 6. System boundary

```text
+-------------------------------------------------------------+
| Host application                                            |
|                                                             |
|  Product configuration        Product/backend capabilities  |
|           |                              ^                  |
|           v                              |                  |
|  +-------------------------------------------------------+  |
|  | Universal Desktop Shell                               |  |
|  |                                                       |  |
|  | Window creation | Lifecycle | Loading | Event hooks   |  |
|  |                                                       |  |
|  |              Restricted preload/IPC boundary          |  |
|  +----------------------------+--------------------------+  |
|                               |                             |
|                               v                             |
|                    Browser-compatible frontend              |
+-------------------------------------------------------------+
```

The frontend is an input to the container, not part of the container. Backend capabilities belong to the host application, not to the container.

## 7. Functional requirements

### FR-01: Window creation

The container shall create an Electron desktop window from host-supplied configuration.

The configurable properties should include at least:

- title;
- initial width and height;
- minimum width and height;
- icon;
- resizable behavior;
- initial fullscreen behavior;
- whether the window is shown only when ready;
- theme preference;
- development frontend URL;
- production frontend entry path.

### FR-02: Frontend independence

The container shall not require a specific frontend framework, bundler, source language, or repository structure. A frontend is compatible when its output can run correctly in the embedded browser environment.

### FR-03: Development loading

The container shall be able to load a configured development URL. Development-specific behavior, such as developer tools, shall require explicit configuration and shall not automatically carry into production.

### FR-04: Production loading

The container shall be able to load a packaged local frontend entry file and its associated assets. Path resolution must work after application packaging; the exact packaging convention remains an open design decision.

### FR-05: Window lifecycle

The container shall handle relevant stages such as:

- application readiness;
- window creation;
- renderer readiness;
- showing and focusing;
- minimize, maximize, restore, and fullscreen transitions;
- window close and cleanup;
- reopening where required by host policy.

The ownership split between application lifecycle and individual window lifecycle must be finalized before implementation.

### FR-06: Events

The container should expose consistent events or callbacks for at least:

- window created;
- window ready;
- frontend loaded;
- frontend load failed;
- window closed.

Additional diagnostic events may be introduced during the observability review.

### FR-07: Load failure behavior

If the configured frontend cannot be loaded, the container shall avoid leaving the user with an unexplained blank window. It should expose failure information to the host and provide a safe fallback display or retry strategy.

The fallback must not reveal secrets, internal paths, or sensitive diagnostic details to end users.

### FR-08: Host communication

The frontend shall be able to request explicitly registered host actions and subscribe to explicitly registered host events through a narrow bridge.

The bridge contract must be typed and versionable. Action authorization, validation, and error handling will be specified during the security design review.

### FR-09: Configuration validation

The container shall validate configuration before creating a window and shall report actionable errors for invalid or contradictory values.

Examples include missing frontend sources, invalid dimensions, nonexistent production paths, or conflicting runtime modes.

### FR-10: Reusability

Creating a window for a different product shall require new configuration and host action registration, not modifications to the container's internal source code.

## 8. Proposed component model

### 8.1 Host integration layer

Accepts product configuration, connects product-owned backend handlers, and translates container events into host application behavior.

### 8.2 Window factory or manager

Creates the underlying `BrowserWindow`, applies validated configuration, and owns window-level lifecycle behavior.

Whether the first version exposes a factory, a stateful manager class, or both is an open API decision.

### 8.3 Frontend loader

Chooses the development URL or production entry file based on an explicit runtime mode. Reports success and normalized failure information.

### 8.4 Lifecycle coordinator

Coordinates readiness, showing, focusing, closing, and cleanup. It should avoid embedding product-specific decisions such as whether closing the final window exits the whole application.

### 8.5 Bridge boundary

Provides the smallest practical API surface between renderer and host. The container supplies the communication pattern; the host supplies the actual product actions.

### 8.6 Event and diagnostics layer

Publishes stable lifecycle and loading events. Logging destinations and production telemetry remain host-controlled.

## 9. Preliminary public API shape

The following illustrates the required information rather than committing to exact TypeScript names:

```ts
type WindowContainerConfig = {
  title: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  iconPath?: string;
  resizable?: boolean;
  fullscreen?: boolean;
  showOnReady?: boolean;
  theme?: "light" | "dark" | "system";
  frontend:
    | { mode: "development"; url: string }
    | { mode: "production"; indexPath: string };
};
```

Using a discriminated `frontend` configuration is preferable to accepting unrelated optional development and production properties because it makes the selected loading mode explicit. This remains subject to API review.

A conceptual host integration could look like:

```ts
createDesktopWindow({
  config,
  actions,
  events,
});
```

Exact method names, return values, action types, and lifecycle ownership are intentionally not finalized here.

## 10. Preliminary runtime rules

These are baseline architectural constraints, not the complete security specification:

1. The renderer must not receive general Node.js access.
2. Host capabilities must be deliberately registered rather than automatically exposed.
3. Development conveniences must be separated from production behavior.
4. A frontend load failure must be observable by the host.
5. Product secrets and persistence must remain outside the container.
6. Platform-specific behavior should be isolated behind shared abstractions where practical.

## 11. Cross-platform expectations

The project targets supported Windows and Linux desktop environments. Shared behavior should include:

- creating, showing, resizing, minimizing, maximizing, and closing windows;
- loading development and packaged production frontends;
- displaying application titles and icons where the operating system permits;
- reporting lifecycle and loading events consistently.

Operating systems and desktop environments do not always treat window controls, title bars, icons, focus, and fullscreen behavior identically. The acceptance tests must distinguish guaranteed behavior from platform-dependent presentation.

macOS is not an initial target. The architecture should avoid unnecessary barriers to future support, but no macOS behavior should be claimed until it is designed and tested.

## 12. Testing expectations

The eventual implementation should include:

- unit tests for configuration validation;
- tests for computed window options and runtime-mode selection;
- tests for event and error normalization;
- bridge contract and rejection tests;
- integration tests with a minimal plain HTML frontend;
- integration tests with at least one bundled framework frontend;
- smoke tests on both Windows and Linux;
- packaged-build tests, not only development-server tests.

## 13. Acceptance criteria for the first usable version

The first version will be acceptable when:

1. A host application can open a configured desktop window on Windows and Linux.
2. The same container can load a development URL or a packaged local frontend.
3. At least two technologically different browser frontends can be loaded without container changes.
4. The window behaves predictably across its supported lifecycle.
5. Load failures result in a defined host event and user-safe behavior.
6. The frontend has no unrestricted access to Node.js or host operating-system capabilities.
7. The host can register and handle a small set of approved actions through the bridge.
8. No application-specific business logic exists in the container package.
9. Core behavior is covered by automated tests and Windows/Linux smoke tests.
10. Basic integration and configuration are explained in the project documentation.

## 14. Deferred topics

The following require focused discussion before implementation is finalized:

- detailed security model and threat analysis;
- bridge allowlisting and payload validation;
- navigation and remote-content policy;
- performance targets and optimization strategy;
- process and memory behavior for multiple windows;
- application versus window lifecycle ownership;
- packaging and asset-path strategy;
- installer, updates, signing, and distribution;
- supported Electron, Node.js, Windows, and Linux versions;
- accessibility, localization, telemetry, and crash reporting.

These topics are tracked in [open-decisions.md](open-decisions.md). The proposed review processes are documented in [security-review-plan.md](security-review-plan.md) and [optimization-plan.md](optimization-plan.md).
