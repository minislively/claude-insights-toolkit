# Contributing to Claude Insights Toolkit

Thank you for your interest in contributing! This document provides guidelines and instructions for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript knowledge
- Familiarity with Claude Code's insights data structure

### Development Environment Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/claude-insights-toolkit.git
   cd claude-insights-toolkit
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Run in development mode:**
   ```bash
   npm run dev -- collect
   ```

## 📋 Code Style Guidelines

### TypeScript Standards

- **Use strict TypeScript:** Enable all strict mode flags in `tsconfig.json`
- **Explicit types:** Always define return types for functions
- **Interfaces over types:** Prefer `interface` for object shapes
- **No `any`:** Avoid using `any` type (use `unknown` if necessary)

**Example:**
```typescript
// ✅ Good
interface IAnalysisResult {
  bottlenecks: IBottleneck[];
  totalSessions: number;
}

function analyzeData(data: IInsightsDay[]): IAnalysisResult {
  // Implementation
}

// ❌ Bad
function analyzeData(data: any): any {
  // Implementation
}
```

### File Naming Conventions

- **Kebab-case:** `bottleneck-detector.ts`, `claude-md-generator.ts`
- **Interfaces:** Prefix with `I` → `ISessionFacet`, `IAnalyzer`
- **Types:** PascalCase → `FrictionType`, `GoalCategory`
- **Constants:** UPPER_SNAKE_CASE → `DEFAULT_DAYS`, `MAX_SESSIONS`

### Code Organization

```typescript
// 1. Imports (grouped and sorted)
import fs from 'fs';
import path from 'path';

import { Command } from 'commander';
import chalk from 'chalk';

import { IInsightsDay } from '../types/insights';
import { analyzeBottlenecks } from './bottleneck';

// 2. Types and interfaces
interface IConfig {
  dataPath: string;
}

// 3. Constants
const DEFAULT_DAYS = 7;

// 4. Main logic
export function analyze(config: IConfig): void {
  // Implementation
}

// 5. Helper functions (private)
function loadData(): IInsightsDay[] {
  // Implementation
}
```

### ESLint Rules

Run linter before committing:
```bash
npm run lint
```

**Key rules:**
- No unused variables
- No console.log (use chalk for output)
- Prefer const over let
- Use arrow functions for callbacks
- Max line length: 100 characters

## 🧪 Testing Guidelines

### Writing Tests

- **File naming:** `*.test.ts` (co-located with source)
- **Use descriptive test names:** `it('should detect missing context friction when > 3 occurrences')`
- **AAA pattern:** Arrange, Act, Assert

**Example:**
```typescript
import { detectBottlenecks } from '../bottleneck';
import { mockInsightsData } from './fixtures';

describe('detectBottlenecks', () => {
  it('should identify top 3 friction points', () => {
    // Arrange
    const data = mockInsightsData();

    // Act
    const result = detectBottlenecks(data);

    // Assert
    expect(result.bottlenecks).toHaveLength(3);
    expect(result.bottlenecks[0].type).toBe('missing_context');
  });

  it('should return empty array when no friction', () => {
    const data = { sessions: [], frictionCounts: {} };
    const result = detectBottlenecks(data);
    expect(result.bottlenecks).toEqual([]);
  });
});
```

### Test Coverage

- Aim for >80% coverage
- Focus on critical paths (analyzers, generators)
- Mock external dependencies (file system, network)

## 🔧 Adding New Features

### Adding a New Analyzer

1. **Create analyzer file:**
   ```bash
   touch src/analyzers/my-analyzer.ts
   ```

2. **Define analyzer interface:**
   ```typescript
   import { IInsightsDay, IAnalyzerResult } from '../types/insights';

   export interface IMyAnalyzerResult extends IAnalyzerResult {
     customMetric: number;
   }

   export function analyzeMyMetric(data: IInsightsDay[]): IMyAnalyzerResult {
     // Implementation
     return {
       summary: 'Analysis summary',
       customMetric: 42,
     };
   }
   ```

