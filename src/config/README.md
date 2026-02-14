# Configuration System

> **Status:** Partial implementation (P1-007)

## Overview

The configuration system provides user customization via `.citrc` files with hierarchical override support.

## Configuration Hierarchy

Configuration is loaded in order (later overrides earlier):

1. **Defaults** (code) - Built-in sensible defaults
2. **Global** (`~/.citrc`) - User-wide settings
3. **Project** (`./.citrc`) - Project-specific settings
4. **Environment** (`CIT_*`) - Environment variables
5. **CLI** options - Command-line flags (highest priority)

## Configuration File Format

`.citrc` supports JSON format:

```json
{
  "collection": {
    "autoCollect": true,
    "schedule": "daily",
    "dataPath": "~/claude-insights/data",
    "retentionDays": 90,
    "mode": "full"
  },
  "analysis": {
    "defaultDays": 30,
    "deduplication": {
      "enabled": true,
      "strategy": "first-occurrence"
    },
    "thresholds": {
      "errorRate": 0.1,
      "duplicationRate": 0.3,
      "efficiencyScore": 0.7
    }
  },
  "dashboard": {
    "port": 3456,
    "autoOpen": true,
    "theme": "dark",
    "defaultView": "overview",
    "language": "en"
  },
  "output": {
    "format": "table",
    "colorize": true,
    "verbose": false,
    "exportFormats": ["html", "csv"]
  },
  "notifications": {
    "slack": {
      "enabled": false,
      "webhook": ""
    }
  },
  "sync": {
    "autoSync": false,
    "remoteName": "origin",
    "branch": "main"
  }
}
```

## Environment Variables

Override config via environment variables:

```bash
# Override dashboard port
CIT_DASHBOARD_PORT=8080 cit dashboard

# Disable auto-collect
CIT_COLLECTION_AUTO_COLLECT=false cit collect

# Set verbose output
CIT_OUTPUT_VERBOSE=true cit analyze
```

Environment variable naming:
- Prefix: `CIT_`
- Sections: `COLLECTION_`, `ANALYSIS_`, `DASHBOARD_`, etc.
- Keys: Snake-case uppercase (e.g., `AUTO_COLLECT`)

## CLI Commands

```bash
# List all config values
cit config list

# Get specific value
cit config get dashboard.port

# Set value
cit config set dashboard.port 8080

# Reset to defaults
cit config reset

# Validate config
cit config validate

# Edit config file directly
cit config edit
```

## Configuration Options

### Collection

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoCollect` | boolean | `true` | Auto-collect after sessions |
| `schedule` | string | `"daily"` | Collection schedule |
| `dataPath` | string | `"~/claude-insights/data"` | Data directory |
| `retentionDays` | number | `90` | Days to keep data |
| `mode` | string | `"full"` | Collection mode (full/light) |

### Analysis

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultDays` | number | `30` | Default analysis period |
| `deduplication.enabled` | boolean | `true` | Enable deduplication |
| `deduplication.strategy` | string | `"first-occurrence"` | Dedup strategy |
| `thresholds.errorRate` | number | `0.1` | Error rate threshold |
| `thresholds.duplicationRate` | number | `0.3` | Duplication rate threshold |

### Dashboard

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `port` | number | `3456` | Dashboard port |
| `autoOpen` | boolean | `true` | Auto-open browser |
| `theme` | string | `"dark"` | UI theme (light/dark/auto) |
| `defaultView` | string | `"overview"` | Default page |
| `language` | string | `"en"` | UI language (en/ko) |

### Output

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `format` | string | `"table"` | Output format |
| `colorize` | boolean | `true` | Colored output |
| `verbose` | boolean | `false` | Verbose mode |

## Schema Validation

Configuration is validated against JSON Schema:

```typescript
import Ajv from 'ajv';
import configSchema from './schema.json';

const ajv = new Ajv();
const validate = ajv.compile(configSchema);

if (!validate(config)) {
  console.error('Invalid config:', validate.errors);
}
```

## Usage Examples

### Global Config

Create `~/.citrc`:

```json
{
  "analysis": {
    "defaultDays": 90
  },
  "dashboard": {
    "theme": "light",
    "port": 8080
  }
}
```

### Project Config

Create `./.citrc` in your project:

```json
{
  "collection": {
    "excludePatterns": ["*.test.ts"]
  },
  "notifications": {
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/..."
    }
  }
}
```

### CLI Override

```bash
# Use different port for this run
cit dashboard --port 9000

# One-time verbose analysis
cit analyze --verbose --days 7
```

## Implementation TODO

- [ ] Install dependencies (cosmiconfig, ajv, dotenv)
- [ ] Config loader with hierarchy support
- [ ] JSON Schema definition
- [ ] Schema validation
- [ ] CLI config commands
- [ ] Environment variable parser
- [ ] Config migration for breaking changes
- [ ] Type-safe config access
- [ ] Config documentation generator
