# Security Review Plan

## 1. Purpose

This plan converts the security guidance in *Key Security Aspects for the Desktop Automation System* into a focused review for the Universal Desktop Shell.

It does not approve a final implementation or security configuration. Its purpose is to identify trust boundaries, assign responsibilities, define the questions that must be answered, and establish evidence-based security acceptance criteria before development begins.

## 2. Scope boundary

The source security document covers the complete desktop automation system. Only a subset belongs inside the Universal Desktop Shell.

### Owned by the Universal Desktop Shell

- Secure creation and configuration of Electron windows
- Isolation of the renderer from Node.js and operating-system capabilities
- Restricted preload exposure
- IPC transport conventions and enforcement hooks
- Frontend source, navigation, popup, permission, and download policies
- Safe frontend load failures
- Shell lifecycle and security-relevant events
- Security-focused tests for the window and renderer boundary

### Owned by the host application

- Selection and registration of permitted business actions
- Authorization and schema validation for product-specific requests
- Secret and token lifecycle
- OS-backed secret storage integration
- Database, logging, telemetry, and data-retention policy
- Coordination of Gmail, Nodrica, portal, and other packages

### Outside this project's responsibility

- Gmail OAuth and Gmail scopes
- Portal credentials, cookies, profiles, CAPTCHA, and OTP handling
- Automation limits and submission confidence rules
- Workflow persistence and duplicate-action recovery
- Database transactions and migrations
- Product-specific privacy and deletion workflows

The shell may enforce generic boundaries that help these systems, but it must not implement their business rules.

## 3. Security objective

The primary objective is to ensure that frontend code cannot obtain privileged access merely because it is displayed inside the desktop application.

The working rule is:

> Treat the main process as privileged, treat renderer content as untrusted, validate every boundary, and keep secrets out of renderer-visible state.

This is a starting principle. The review must also consider that the main process, preload code, dependencies, frontend build pipeline, and update mechanism can themselves be compromised.

## 4. System assets to protect

The review will identify how the shell could affect the following assets even when it does not own them:

- Operating-system files and commands
- User identity and local profile
- OAuth tokens, cookies, credentials, and API keys
- Application databases and workflow state
- Private email, resume, profile, and report content
- Host action interfaces
- Application integrity and signed releases
- Logs, crash reports, screenshots, and diagnostic exports

## 5. Trust boundaries

```text
Potentially untrusted                       Privileged

Frontend / renderer
        |
        | context bridge: narrow public API
        v
Preload boundary
        |
        | named IPC request with validated data
        v
Electron main process
        |
        | explicitly registered host capability
        v
Host application and external packages
```

Additional boundaries requiring review are:

- local frontend assets versus development URLs;
- application-controlled URLs versus external navigation;
- renderer messages versus main-process event senders;
- shell configuration versus raw Electron option overrides;
- trusted packaged code versus third-party dependencies and updates.

## 6. Threat scenarios to analyze

The threat-model session will examine at least these scenarios:

1. Compromised frontend code attempts to access Node.js, files, processes, or secrets.
2. Renderer input invokes an unknown, incorrectly authorized, or overly powerful IPC action.
3. A permitted action receives malformed, oversized, deeply nested, or path-traversal input.
4. An IPC request originates from an unexpected frame, window, or navigated origin.
5. The window is redirected from approved content to a malicious page.
6. Frontend code opens an uncontrolled popup or external protocol.
7. Remote scripts or development tooling remain enabled in production.
8. Error pages, logs, or events disclose local paths, tokens, request data, or internal stack traces.
9. Unsafe Electron configuration is introduced through a generic override mechanism.
10. A compromised dependency, frontend artifact, or application update changes trusted code.
11. A denial-of-service attempt floods IPC, events, memory, windows, or large payloads.
12. A second window or reused session gains capabilities intended for another frontend.

## 7. Review workstreams

### 7.1 Electron window hardening

Review the complete set of effective `BrowserWindow` and `webPreferences` values rather than checking only selected flags.

