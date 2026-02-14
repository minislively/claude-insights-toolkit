<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# .github

## Purpose
GitHub community health and CI/CD automation definitions.

## Key Files

| File | Description |
|------|-------------|
| `pull_request_template.md` | Default PR template for contributors. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `ISSUE_TEMPLATE/` | Issue templates for bug reports and feature requests (see `ISSUE_TEMPLATE/AGENTS.md`). |
| `workflows/` | GitHub Actions pipeline definitions (see `workflows/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Treat workflow changes as high-impact; keep changes minimal and explicit.

### Testing Requirements
- Validate workflow YAML syntax and trigger conditions.

### Common Patterns
- Reusable CI workflows for test/build/publish.

## Dependencies

### Internal
- CI invokes project scripts from root `package.json`.

### External
- GitHub Actions.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
