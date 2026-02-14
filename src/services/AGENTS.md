<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# services

## Purpose
Business-logic services coordinating side effects and state transitions (daemon orchestration, issue ledger, CLAUDE.md block management).

## Key Files
| File | Description |
|------|-------------|
| `daemon.ts` | Daemon runtime/service logic. |
| `claude-md-manager.ts` | Safe managed updates for CLAUDE.md suggestion block. |
| `issue-ledger.ts` | Tracks recurring issues from bottleneck analysis. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Service tests (see `__tests__/AGENTS.md`). |

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