Questions and evidence:

- Is context isolation always enabled?
- Is renderer Node.js integration always disabled?
- Is sandboxing enabled and verified for the chosen preload design?
- Can host configuration weaken mandatory security properties?
- Is insecure mixed content rejected?
- Are experimental, remote-module, or development features absent from production?
- Are all created windows, including child windows, subject to the same policy?

Deliverable: an immutable baseline of security-critical options plus a documented list of safe configurable options.

### 7.2 Frontend content and navigation policy

Define distinct policies for local production content and development-server content.

Questions and evidence:

- Which URL schemes, hosts, ports, and file locations are allowed?
- Are redirects revalidated rather than trusted automatically?
- Are new-window requests denied by default?
- How are approved external links opened without granting them application privileges?
- Are permission, download, and external-protocol requests denied unless explicitly handled?
- What Content Security Policy is required, and which layer owns it?

Deliverable: a source-validation and navigation decision table covering development, production, and external content.

### 7.3 Preload API design

The preload API must expose product-neutral communication primitives without exposing raw Electron, Node.js, or IPC objects.

Questions and evidence:

- Does the renderer receive only frozen, narrowly typed functions?
- Can it choose arbitrary IPC channels or subscribe to arbitrary main-process events?
- Are listener registration and removal safe and leak-resistant?
- Are errors normalized before crossing into the renderer?
- Can values with unsafe prototypes, functions, or unexpected binary size cross the bridge?

Deliverable: a versioned public bridge contract with explicit methods, event behavior, size limits, and error shapes.

### 7.4 IPC authorization and validation

The shell should provide a safe registration pattern, while the host remains responsible for product-specific authorization and schemas.

Every IPC request must be evaluated for:

- allowlisted action name;
- sender window, frame, and expected origin;
- payload schema and required fields;
- type, nesting, count, and byte-size limits;
- path safety when a host action legitimately accepts a path;
- user permission and current application state;
- timeout, cancellation, and concurrency policy.

Unknown actions and invalid requests must fail closed without invoking host code.

Deliverable: action-registration rules, sender verification rules, validation ownership, and a standardized rejection model.

### 7.5 Secrets and renderer data exposure

The shell must never request or store product secrets. It must also make accidental exposure harder.

Questions and evidence:

- Can configuration, events, failures, or diagnostics contain tokens or credentials?
- Are sensitive headers and URL parameters removed from renderer-visible errors?
- Can renderer state, developer tools, screenshots, clipboard behavior, or crash reporting reveal host data?
- Does the API encourage opaque identifiers and minimum necessary data instead of returning complete privileged objects?

Deliverable: renderer data-classification rules and a list of forbidden values at the shell boundary.

### 7.6 Error handling and security events

The shell must distinguish user-safe messages from diagnostic details.

Define behavior for:

- rejected frontend sources and navigation;
- certificate and TLS failures;
- renderer crashes and unresponsive states;
- preload failures;
- invalid or unauthorized IPC requests;
- frontend load failures;
- unexpected child-window or permission requests.

Deliverable: normalized error codes, user-safe fallback behavior, and host-only diagnostic events without sensitive payloads.

### 7.7 Sessions and multiple windows

If multiple windows or frontend types are supported, determine whether they share storage, cache, cookies, permissions, and bridge capabilities.

Deliverable: a session-partition strategy and capability rules for every window type. The default should not silently broaden access through shared state.

### 7.8 Dependencies, packaging, and update integrity

Although packaging is not a core shell responsibility, trusted desktop code cannot be evaluated without defining its distribution boundary.

Questions and evidence:

- How are Electron and dependencies pinned, audited, and updated?
- How are frontend artifacts included and protected from unintended replacement?
- How are installers and updates signed and verified for public distribution?
- What rollback policy applies after a faulty or compromised update?
- Are source maps and development artifacts excluded or deliberately controlled?

Deliverable: documented responsibilities between this package and the host application's build/release system.

