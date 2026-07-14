# Open Decisions

This file records questions that should be resolved through discussion before or during detailed design. Items here are not approved requirements.

## 1. Package responsibility

- Does the package start and manage the Electron application, or only create windows after the host reports that Electron is ready?
- Does closing the last window exit the process, or is that always controlled by the host?
- Should one container instance manage one window or a collection of windows?

## 2. Frontend loading

- How will the runtime mode be selected: explicit configuration, build-time value, or host environment?
- Which local path convention will packaged applications use?
- Are remote production frontends permitted, or only local packaged builds?
- Should failed development URLs be retried automatically?

## 3. Bridge and security review

- How will host actions be registered and allowlisted?
- Where and how will request and response payloads be validated?
- Which events may the host send to the frontend?
- How will navigation, redirects, new windows, downloads, permissions, and external links be handled?
- What information may appear in renderer-visible errors and logs?
- What trust levels are assigned to local and remotely loaded frontends?

## 4. Optimization review

- What startup-time, first-window, and frontend-load targets are required?
- What memory budget is acceptable for one window and for multiple windows?
- Should windows be destroyed, hidden and reused, or selected through host policy?
- Should optional features be loaded lazily?
- Which measurements will be collected before optimization decisions are made?

The measurement and review approach is defined in [optimization-plan.md](optimization-plan.md).

## 5. Public API

- Should integration use functions, a class, or both?
- Should configuration be accepted as plain data only?
- How will API and bridge contracts be versioned?
- Which underlying Electron objects, if any, may be returned to the host?
- How should host applications extend behavior without bypassing container rules?

## 6. Cross-platform scope

- Which Windows versions and Linux distributions are supported?
- Which Linux display systems and desktop environments must be tested?
- Are native or custom title bars required?
- Is macOS a likely future target or explicitly out of scope?

## 7. Packaging and operations

- Is application packaging owned entirely by each host or assisted by this project?
- How are icons and frontend assets resolved after packaging?
- Will installers, automatic updates, signing, crash reporting, and telemetry be handled by separate packages?
- What release and compatibility policy will the container follow?

## 8. Testing and examples

- Which representative frontends will serve as compatibility fixtures?
- What level of automated UI testing is required on each operating system?
- Should the project include a minimal example host application, or should examples live separately?

## Suggested discussion order

1. Confirm package and lifecycle ownership.
2. Define the frontend loading and packaging boundary.
3. Complete the threat model and bridge design.
4. Finalize the public API.
5. Establish measurable performance targets.
6. Confirm platform support and test strategy.
7. Plan implementation phases.
