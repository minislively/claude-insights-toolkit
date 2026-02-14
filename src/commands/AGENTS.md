<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# commands

## Purpose
Command-level orchestrators invoked by `src/cli.ts` (setup, daemon, dashboard, doctor, export, sync, health).

## Key Files
| File | Description |
|------|-------------|
| `setup.ts` | Initial project/hook/scheduler setup flows. |
| `daemon.ts` | Daemon/scheduler lifecycle management. |
| `dashboard.ts` | Dashboard startup and server orchestration. |
| `doctor.ts` | Data integrity diagnostics. |
| `sync.ts` | Cross-device Git sync operations. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Command-level tests (see `__tests__/AGENTS.md`). |

## For AI Agents
### Working In This Directory
- Keep CLI user-facing messaging clear and actionable.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
