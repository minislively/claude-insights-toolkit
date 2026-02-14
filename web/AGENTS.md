<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# web

## Purpose
React + Vite frontend dashboard for visualizing Claude insights metrics, trends, bottlenecks, and history.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Web app dependencies and scripts (`dev`, `build`, `preview`). |
| `vite.config.ts` | Vite config (dev/build behavior and aliases). |
| `index.html` | Frontend HTML entry. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Frontend source code (see `src/AGENTS.md`). |
| `public/` | Static assets served as-is. |

## For AI Agents

### Working In This Directory
- Keep routing and i18n strings consistent with page/component updates.
- Prefer changes in `web/src/` over Vite config unless build/dev behavior must change.

### Testing Requirements
- Build check: `npm run build` in `web/`.
- Lint check: `npm run lint` in `web/`.

### Common Patterns
- Page-level routes in `src/pages/`.
- Reusable UI/charts in `src/components/`.
- Data fetching via hooks in `src/hooks/`.

## Dependencies

### Internal
- Consumes dashboard API endpoints exposed by backend server handlers.

### External
- React 19, React Router, Recharts, i18next, Vite.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
