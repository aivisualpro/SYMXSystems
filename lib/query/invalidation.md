# Query Invalidation Strategy
This document serves as the source of truth for cross-page query invalidations. For every mutation, these are the query keys that must be invalidated to ensure cross-module cache consistency.

## Invalidation Mapping

| Mutation | Invalidates (Query Keys) | Optimistic Update Recommended? |
| :--- | :--- | :--- |
| **Update Employee** | `employees.all`, `employees.detail(id)`, `schedules.week(*)`, `hr.dashboard` | No |
| **Create/Update Schedule** | `schedules.week(yw)`, `dispatching.routes(yw)`, `hr.dashboard` | Yes (cell edits) |
| **Route Status Change** | `dispatching.routes(yw)`, `schedules.week(yw)` | Yes (status toggles) |
| **Role Edit** | `admin.roles`, `admin.users`, `permissions.current` | No |
| **HR Ticket Update** | `hr.tickets`, `hr.dashboard` | No |

## Principles
1. **Explicit Invalidation**: Always declare the precise queries that depend on the mutated data. Use `queryClient.invalidateQueries({ queryKey: [...] })`.
2. **Optimistic Updates**: For operations that need to feel instant (like switching a route status or modifying a schedule type), use the `onMutate` -> `snapshot` -> `write` -> `rollback on error` pattern to immediately reflect changes on the screen.
