/**
 * CLAUDE.md suggestion generator
 * Generates actionable recommendations for CLAUDE.md based on bottleneck analysis
 */

import { IBottleneckResult, IBottleneckPattern } from '../analyzers/bottleneck';

export interface IClaudeMdSuggestion {
  title: string;
  section: string;
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  basedOnPatterns: string[];
}

export interface IGeneratorOptions {
  includeExamples?: boolean;
  maxSuggestions?: number;
}

/**
 * Generate CLAUDE.md suggestions based on bottleneck analysis
 */
export function generateClaudeMdSuggestions(
  analysis: IBottleneckResult,
  options: IGeneratorOptions = {}
): IClaudeMdSuggestion[] {
  const suggestions: IClaudeMdSuggestion[] = [];
  const { metrics, patterns } = analysis;
  const maxSuggestions = options.maxSuggestions || 10;

  // 1. API Error Resilience (if apiBlockedRate > 30%)
  if (metrics.apiBlockedRate > 30) {
    suggestions.push({
      title: 'API Error Resilience',
      section: '## API Error Handling',
      priority: metrics.apiBlockedRate > 50 ? 'critical' : 'high',
      basedOnPatterns: ['API Error Cascade'],
      content: `## API Error Resilience

When encountering API errors (502, infrastructure issues):

1. **DO NOT** retry immediately - wait 30 seconds between attempts
2. Save progress to disk before attempting expensive operations
3. Break large tasks into smaller checkpoints
4. Document partial progress in session notes
5. If 3+ consecutive errors occur, suggest user retry later

**Error indicators to watch for:**
- "502 Bad Gateway"
- "API gateway timeout"
- "Prompt is too long" (may be infrastructure, not your fault)

**Recovery pattern:**
\`\`\`
1. Acknowledge the error
2. Save current progress
3. Wait 30s
4. Retry with smaller context
5. If still failing, escalate to user
\`\`\`
`,
    });
  }

  // 2. Architecture Verification Protocol (if wrongApproachRate > 10%)
  if (metrics.wrongApproachRate > 10) {
    suggestions.push({
      title: 'Architecture Verification Protocol',
      section: '## Before Complex Changes',
      priority: 'high',
      basedOnPatterns: ['Wrong Approach Pattern'],
      content: `## Architecture Verification Protocol

BEFORE implementing complex state logic or multi-file changes:

1. **Search for existing patterns** - Find similar features in the codebase
2. **Explain your approach** in 2-3 sentences before coding
3. **Ask for confirmation**: "Does this align with the existing architecture?"
4. **Wait for approval** before proceeding with implementation

**High-risk areas requiring verification:**
- Zustand store state tracking logic
- isDirty/baseline comparison systems
- Plugin setup workflows
- Multi-file refactoring

**Template question:**
> "I plan to [action] by [approach]. This will affect [files/components]. Does this match your expectations?"
`,
    });
  }

  // 3. Context Length Management (if contextOverflowRate > 10%)
  if (metrics.contextOverflowRate > 10) {
    suggestions.push({
      title: 'Context Length Management',
      section: '## Large Codebase Guidelines',
      priority: 'high',
      basedOnPatterns: ['Context Overflow'],
      content: `## Context Length Management

For large codebase analysis:

1. **Count before reading** - Use file globbing to check file count first
2. **Batch reads** - Maximum 5 files per read operation
3. **Summarize incrementally** - Don't hold entire codebase in context
4. **Prefer search over read** - Use grep/find instead of full file reads
5. **Delegate to subagents** - Split large tasks across focused agents

**Projects prone to context overflow:**
- Python monoliths (>5k LOC files)
- Multi-feature analysis (3+ unrelated areas)
- Full codebase refactoring

**Safe pattern:**
\`\`\`
1. Search for relevant files (pattern match)
2. Read file summaries/headers first
3. Deep-read only necessary sections
4. Summarize findings before proceeding
\`\`\`
`,
    });
  }

  // 4. Feature-specific documentation (based on detected patterns)
  const featurePatterns = patterns.filter(p =>
    p.pattern.toLowerCase().includes('workflow') ||
    p.description.toLowerCase().includes('workflow')
  );

  if (featurePatterns.length > 0) {
    suggestions.push({
      title: 'Feature Documentation Requirements',
      section: '## Before Working on Complex Features',
      priority: 'medium',
      basedOnPatterns: featurePatterns.map(p => p.pattern),
      content: `## Feature Documentation Requirements

Before attempting changes to complex features, READ the relevant documentation:

**Required reading before feature work:**
1. Check \`docs/features/[feature]/README.md\` for architecture overview
2. Review \`docs/features/[feature]/implementation-guide.md\` for patterns
3. Search for existing tests and examples

**Workflow feature specifics:**
- Read \`docs/features/workflow/README.md\` first
- Understand isDirty state tracking system
- Check save button activation logic patterns
`,
    });
  }

  // 5. General success rate improvement
  if (metrics.successRate < 40) {
    suggestions.push({
      title: 'Task Complexity Guidelines',
      section: '## Task Management',
      priority: 'medium',
      basedOnPatterns: ['Low Success Rate'],
      content: `## Task Complexity Guidelines

Current success rate is low. Consider:

1. **Break large tasks** into smaller, verifiable steps
2. **Confirm understanding** before starting implementation
3. **Test incrementally** - verify each step before proceeding
4. **Use checkpoints** - commit/save progress frequently

**Task sizing guide:**
- Simple: 1-2 files, single function change
- Medium: 3-5 files, related changes
- Complex: 6+ files, architectural impact → break into subtasks
`,
    });
  }

  return suggestions.slice(0, maxSuggestions);
}

/**
 * Format suggestions as markdown for CLAUDE.md
 */
export function formatSuggestionsAsMarkdown(suggestions: IClaudeMdSuggestion[]): string {
  const header = `# Auto-Generated CLAUDE.md Recommendations

> Generated by Claude Insights Toolkit
> Based on analysis of your Claude Code session patterns

`;

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...suggestions].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const sections = sorted.map(s => {
    const priorityBadge = s.priority === 'critical' ? '🔴 CRITICAL' :
                          s.priority === 'high' ? '🟠 HIGH' :
                          s.priority === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';

    return `<!-- Priority: ${priorityBadge} -->
<!-- Based on: ${s.basedOnPatterns.join(', ')} -->

${s.content}

---
`;
  });

  return header + sections.join('\n');
}

/**
 * Generate a quick summary of suggestions
 */
export function generateSuggestionSummary(suggestions: IClaudeMdSuggestion[]): string {
  const critical = suggestions.filter(s => s.priority === 'critical').length;
  const high = suggestions.filter(s => s.priority === 'high').length;

  let summary = `📝 Generated ${suggestions.length} CLAUDE.md suggestions:\n`;
  if (critical > 0) summary += `  🔴 ${critical} critical\n`;
  if (high > 0) summary += `  🟠 ${high} high priority\n`;
  summary += `\nTop recommendations:\n`;

  suggestions.slice(0, 3).forEach((s, i) => {
    summary += `  ${i + 1}. ${s.title}\n`;
  });

  return summary;
}
