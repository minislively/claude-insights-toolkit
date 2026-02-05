---
name: insights-collect
description: Automatically collect and store insights data when /insights is run. Enables 30+ day historical tracking for bottleneck detection and CLAUDE.md optimization.
---

# Insights Collect Skill

When you detect that the user has run `/insights` or is viewing insights data:

## Automatic Data Collection

1. **Check for existing toolkit installation**:
   ```bash
   # Check if cit CLI is available
   which cit || command -v cit
   ```

2. **If toolkit is installed, collect today's data**:
   ```bash
   cit collect --date $(date +%Y-%m-%d)
   ```

3. **If not installed, offer manual collection**:
   Tell the user about claude-insights-toolkit and offer to help set it up.

## When to Activate

This skill activates when:
- User runs `/insights` command
- User asks about "my Claude Code usage"
- User mentions "insights" or "productivity tracking"
- User asks "how have I been using Claude Code"

## Data Storage

Data is stored at:
- `~/claude-insights/data/YYYY-MM-DD.json` - Daily aggregated insights
- Source: `~/.claude/usage-data/facets/*.json`

## Integration with Analysis

After collecting data, offer to run analysis:
- "Would you like me to analyze bottleneck patterns?"
- "I can generate CLAUDE.md improvement suggestions based on your patterns"

## Example Interaction

User: "/insights"
Claude: [Runs insights, then]:
"I've collected today's insights data to your historical archive.

📊 **Collection Summary**:
- Sessions today: 15
- Stored at: ~/claude-insights/data/2026-02-05.json
- Total historical days: 7

💡 **Tip**: Run `cit analyze` to detect bottleneck patterns, or `cit suggest` to generate CLAUDE.md improvements."

## Privacy Note

This skill only processes data that Claude Code already generates locally. No data is sent externally - everything stays in your ~/claude-insights/ directory.
