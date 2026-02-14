<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# claude-insights-toolkit

## Purpose
Toolkit for collecting, analyzing, and visualizing Claude Code usage/insights. Provides a Node.js CLI (`cit`) to collect facets/reports/snapshots, run analyzers (bottlenecks, trends, profiles), and launch a React dashboard.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Root package manifest; builds TypeScript CLI/library and optionally the web UI. |
| `tsconfig.json` | Root TypeScript config for the backend/CLI build. |
| `src/cli.ts` | CLI entrypoint implementing `cit` commands (collect/analyze/suggest/dashboard/etc.). |
| `src/index.ts` | Library/public exports for programmatic usage. |
| `jest.config.js` | Jest configuration for backend tests. |
| `README.md` | Project overview and usage. |
| `INSTALL.md` | Installation and setup instructions. |
| `CHANGELOG.md` | Release notes. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `.github/` | GitHub templates and CI workflows (see `.github/AGENTS.md`). |
| `.claude-plugin/` | Claude plugin metadata (see `.claude-plugin/AGENTS.md`). |
| `src/` | Backend/CLI TypeScript source (see `src/AGENTS.md`). |
| `web/` | React/Vite dashboard UI (see `web/AGENTS.md`). |
| `docs/` | Architecture/API docs, examples, tutorials (see `docs/AGENTS.md`). |
| `tests/` | Repo-level fixtures for tests/examples (see `tests/AGENTS.md`). |
| `skills/` | Claude Code skill definitions used by this repo (see `skills/AGENTS.md`). |
| `claude-talk-to-figma-mcp/` | Separate subproject: “Talk to Figma” MCP plugin (see `claude-talk-to-figma-mcp/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Prefer editing backend code under `src/` and UI code under `web/src/`.
- Avoid modifying `dist/`, `coverage/`, and `node_modules/` (generated/installed artifacts).
- Keep CLI behavior consistent with `src/cli.ts` command definitions.

### Testing Requirements
- Backend: `npm test` (Jest)
- Typecheck/build: `npm run build`
- Web UI (from repo root): `npm run build:web` or `npm run build:all`

### Common Patterns
- CLI uses `commander` for commands/options.
- Backend is organized by responsibility: `collectors/`, `analyzers/`, `generators/`, `services/`, `commands/`, `server/`.

## Dependencies

### Internal
- `src/` provides the CLI, analyzers, and collectors.
- `web/` consumes API endpoints served by the dashboard server.

### External
- Node.js (>=18)
- TypeScript
- Jest (tests)
- React + Vite (dashboard)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
