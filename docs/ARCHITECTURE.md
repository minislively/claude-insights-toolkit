# Architecture

This document describes the internal architecture of Claude Insights Toolkit.

## Overview

Claude Insights Toolkit follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Interface                      │
│                    (Commander.js)                       │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌──────────┐
    │Collectors│ │Analyzers│ │Generators│
    └────┬────┘ └────┬────┘ └────┬─────┘
         │           │            │
         └───────────┼────────────┘
                     ▼
              ┌─────────────┐
              │   Storage   │
              │   (Local)   │
              └─────────────┘
                     ▲
                     │
              ┌─────────────┐
              │   Claude    │
              │   Facets    │
              │ ~/.claude/  │
              └─────────────┘
```

## Core Modules

### 1. CLI (`src/cli.ts`)

**Responsibility:** Command-line interface and user interaction

**Commands:**
- `collect` - Gather insights from Claude Code
- `analyze` - Detect bottlenecks
- `suggest` - Generate CLAUDE.md improvements
- `trend` - Show productivity trends
- `init` - Initialize configuration

**Dependencies:**
- Commander.js for argument parsing
- Chalk for colored output
- Ora for spinners

**Example Flow:**
```
User: cit analyze --days 7
  ↓
CLI parses arguments
  ↓
Load data from storage (7 days)
  ↓
Call analyzeBottlenecks(data)
  ↓
Format and display results
```

### 2. Collectors (`src/collectors/`)

**Responsibility:** Data collection from Claude Code facets

**Key Functions:**
- `collectFacets()` - Main collection orchestrator
- `loadFacetsFile()` - Parse single facets file
- `validateFacetsData()` - Schema validation
- `getAvailableDates()` - Discover available data

**Data Flow:**
```
~/.claude/usage-data/facets/
  ↓ Read JSON files
Parse & validate
  ↓ Transform to IInsightsDay
Store in local database
  ↓
Return collection summary
```

**Implementation Notes:**
- Use Node.js `fs.promises` for async file operations
- Validate against TypeScript interfaces
- Handle missing/corrupted files gracefully
- Support date filtering and bulk collection

### 3. Analyzers (`src/analyzers/`)

**Responsibility:** Pattern detection and trend analysis

#### Bottleneck Analyzer (`bottleneck.ts`)

Detects friction patterns from insights data.

**Algorithm:**
1. Aggregate friction points across all sessions
2. Count occurrences per friction type
3. Calculate average duration for affected sessions
4. Determine severity based on frequency and impact
5. Generate suggested fixes

**Severity Thresholds:**
- Critical: > 10 occurrences OR avg duration > 60 min
- High: > 5 occurrences OR avg duration > 30 min
- Medium: > 2 occurrences
- Low: ≤ 2 occurrences

**Output:**
```typescript
{
  bottlenecks: [
    {
      type: 'missing_context',
      occurrences: 12,
      averageSessionDuration: 45,
      affectedSessions: ['session-1', 'session-2', ...],
      suggestedFix: 'Add architecture overview to CLAUDE.md',
      severity: 'high'
    }
  ],
  topFrictionTypes: ['missing_context', 'unexpected_behavior'],
  recommendedActions: ['...']
}
```

#### Trend Analyzer (`trends.ts`)

Analyzes productivity metrics over time.

**Metrics:**
- `sessions` - Session count per day
- `duration` - Average session duration
- `friction` - Friction point frequency
- `success_rate` - Percentage of successful sessions

**Algorithm:**
1. Extract metric values as time series
2. Apply optional moving average smoothing
3. Calculate linear regression slope
4. Determine trend direction (increasing/decreasing/stable)
5. Calculate percentage change between periods
6. Generate human-readable insights

**Output:**
```typescript
{
  trends: [
    {
      metric: 'friction',
      trend: 'decreasing',
      changePercentage: -20,
      dataPoints: [
        { date: '2025-02-01', value: 15 },
        { date: '2025-02-02', value: 12 },
        ...
      ]
    }
  ],
  insights: [
    'Friction points decreased 20% over the last week',
    'Sessions increased consistently'
  ]
}
```

### 4. Generators (`src/generators/`)

**Responsibility:** CLAUDE.md content generation

**Strategy:**

Maps friction types to CLAUDE.md sections:

| Friction Type | CLAUDE.md Section | Strategy |
|---------------|-------------------|----------|
| `missing_context` | Architecture | Add overview, diagrams, key concepts |
| `unclear_instructions` | Examples | Add code examples, step-by-step guides |
| `tool_limitations` | Constraints | Document workarounds, known issues |
| `unexpected_behavior` | Patterns | Common patterns, best practices |
| `performance_issues` | Performance | Optimization tips, benchmarks |

**Output Format:**
```markdown
## Architecture Overview

Based on analysis, sessions struggled with missing context 12 times.

### System Architecture

[Generated architecture description]

### Key Components

- Component A: [Description]
- Component B: [Description]

## Common Patterns

[Generated patterns based on unclear instructions]

## Development Constraints

