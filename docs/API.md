# API Documentation

This document describes the programmatic API for Claude Insights Toolkit.

## Table of Contents

- [Collectors](#collectors)
- [Analyzers](#analyzers)
- [Generators](#generators)
- [Storage](#storage)
- [Types](#types)

## Collectors

### `collectFacets(options)`

Collect insights data from Claude Code facets directory.

**Parameters:**
- `options: ICollectOptions`
  - `date?: string` - Specific date to collect (YYYY-MM-DD)
  - `collectAll?: boolean` - Collect all available historical data
  - `outputPath?: string` - Custom output path for collected data

**Returns:** `Promise<ICollectResult>`

**Example:**
```typescript
import { collectFacets } from 'claude-insights-toolkit';

// Collect today's data
const result = await collectFacets({});

// Collect specific date
const result = await collectFacets({ date: '2025-02-05' });

// Collect all historical data
const result = await collectFacets({ collectAll: true });
```

### `loadFacetsFile(date)`

Load facets file for a specific date.

**Parameters:**
- `date: string` - Date in YYYY-MM-DD format

**Returns:** `Promise<IInsightsDay>`

**Example:**
```typescript
const insights = await loadFacetsFile('2025-02-05');
console.log(insights.totalSessions);
```

### `getAvailableDates()`

Get list of available facets files.

**Returns:** `Promise<string[]>` - Array of dates in YYYY-MM-DD format

**Example:**
```typescript
const dates = await getAvailableDates();
console.log(`Available dates: ${dates.join(', ')}`);
```

## Analyzers

### `analyzeBottlenecks(data)`

Detect friction patterns and bottlenecks from insights data.

**Parameters:**
- `data: IInsightsDay[]` - Array of daily insights

**Returns:** `IBottleneckAnalysis`

**Example:**
```typescript
import { analyzeBottlenecks, loadStoredData } from 'claude-insights-toolkit';

// Load data for the last 7 days
const data = await loadStoredData({ days: 7 });
const analysis = analyzeBottlenecks(data);

console.log(`Found ${analysis.bottlenecks.length} bottlenecks`);
analysis.bottlenecks.forEach(b => {
  console.log(`- ${b.type}: ${b.occurrences} times (${b.severity})`);
});
```

### `analyzeTrends(data, options)`

Analyze productivity trends over time.

**Parameters:**
- `data: IInsightsDay[]` - Array of daily insights (sorted by date)
- `options: ITrendOptions`
  - `metric: 'sessions' | 'duration' | 'friction' | 'success_rate'`
  - `smoothing?: boolean` - Apply moving average

**Returns:** `ITrendAnalysisResult`

**Example:**
```typescript
import { analyzeTrends, loadStoredData } from 'claude-insights-toolkit';

// Load data for the last 30 days
const data = await loadStoredData({ days: 30 });
const trends = analyzeTrends(data, { metric: 'sessions' });

trends.trends.forEach(t => {
  console.log(`${t.metric}: ${t.trend} (${t.changePercentage}%)`);
});
```

## Generators

### `generateClaudeMd(analysis, options)`

Generate CLAUDE.md improvement suggestions.

**Parameters:**
- `analysis: IBottleneckAnalysis` - Bottleneck analysis result
- `options?: IGenerateOptions`
  - `category?: 'architecture' | 'patterns' | 'constraints' | 'examples' | 'context'`
  - `appendMode?: boolean` - Append to existing CLAUDE.md
  - `priorityThreshold?: 'low' | 'medium' | 'high'` - Filter by priority

**Returns:** `string` - Generated markdown content

**Example:**
```typescript
import { generateClaudeMd, analyzeBottlenecks, loadStoredData } from 'claude-insights-toolkit';

// Load data for the last 7 days
const data = await loadStoredData({ days: 7 });
const analysis = analyzeBottlenecks(data);
const suggestions = generateClaudeMd(analysis, {
  category: 'architecture',
  priorityThreshold: 'high',
});

console.log(suggestions);
```

## Types

### Core Types

```typescript
// Session outcome
enum Outcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  ABANDONED = 'abandoned',
}

// Friction types
enum FrictionType {
  MISSING_CONTEXT = 'missing_context',
  UNEXPECTED_BEHAVIOR = 'unexpected_behavior',
  UNCLEAR_INSTRUCTIONS = 'unclear_instructions',
  TOOL_LIMITATIONS = 'tool_limitations',
  PERFORMANCE_ISSUES = 'performance_issues',
  OTHER = 'other',
}

// Session facet
interface ISessionFacet {
  sessionId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  outcome: Outcome;
  claudeHelpfulness?: ClaudeHelpfulness;
  sessionType?: SessionType;
  primarySuccess?: PrimarySuccess;
  goalCategories: GoalCategory[];
  frictionPoints: FrictionType[];
  notes?: string;
  tags?: string[];
}

// Daily insights
interface IInsightsDay {
  date: string;
  sessions: ISessionFacet[];
  totalSessions: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number;
  frictionCounts: IFrictionCounts;
  goalCounts: IGoalCategories;
  successRate: number;
  claudeHelpfulnessAverage?: number;
}

// Bottleneck
interface IBottleneck {
  type: FrictionType;
  occurrences: number;
  averageSessionDuration: number;
  affectedSessions: string[];
  suggestedFix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

See [types/insights.ts](../src/types/insights.ts) for complete type definitions.

## Error Handling

All async functions can throw errors. Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await collectFacets({ date: '2025-02-05' });
  console.log('Success:', result);
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}
```

## TypeScript Support

All functions are fully typed. Import types for your custom implementations:

```typescript
import {
  IInsightsDay,
  IBottleneck,
  FrictionType,
  IAnalyzerResult,
} from 'claude-insights-toolkit';

function myAnalyzer(data: IInsightsDay[]): IBottleneck[] {
  // Implementation
}
```
