<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# src

## Purpose
Main TypeScript backend for Claude Insights Toolkit. Contains CLI command wiring, data collectors, analyzers, report/suggestion generators, server handlers, and supporting services/types.

## Key Files

| File | Description |
|------|-------------|
| `cli.ts` | CLI entrypoint implementing `cit` commands and option parsing. |
| `index.ts` | Public library exports. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `analyzers/` | Analysis logic for bottlenecks, trends, profiles, etc. (see `analyzers/AGENTS.md`). |
| `collectors/` | Data collection/parsing ingestion entrypoints (see `collectors/AGENTS.md`). |
| `commands/` | Command-level orchestration for setup/daemon/dashboard/etc. (see `commands/AGENTS.md`). |
| `config/` | Shared config types/docs (see `config/AGENTS.md`). |
| `extractors/` | Specialized data extraction utilities (see `extractors/AGENTS.md`). |
| `generators/` | Markdown/report generation utilities (see `generators/AGENTS.md`). |
| `notifications/` | Notification-related types/docs (see `notifications/AGENTS.md`). |
| `parsers/` | HTML/report parsing logic (see `parsers/AGENTS.md`). |
| `server/` | Dashboard API/static server handlers (see `server/AGENTS.md`). |
| `services/` | Business services (issue ledger, daemon, CLAUDE.md manager) (see `services/AGENTS.md`). |
| `stores/` | Simple persistence/helper stores (see `stores/AGENTS.md`). |
| `types/` | Shared domain types (see `types/AGENTS.md`). |
| `utils/` | Generic helper utilities (see `utils/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep command behavior and analyzer output contracts stable.
- Prefer focused edits in the relevant module directory rather than broad cross-cutting changes.

### Testing Requirements
- Run root tests (`npm test`) for backend changes.
- Run `npm run build` to ensure TypeScript compile passes.

### Common Patterns
- Pure analysis functions in `analyzers/`.
- IO-heavy logic in `collectors/`, `services/`, and `commands/`.

## Dependencies

### Internal
- Consumes shared domain models from `types/`.
- Exposes APIs used by dashboard/web layers.

### External
- `commander`, `ora`, `chalk`, `cheerio`, `simple-git`, `chokidar`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
