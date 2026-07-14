# Universal Desktop Shell

A reusable desktop window container for Windows and Linux that can display any browser-compatible frontend without depending on its framework or business domain.

This repository currently contains the project documentation only. Implementation will begin after the architecture, optimization, and security decisions have been reviewed.

## Purpose

The container will provide the desktop application window around a frontend. It will be responsible for creating and managing the window, loading the frontend, and providing a controlled communication boundary between the frontend and the host application's backend.

The first planned implementation uses Electron and its `BrowserWindow` API.

## Supported frontends

The container is intended to display any frontend that can run in a browser environment, including:

- React, Vue, Angular, Svelte, and similar frameworks
- Plain HTML, CSS, and JavaScript
- Applications built with Vite, Webpack, or comparable tools
- Browser-compatible WebAssembly applications

During development, the frontend may be loaded from a local development URL. In production, it may be loaded from a packaged local build.

Native UI technologies that do not produce browser-renderable output, such as WPF, Qt, GTK, or Java Swing, are outside the scope of this container.

## Project boundaries

The container will handle:

- Windows and Linux desktop window creation
- Window configuration and lifecycle
- Development and production frontend loading
- Safe failure handling when the frontend cannot load
- A restricted frontend-to-host communication bridge
- Reusable events and integration hooks

The container will not contain:

- Product-specific business logic
- Database or authentication implementation
- Gmail, job assistant, Nodrica, crawler, or AI logic
- Frontend source code
- Unrestricted filesystem, shell, process, or secret access
- Web-server hosting functionality

## Conceptual flow

```text
User starts host application
          |
          v
Electron application starts
          |
          v
Window container creates the desktop window
          |
          v
Configured frontend is loaded
          |
          v
Frontend uses approved bridge actions when needed
          |
          v
Host application handles those actions
```

## Documentation

- [Requirements and architecture](docs/requirements-and-architecture.md)
- [Security review plan](docs/security-review-plan.md)
- [Optimization plan](docs/optimization-plan.md)
- [Open decisions](docs/open-decisions.md)

## Current status

**Phase: requirements and architecture discussion**

No implementation choices beyond the initial Electron direction should be considered final. Optimization, detailed security controls, packaging, and other operational concerns will be reviewed before development begins.

## Proposed implementation phases

1. Confirm scope, terminology, and architectural boundaries.
2. Review optimization and security requirements.
3. Finalize the public configuration and integration APIs.
4. Build the minimum reusable window container.
5. Test it with representative frontends on Windows and Linux.
6. Decide packaging, distribution, and long-term maintenance strategy.

## One-line definition

The Universal Desktop Shell is a reusable Windows/Linux desktop shell that loads any browser-compatible frontend and connects it to host functionality through a deliberately restricted interface.