3. **Export from index:**
   ```typescript
   // src/analyzers/index.ts
   export * from './my-analyzer';
   ```

4. **Add CLI command:**
   ```typescript
   // src/cli.ts
   program
     .command('my-command')
     .description('Description of my analyzer')
     .action(() => {
       const result = analyzeMyMetric(data);
       console.log(result);
     });
   ```

5. **Write tests:**
   ```typescript
   // src/analyzers/my-analyzer.test.ts
   import { analyzeMyMetric } from './my-analyzer';

   describe('analyzeMyMetric', () => {
     it('should calculate custom metric', () => {
       const result = analyzeMyMetric(mockData);
       expect(result.customMetric).toBeGreaterThan(0);
     });
   });
   ```

### Adding a New Suggestion Generator

1. **Create generator file:**
   ```typescript
   // src/generators/my-suggestion.ts
   import { IBottleneck } from '../types/insights';

   export function generateMySuggestion(bottlenecks: IBottleneck[]): string {
     // Generate CLAUDE.md content
     return `
## My New Section

Based on analysis, consider:
- Suggestion 1
- Suggestion 2
     `.trim();
   }
   ```

2. **Integrate with main generator:**
   ```typescript
   // src/generators/claude-md.ts
   import { generateMySuggestion } from './my-suggestion';

   export function generateClaudeMd(analysis: IAnalysisResult): string {
     const sections = [
       generateArchitectureSection(analysis),
       generateMySuggestion(analysis.bottlenecks),
     ];
     return sections.join('\n\n');
   }
   ```

## 🔀 Pull Request Process

### Before Submitting

1. **Run all checks:**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

2. **Update documentation:**
   - Add feature to README.md
   - Update CHANGELOG.md
   - Add JSDoc comments

3. **Create descriptive commit messages:**
   ```
   feat(analyzer): add session duration trend analysis

   - Calculates average session duration over time
   - Detects anomalies (> 2 std deviations)
   - Adds --trend flag to analyze command

   Closes #42
   ```

### PR Template

Use this template when opening a PR:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] Added new tests for feature
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. **Automated checks:** GitHub Actions runs lint, tests, build
2. **Code review:** At least one maintainer approval required
3. **Merge:** Squash and merge after approval

## 🏗️ Project Structure

```
claude-insights-toolkit/
├── src/
│   ├── cli.ts                 # CLI entry point (commander)
│   ├── index.ts               # Library exports
│   ├── collectors/
│   │   ├── facets.ts          # Collect from ~/.claude/usage-data/facets/
│   │   └── facets.test.ts
│   ├── analyzers/
│   │   ├── bottleneck.ts      # Bottleneck detection
│   │   ├── trends.ts          # Time-series analysis
│   │   ├── index.ts           # Exports
│   │   └── *.test.ts
│   ├── generators/
│   │   ├── claude-md.ts       # CLAUDE.md generator
│   │   └── *.test.ts
│   ├── types/
│   │   └── insights.ts        # TypeScript interfaces
│   └── utils/
│       ├── storage.ts         # Data persistence
│       └── logger.ts          # Logging utilities
├── dist/                      # Compiled output
├── tests/
│   └── fixtures/              # Test data
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── README.md
```

## 📚 Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Commander.js Docs](https://github.com/tj/commander.js)
- [Jest Documentation](https://jestjs.io/)

## 💬 Getting Help

- **GitHub Issues:** Report bugs or request features
- **Discussions:** Ask questions or share ideas
- **Discord:** Join our community server (coming soon)

## 🎯 Good First Issues

Look for issues labeled `good-first-issue` to get started:
- Documentation improvements
- Adding new test cases
- Enhancing CLI output formatting
- Creating example configurations

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Claude Insights Toolkit! 🚀**