## 8. Planned review sequence

### Phase 1: Confirm architecture and assets

1. Confirm whether the shell owns Electron application lifecycle or only windows.
2. Confirm single-window and multi-window requirements.
3. List all frontend source types and runtime modes.
4. Identify host capabilities the first example application needs.
5. Draw data flows and mark privileged boundaries.

Output: approved scope, data-flow diagram, and asset inventory.

### Phase 2: Build the threat model

1. Review each trust boundary and entry point.
2. Identify spoofing, tampering, disclosure, privilege escalation, and denial-of-service scenarios.
3. Rate likelihood and impact using an agreed scale.
4. Assign each mitigation to the shell, host, frontend, or release pipeline.
5. Record accepted risks and their owners.

Output: prioritized threat register and responsibility matrix.

### Phase 3: Design mandatory controls

1. Finalize immutable Electron security defaults.
2. Define frontend source and navigation policies.
3. Define the preload bridge contract.
4. Define IPC registration, sender verification, validation, limits, and failures.
5. Define session isolation and safe error behavior.

Output: security architecture specification suitable for implementation.

### Phase 4: Define verification before coding

1. Translate every mandatory control into an automated or manual test.
2. Add negative tests for bypass attempts and invalid inputs.
3. Define Windows and Linux security smoke-test environments.
4. Select dependency and packaged-artifact scanning checks.
5. Define the evidence required for release approval.

Output: security test plan and traceability matrix from threat to control to test.

### Phase 5: Implement and review

1. Implement the smallest approved security surface.
2. Review effective runtime settings, not only source configuration.
3. Test with benign and intentionally hostile example frontends.
4. Review host integration for accidental privilege expansion.
5. Resolve or explicitly accept all high-priority findings before release.

Output: reviewed implementation and residual-risk record.

## 9. Preliminary verification checklist

The following checklist is provisional and will be converted into detailed tests after the threat model:

- [ ] Renderer code cannot access Node.js globals or modules.
- [ ] Context isolation and sandbox behavior are verified at runtime.
- [ ] Security-critical window options cannot be weakened by host overrides.
- [ ] Only approved frontend sources can load.
- [ ] Unexpected navigation, popups, permissions, downloads, and protocols are denied.
- [ ] Production does not load development servers or remote scripts unintentionally.
- [ ] The preload bridge exposes no raw Electron or IPC objects.
- [ ] Every request uses an allowlisted action and validated payload.
- [ ] Every request verifies its sender and expected application state.
- [ ] Unknown, malformed, oversized, and unauthorized requests fail closed.
- [ ] Renderer-facing failures contain no secrets or sensitive internal details.
- [ ] Shell logs and events use structured, redacted data.
- [ ] Multiple windows cannot inherit unintended sessions or capabilities.
- [ ] Renderer crash, hang, preload failure, and load failure behavior is tested.
- [ ] Dependency, packaged-artifact, signing, update, and rollback responsibilities are documented.
- [ ] Security behavior is exercised on both Windows and Linux.

## 10. Security review outputs

Before implementation is considered security-ready, the project should contain:

1. A data-flow and trust-boundary diagram.
2. An asset inventory and data-classification table.
3. A prioritized threat register.
4. A shell-versus-host responsibility matrix.
5. An approved Electron security baseline.
6. A frontend source and navigation policy.
7. A versioned preload and IPC contract.
8. A validation, limit, timeout, and error-handling policy.
9. A security test and traceability matrix.
10. A residual-risk and release-review record.

## 11. Decisions intentionally deferred

The following are not decided by this plan:

- exact Electron or validation-library versions;
- final bridge method and channel names;
- production support for remote frontends;
- window and application lifecycle ownership;
- shared versus isolated sessions;
- exact payload and rate limits;
- logging and crash-reporting providers;
- packaging, signing, and update tooling.

These decisions should be made only after the Phase 1 architecture review and Phase 2 threat model provide enough context.
