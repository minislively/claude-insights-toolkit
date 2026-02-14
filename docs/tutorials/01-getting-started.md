# Getting Started with Claude Insights Toolkit

> ⏱️ Estimated time: 10 minutes

This tutorial will guide you through setting up and running your first analysis with the Claude Insights Toolkit.

## Prerequisites

- Node.js 18+ installed
- Claude Code CLI installed and configured
- At least a few Claude Code sessions completed

## Step 1: Installation

Install the toolkit globally:

```bash
npm install -g claude-insights-toolkit
```

Or use it with `npx`:

```bash
npx claude-insights-toolkit setup
```

## Step 2: Setup

Run the setup wizard to configure data collection:

```bash
cit setup
```

This will:
- ✅ Create `~/claude-insights/` directory structure
- ✅ Install a Claude Code hook for automatic data collection
- ✅ Register the hook in `~/.claude/settings.json`
- ✅ Validate the installation

**Expected output:**
```
Platform detected: darwin
Directory structure created: ~/claude-insights/{data,reports,snapshots}
Hook script installed: ~/.claude/hooks/cit-auto-collect.js
Hook registered in ~/.claude/settings.json (UserPromptSubmit)
Validation passed: Data directory exists, Hook script exists
```

## Step 3: Collect Data

Collect insights from your Claude Code sessions:

```bash
cit collect
```

**Options:**
- `-m, --mode <type>`: Collection mode (`full` or `light`, default: `full`)
- `-d, --days <number>`: Number of days to collect (default: `7`)
- `--force`: Force re-collection

**What it does:**
- Reads session data from `~/.claude/usage-data/facets/`
- Deduplicates sessions across days
- Stores structured data in `~/claude-insights/data/YYYY-MM-DD.json`

**Expected output:**
```
Collecting insights from last 7 days...
  Processing 2026-02-14...
  Processing 2026-02-13...
  ...
✅ Collected 425 sessions (12% duplicates removed)
```

##Step 4: Verify Health

Check that everything is working correctly:

```bash
cit health
```

This validates:
- Source data path exists
- Collection artifacts are current
- No duplicate collection triggers
- Git sync status (if configured)

## Step 5: Run Your First Analysis

### Bottleneck Analysis

Identify workflow bottlenecks:

```bash
cit analyze --days 30
```

**Output includes:**
- 📊 Key metrics (sessions, success rate, API blocks)
- ⚠️ Detected patterns (API cascades, wrong approaches)
- 💡 Actionable recommendations

### Other Analyses

```bash
# View productivity trends
cit trend --days 90

# Generate CLAUDE.md suggestions
cit suggest --days 30

# Profile summary
cit profile
```

## Step 6: Web Dashboard

Launch the interactive web dashboard:

```bash
cit dashboard
```

Then open http://localhost:3000 in your browser.

**Features:**
- 📊 5 analysis views (API Errors, Category Success, Session Efficiency, Helpfulness, Time Patterns)
- 📈 Interactive charts (Recharts)
- 🔄 Real-time data refresh
- 🌙 Dark mode

## Step 7: Export Results

Export your analysis to CSV or HTML:

```bash
# CSV for data analysis
cit export -f csv -o insights.csv -d 30

# HTML for sharing/reporting
cit export -f html -o report.html -d 30
```

## Troubleshooting

### "No data found. Run `cit collect` first."

**Solution:** Run `cit collect` to collect insights data.

### "Source facets path not found"

**Solution:** Ensure you have Claude Code installed and have completed at least one session.

### Hook not triggering

**Solution:**
1. Run `cit health` to check for issues
2. Verify `~/.claude/settings.json` contains the hook
3. Restart Claude Code

## Next Steps

- 📚 [Tutorial 2: Web Dashboard Usage](./02-web-dashboard.md)
- 📚 [Tutorial 3: 5 Analysis Features](./03-analysis-features.md)
- 📚 [Tutorial 4: Productivity Workflow](./04-productivity-workflow.md)
- 📚 [Use Case: Personal Developer](../examples/personal-developer.md)

## Getting Help

- Run `cit --help` for command reference
- Run `cit <command> --help` for command-specific help
- Check `cit doctor` for diagnostic information
- Report issues at https://github.com/yourusername/claude-insights-toolkit/issues
