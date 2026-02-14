<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# src

## Purpose
Frontend React source for the insights dashboard: routing, pages, shared UI components, hooks, i18n, and chart rendering.

## Key Files
| File | Description |
|------|-------------|
| `App.tsx` | Router setup and lazy-loaded page routes. |
| `main.tsx` | React app bootstrap. |
| `index.css` | Global styles. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable UI components and chart widgets (see `components/AGENTS.md`). |
| `hooks/` | Data-fetching and view hooks (see `hooks/AGENTS.md`). |
| `i18n/` | Localization setup and locale dictionaries (see `i18n/AGENTS.md`). |
| `pages/` | Route-level page components (see `pages/AGENTS.md`). |
| `lib/` | Frontend helper modules (see `lib/AGENTS.md`). |
| `types/` | Frontend type definitions (see `types/AGENTS.md`). |
| `assets/` | Static assets bundled with app. |

## For AI Agents
### Working In This Directory
- Keep page route paths in sync with `App.tsx`.
- Preserve API contracts expected by hooks/components.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
