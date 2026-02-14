<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# skills

## Purpose
Claude Code skill definitions and metadata used to extend command workflows for this project.

## Key Files

| File | Description |
|------|-------------|
| `insights-collect/SKILL.md` | Skill spec for insights collection workflow. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `insights-collect/` | Insights-related skill definition (see `insights-collect/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Keep skill behavior synchronized with CLI command names/options.

### Testing Requirements
- Manually validate skill command flow after edits.

### Common Patterns
- One directory per skill, with a `SKILL.md` specification.

## Dependencies

### Internal
- Skills typically orchestrate commands from `src/cli.ts`.

### External
- Claude Code skill runtime.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
