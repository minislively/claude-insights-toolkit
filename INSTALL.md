# Installation Guide

Claude Insights Toolkit is a Node.js CLI tool for analyzing Claude Code productivity patterns and optimizing your CLAUDE.md configuration.

## Requirements

- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)
- **GitHub CLI** (`gh`) - optional, only needed for multi-device sync features

### Verify Your Setup

```bash
node --version    # Should be v18.0.0 or higher
npm --version
gh --version      # Optional - only if using sync features
```

---

## Quick Install (Global)

**Recommended for daily use.** Makes `cit` command available everywhere.

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/claude-insights-toolkit.git
cd claude-insights-toolkit

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Link globally
npm link
```

After this, `cit` command is available globally from any directory:

```bash
cit collect
cit analyze
cit suggest
```

### Uninstall Global

```bash
npm unlink -g claude-insights-toolkit
```

---

## Local Install (Development)

**For contributing or debugging.** Runs from source without global installation.

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/claude-insights-toolkit.git
cd claude-insights-toolkit

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build
```

### Run Commands Locally

```bash
# Option 1: Using npm scripts (works with any npm script)
npm run dev -- collect
npm run dev -- analyze
npm run dev -- suggest

# Option 2: Direct node execution
node dist/cli.js collect
node dist/cli.js analyze
```

---

## Web Dashboard Setup

The web dashboard provides visual analytics and trend tracking. It requires separate setup.

### Start Development Server

```bash
# From project root, or:
npm run dashboard

# Or manually:
cd web
npm install
npm run dev
```

Opens at **http://localhost:5173** (or next available port if 5173 is in use).

### Build for Production

```bash
cd web
npm run build
```

Outputs optimized build to `web/dist/`.

---

## Available Commands

### Data Collection & Analysis

| Command | Description |
|---------|-------------|
| `cit collect` | Collect today's insights from Claude Code |
| `cit collect --all` | Collect all historical data (up to 30 days) |
| `cit collect --date YYYY-MM-DD` | Collect data for specific date |
| `cit analyze` | Detect bottleneck patterns in workflow |
| `cit analyze --days N` | Analyze last N days (default: 7) |
| `cit suggest` | Generate CLAUDE.md improvement suggestions |
| `cit suggest --category friction` | Suggestions for friction points only |
| `cit trend` | Show productivity trend data |
| `cit trend --days N` | Trend for last N days |
| `cit status` | Quick overview of collected data |

### Multi-Device Sync (Requires GitHub CLI)

| Command | Description |
|---------|-------------|
| `cit init-sync` | Initialize sync with auto-created private GitHub repo |
| `cit init-sync --name <name>` | Custom repository name |
| `cit clone <url>` | Clone insights data to new computer |
| `cit sync` | Sync data (commit + pull + push) |
| `cit pull` | Pull latest data from remote |
| `cit push` | Push local data to remote |
| `cit remote add <url>` | Manually add remote repository |

### Reports

| Command | Description |
|---------|-------------|
| `cit report --list` | List saved HTML reports |
| `cit compare -d1 DATE -d2 DATE` | Compare insights between two dates |

---

## First Run Checklist

### 1. Verify Installation

```bash
cit --version
cit --help
```

### 2. Collect Initial Data

```bash
# Collect today's insights
cit collect

# Or grab all historical data
cit collect --all
```

This reads from `~/.claude/usage-data/facets/` (Claude Code's insights directory).

### 3. Verify Collection Success

```bash
cit status
```

Shows count of collected sessions, analysis records, and stored data.

### 4. Run Analysis

```bash
cit analyze
```

Detects bottleneck patterns and friction points from collected data.

### 5. Open Dashboard (Optional)

```bash
npm run dashboard
```

Visualize your productivity trends in the web dashboard.

---

## Multi-Device Sync Setup

Synchronize your insights data across computers using a private GitHub repository.

### First Computer (Initial Setup)

```bash
# 1. Authenticate with GitHub
gh auth login

# 2. Initialize sync (creates private repo automatically)
cit init-sync

# 3. Collect all historical data
cit collect --all

# 4. Push to remote
cit sync
```

### New Computer (Clone Existing Data)

```bash
# 1. Authenticate with GitHub
gh auth login

# 2. Clone your insights data
cit clone https://github.com/your-username/claude-insights-data

# 3. Start using toolkit
cit status
cit analyze
```

### Daily Workflow

After each Claude Code session:

```bash
cit collect && cit sync
```

This collects new insights and syncs with your other computers.

---

## Troubleshooting

### `cit: command not found` (after global install)

```bash
# Check npm global directory
npm config get prefix

# If you see ~/.nvm/versions/..., that's normal
# Make sure ~/.nvm/versions/node/{version}/bin is in your PATH

# Manual fix: reinstall global link
npm link
```

### Node version error

```bash
# Check your Node version
node --version

# If < 18.0.0, update Node.js from nodejs.org
```

### `gh` command not found (for sync features)

Install GitHub CLI from https://cli.github.com/

```bash
# macOS (Homebrew)
brew install gh

# Linux/Ubuntu
sudo apt install gh

# Windows (Chocolatey)
choco install gh
```

### Cannot find insights data

Claude Code stores insights in `~/.claude/usage-data/facets/`. Make sure:

1. You've run Claude Code at least once
2. The directory exists: `ls ~/.claude/usage-data/facets/`
3. You're collecting while Claude Code is not actively running

### Web dashboard won't start

```bash
# Make sure you're in the project root, then:
cd web
npm install

# Try a different port if 5173 is in use
npm run dev -- --port 5174
```

### Permission denied on npm link

```bash
# Try with sudo (not ideal)
sudo npm link

# Or fix npm permissions: https://docs.npmjs.com/fixing-npm-permissions
```

---

## Development

### Project Structure

```
claude-insights-toolkit/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── analyzers/          # Analysis modules
│   ├── collectors/         # Data collection modules
│   └── lib/                # Shared utilities
├── web/                    # React dashboard (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   └── App.tsx         # Main app
│   └── package.json
├── dist/                   # Compiled output
├── package.json
└── tsconfig.json
```

### Build Commands

```bash
# Build TypeScript
npm run build

# Watch mode (rebuild on changes)
npm run build -- --watch

# Run tests
npm test

# Lint code
npm lint
```

### Development Workflow

```bash
# Terminal 1: Watch mode
npm run build -- --watch

# Terminal 2: Run commands
node dist/cli.js collect
node dist/cli.js analyze
```

---

## Support & Contributing

- **Issues**: Report bugs on GitHub Issues
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **License**: MIT - see [LICENSE](./LICENSE)

For detailed CLI reference, see [README.md](./README.md).
