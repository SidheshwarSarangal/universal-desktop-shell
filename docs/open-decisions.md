# Open Decisions

The design becomes implementation-ready when the blocking rows below are resolved. Record each outcome with rationale, owner, and review date.

## Decision flow

```mermaid
flowchart LR
    Scope[Lifecycle + platform scope] --> Content[Frontend/content policy]
    Content --> Security[Bridge + security controls]
    Security --> API[Public API]
    API --> Budgets[Performance budgets]
    Budgets --> Test[Test/release policy]
    Test --> Ready[Implementation ready]
```

## Blocking decisions

| Area | Decision required | Why it blocks |
| --- | --- | --- |
| Lifecycle | Shell owns app lifecycle or windows only? | Determines startup, quit, single-instance, and API ownership |
| Windows | One window only in v1, or defined additional types? | Determines sessions, capabilities, events, and memory model |
| Frontend | Local production builds only, or approved remote production URLs? | Changes trust model, CSP, navigation, offline, and updates |
| Development | How is dev mode selected and which origins are allowed? | Prevents dev behavior leaking into production |
| Bridge | Functions/class API and action/event contract? | Required for typing, versioning, validation, and tests |
| Validation | Shell versus host schema and authorization ownership? | Required to avoid gaps or duplicated assumptions |
| Sessions | Shared or partitioned by window/frontend? | Controls cookie, cache, permission, and capability isolation |
| State | Which host adapter persists window state? | Avoids adding storage/business logic to the shell |
| Recovery | Retry limits and user/host recovery choices? | Prevents hangs, data loss, and crash loops |
| Platforms | Supported Windows versions, Linux distributions/desktops/package formats? | Defines actual compatibility claims and test matrix |
| Performance | Startup, memory, CPU, IPC, and artifact budgets? | Makes optimization verifiable |
| Release | Which regression/security failures block release? | Defines acceptance and exception handling |
| Packaging | What belongs here versus each host app? | Prevents coupling the reusable shell to one distributor |
| Distribution | Signing, update verification, and rollback owner/tooling? | Required before public automatic updates |

## Deferred unless a real need appears

- macOS support
- custom title bars
- multi-window framework beyond approved v1 cases
- remote production frontends
- automatic updates inside the shell package
- shell-owned telemetry or persistence

## Decision record template

```md
### DEC-XXX: Short title

- Status: proposed | accepted | superseded
- Owner:
- Date:
- Decision:
- Rationale:
- Security impact:
- Performance impact:
- Tests required:
```