[Generated constraints based on tool limitations]
```

### 5. Storage (`src/utils/storage.ts`)

**Responsibility:** Data persistence and retrieval

**Storage Structure:**
```
.cit-data/
├── 2025-02-01.json
├── 2025-02-02.json
├── ...
├── index.json          # Metadata index
└── config.json         # Storage configuration
```

**File Format:**
```json
{
  "date": "2025-02-05",
  "sessions": [...],
  "totalSessions": 5,
  "totalDurationMinutes": 180,
  "frictionCounts": {...},
  "goalCounts": {...}
}
```

**Key Features:**
- Efficient date-based file organization
- Automatic cleanup of old data
- Export/import functionality
- Storage statistics tracking

### 6. Types (`src/types/insights.ts`)

**Responsibility:** TypeScript type definitions

Comprehensive type system matching Claude Code's insights schema:
- Enums for categorical values
- Interfaces for data structures
- Type guards for validation

## Data Flow

### Collection Flow

```
1. User runs: cit collect --date 2025-02-05

2. CLI → collectFacets({ date: '2025-02-05' })

3. Collector:
   - Read ~/.claude/usage-data/facets/2025-02-05.json
   - Validate against IInsightsDay schema
   - Transform data if needed

4. Storage:
   - Store to .cit-data/2025-02-05.json
   - Update index.json

5. Return summary to CLI

6. CLI displays:
   ✔ Insights data collected successfully
   • Sessions collected: 5
   • Date range: 2025-02-05
```

### Analysis Flow

```
1. User runs: cit analyze --days 7

2. CLI:
   - Calculate date range (today - 7 days)
   - Load data via loadStoredData({ days: 7 })

3. Storage:
   - Read last 7 JSON files from ~/.cit-data/
   - Combine into IInsightsDay[]

4. Analyzer:
   - analyzeBottlenecks(data)
   - Aggregate friction points
   - Calculate severity
   - Generate suggestions

5. CLI formats and displays results
```

### Suggestion Flow

```
1. User runs: cit suggest

2. CLI:
   - Load recent analysis or run new one
   - Call generateClaudeMd(analysis)

3. Generator:
   - Group bottlenecks by category
   - Map to CLAUDE.md sections
   - Generate markdown content

4. CLI:
   - Display suggestions
   - Optionally write to file
```

## Extension Points

### Custom Analyzers

```typescript
// Create custom analyzer
export function myCustomAnalyzer(data: IInsightsDay[]): IAnalyzerResult {
  // Your logic
  return {
    summary: 'Custom analysis',
    generatedAt: new Date().toISOString(),
  };
}

// Use in CLI
import { myCustomAnalyzer } from './analyzers/my-custom';
const result = myCustomAnalyzer(data);
```

### Custom Generators

```typescript
// Create custom generator
export function generateCustomSection(bottlenecks: IBottleneck[]): string {
  return '## My Custom Section\n\n...';
}

// Integrate
import { generateCustomSection } from './generators/custom';
const content = generateCustomSection(analysis.bottlenecks);
```

## Performance Considerations

### File I/O

- Use streaming for large files
- Implement caching for frequently accessed data
- Parallel file reads when loading date ranges

### Memory Management

- Don't load all data at once
- Implement pagination for large datasets
- Stream results when possible

### Analysis Optimization

- Cache analysis results
- Incremental updates for new data
- Parallel processing of independent analyses

## Security Considerations

### Data Privacy

- All data stored locally (no external transmission)
- User controls retention period
- Export/import with user consent only

### File System Safety

- Validate all file paths
- Prevent directory traversal
- Handle permissions errors gracefully

## Future Architecture

### Planned Enhancements

1. **Plugin System**
   - Custom analyzers as plugins
   - Community-contributed generators
   - Plugin marketplace

2. **Web Dashboard**
   - React-based visualization
   - Interactive trend charts
   - Real-time updates

3. **Database Backend**
   - SQLite for better querying
   - Full-text search
   - Advanced filtering

4. **Team Features**
   - Shared insights
   - Team analytics
   - Aggregated reports

## Testing Strategy

### Unit Tests

- Test each function in isolation
- Mock file system operations
- Test edge cases (empty data, corrupted files)

### Integration Tests

- Test full collection → analysis → generation flow
- Test CLI commands end-to-end
- Test error handling paths

### Test Coverage Goals

- Core modules: > 90%
- Utilities: > 80%
- CLI: > 70%

## Build and Distribution

### Build Process

```bash
npm run build
  ↓
TypeScript compilation (tsc)
  ↓
Output to dist/
  ↓
Ready for distribution
```

### Distribution Formats

- **npm package** - Standard distribution
- **Binary executables** - pkg or nexe for standalone
- **Docker image** - Containerized version

## Development Workflow

```
1. Clone repository
2. npm install
3. npm run dev -- collect (run CLI in dev mode)
4. Make changes
5. npm test (run tests)
6. npm run lint (check style)
7. npm run build (compile)
8. Submit PR
```

## References

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Insights Schema](./INSIGHTS_SCHEMA.md)
- [API Documentation](./API.md)
- [Contributing Guide](../CONTRIBUTING.md)
