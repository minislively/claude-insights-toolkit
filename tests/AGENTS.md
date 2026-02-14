<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# tests

## Purpose
Repository-level test resources and fixtures used by analyzer/collector tests.

## Key Files

| File | Description |
|------|-------------|
| `fixtures/sample-insights.json` | Sample insights dataset for testing/demo flows. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `fixtures/` | Static fixture data (see `fixtures/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep fixture schemas compatible with current parser/analyzer contracts.

### Testing Requirements
- Re-run impacted Jest suites after fixture updates.

### Common Patterns
- Static JSON fixture files for deterministic tests.

## Dependencies

### Internal
- Consumed by backend tests under `src/**/__tests__/`.

### External
- None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
