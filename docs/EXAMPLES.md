# Usage Examples

This document provides practical examples of using Claude Insights Toolkit.

## Basic Workflow

### 1. Initialize the toolkit

```bash
cit init
```

This creates the necessary configuration and data directories.

### 2. Collect today's insights

```bash
cit collect
```

Output:
```
✔ Insights data collected successfully

Collection Summary:
  • Sessions collected: 5
  • Date range: 2025-02-05
  • Storage location: ./.cit-data/2025-02-05.json
```

### 3. Analyze bottlenecks

```bash
cit analyze --days 7
```

Output:
```
✔ Analysis complete

🔍 Bottleneck Analysis (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  TOP FRICTION POINTS:
  1. Missing context (12 occurrences)
     → Average session time: 45min
     → Suggested fix: Add architecture overview to CLAUDE.md

  2. Unexpected behavior (8 occurrences)
     → 80% involved API integrations
     → Suggested fix: Document API patterns in CLAUDE.md

📈 TREND: Friction decreased 20% since last week
✨ Run 'cit suggest' to auto-generate CLAUDE.md updates
```

### 4. Generate CLAUDE.md suggestions

```bash
cit suggest --output CLAUDE.md.new
```

## Advanced Usage

### Collect historical data

```bash
# Collect all available data
cit collect --all

# Collect specific date
cit collect --date 2025-02-01
```

### Analyze with filters

```bash
# Focus on friction analysis
cit analyze --category friction --verbose

# Get JSON output for scripting
cit analyze --output json > analysis.json
```

### Generate targeted suggestions

```bash
# Only architecture suggestions
cit suggest --category architecture

# Append to existing CLAUDE.md
cit suggest --append --output CLAUDE.md
```

### Trend analysis

```bash
# Session count trends
cit trend --days 30 --metric sessions

# Average duration trends
cit trend --days 30 --metric duration

# Friction trends
cit trend --days 30 --metric friction

# Success rate trends
cit trend --days 30 --metric success
```

## Programmatic Usage

### Using as a library

```typescript
import {
  collectFacets,
  analyzeBottlenecks,
  generateClaudeMd,
  loadStoredData,
} from 'claude-insights-toolkit';

// Collect data
await collectFacets({ date: '2025-02-05' });

// Load and analyze (last 7 days)
const data = await loadStoredData({ days: 7 });
const analysis = analyzeBottlenecks(data);

// Generate suggestions
const suggestions = generateClaudeMd(analysis);

console.log(suggestions);
```

### Custom analyzer

```typescript
import { IInsightsDay, IBottleneck } from 'claude-insights-toolkit';

function myCustomAnalyzer(data: IInsightsDay[]): IBottleneck[] {
  // Your custom analysis logic
  return bottlenecks;
}
```

## Automation

### Daily collection script

```bash
#!/bin/bash
# Add to crontab: 0 23 * * * /path/to/collect.sh

cd /path/to/your/project
cit collect
cit analyze --days 7 > .cit-data/latest-analysis.txt
```

### Weekly report

```bash
#!/bin/bash
# Add to crontab: 0 9 * * 1 /path/to/weekly-report.sh

cd /path/to/your/project
cit analyze --days 7 | mail -s "Weekly Productivity Report" you@example.com
```

## Troubleshooting

### No data collected

**Problem:** `cit collect` finds no sessions.

**Solution:** Make sure Claude Code has generated facets data at `~/.claude/usage-data/facets/`.

### Analysis fails

**Problem:** `cit analyze` throws error.

**Solution:** Check that you have collected data first with `cit collect`.

### Suggestions too generic

**Problem:** Generated CLAUDE.md suggestions are not specific.

**Solution:** Collect more data (7+ days) for better pattern detection.

## Best Practices

1. **Collect daily:** Run `cit collect` at the end of each day
2. **Weekly analysis:** Review bottlenecks every Monday
3. **Iterate on CLAUDE.md:** Apply suggestions incrementally
4. **Track trends:** Monitor productivity changes after updates
5. **Share insights:** Use reports to improve team workflows

## Integration Examples

### VS Code task

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Collect Claude Insights",
      "type": "shell",
      "command": "cit collect",
      "problemMatcher": []
    }
  ]
}
```

### Pre-commit hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

cit collect --silent
```

### CI/CD integration

```yaml
# .github/workflows/insights.yml
name: Weekly Insights Report

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g claude-insights-toolkit
      - run: cit analyze --days 7
```
