<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# analyzers

## Purpose
Core analytics modules that transform collected session data into insights (bottlenecks, trends, profiles, productivity, patterns, comparisons).

## Key Files
| File | Description |
|------|-------------|
| `bottleneck.ts` | Detects high-friction workflow bottlenecks. |
| `trends.ts` | Computes time-series productivity trends. |
| `profile.ts` | Generates coding style/profile summaries. |
| `pattern-extractor.ts` | Extracts reusable successful workflow patterns. |
| `compare.ts` | Compares insight metrics between dates. |
| `index.ts` | Analyzer exports. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Unit tests for analyzer behavior (see `__tests__/AGENTS.md`). |

## For AI Agents
### Working In This Directory
- Keep analyzer outputs deterministic and backward compatible with CLI formatting.
### Testing Requirements
- Run analyzer tests and `npm test` after logic changes.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
