/**
 * Advanced CLAUDE.md Advisory Generator
 * Creates specific, actionable recommendations based on captured session data
 *
 * Features:
 * - Context-aware recommendations based on workflow patterns
 * - Project type detection from goal categories
 * - Time-of-day productivity patterns
 * - Tool usage effectiveness analysis
 * - Smart prioritization by impact and recency
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import type { IBottleneckResult, IBottleneckPattern } from '../analyzers/bottleneck';
import type { IProductivityResult, ICategoryStats, ISessionTypeStats } from '../analyzers/productivity';
import type { ITimePatternResult, ITimeSlotStats } from '../analyzers/time-patterns';
import type { IApiErrorResult, IApiErrorRecommendation } from '../analyzers/api-errors';
import type { ICategorySuccessResult, ICategoryStat } from '../analyzers/category-success';
import { deduplicateSessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

export interface IAdvancedAdvisory {
  /** Unique identifier for this advisory */
  id: string;
  /** Advisory title */
  title: string;
  /** Section in CLAUDE.md where this belongs */
  section: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Impact score (0-100) */
  impactScore: number;
  /** Markdown content */
  content: string;
  /** Patterns this advisory is based on */
  basedOnPatterns: string[];
  /** Example sessions from user's data */
  examples: IAdvisoryExample[];
  /** Actionable checklist items */
  checklist: string[];
  /** When this advisory was generated */
  generatedAt: string;
  /** Data sources used */
  dataSources: string[];
}

export interface IAdvisoryExample {
  /** Session ID */
  sessionId: string;
  /** Brief description */
  description: string;
  /** Outcome */
  outcome: string;
  /** What worked or didn't */
  lesson: string;
}

export interface IProjectProfile {
  /** Detected project type */
  projectType: string;
  /** Confidence level (0-100) */
  confidence: number;
  /** Primary goal categories */
  primaryCategories: string[];
  /** Secondary categories */
  secondaryCategories: string[];
  /** Technology indicators found */
  techIndicators: string[];
}

export interface IWorkflowPattern {
  /** Pattern name */
  name: string;
  /** Pattern type */
  type: 'strength' | 'weakness' | 'opportunity';
  /** Frequency (0-100) */
  frequency: number;
  /** Success rate with this pattern */
  successRate: number;
  /** Description */
  description: string;
  /** Affected sessions */
  sessionCount: number;
}

export interface IAdvancedGeneratorOptions {
  /** Include specific examples from user's sessions */
  includeExamples?: boolean;
  /** Maximum number of advisories to generate */
  maxAdvisories?: number;
  /** Minimum impact score threshold */
  minImpactScore?: number;
  /** Weight for recency (0-1) */
  recencyWeight?: number;
  /** Days to consider as "recent" */
  recentDays?: number;
  /** Include time-based recommendations */
  includeTimePatterns?: boolean;
  /** Include tool usage guidelines */
  includeToolGuidelines?: boolean;
}

export interface IAdvancedAdvisoryResult {
  /** Generation timestamp */
  generatedAt: string;
  /** Detected project profile */
  projectProfile: IProjectProfile;
  /** Identified workflow patterns */
  workflowPatterns: IWorkflowPattern[];
  /** Generated advisories */
  advisories: IAdvancedAdvisory[];
  /** Summary statistics */
  stats: {
    totalAdvisories: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    averageImpactScore: number;
  };
  /** Executive summary */
  summary: string;
}

// ── Constants ──────────────────────────────────────────────────────

const PROJECT_TYPE_INDICATORS: Record<string, string[]> = {
  'frontend': ['react', 'vue', 'angular', 'svelte', 'css', 'ui', 'component', 'frontend', 'dom'],
  'backend': ['api', 'server', 'database', 'sql', 'nosql', 'rest', 'graphql', 'backend', 'endpoint'],
  'fullstack': ['fullstack', 'web_app', 'application', 'crud', 'dashboard'],
  'mobile': ['mobile', 'ios', 'android', 'react_native', 'flutter', 'app'],
  'devops': ['deployment', 'ci_cd', 'docker', 'kubernetes', 'infrastructure', 'aws', 'gcp', 'azure'],
  'data': ['data_analysis', 'ml', 'machine_learning', 'analytics', 'pandas', 'numpy', 'jupyter'],
  'testing': ['testing', 'test', 'jest', 'cypress', 'playwright', 'unit_test', 'e2e'],
  'refactoring': ['refactoring', 'cleanup', 'modernize', 'migrate', 'upgrade'],
};

const TOOL_EFFECTIVENESS_PATTERNS: Record<string, { success: string[]; failure: string[] }> = {
  'search': {
    success: ['fast_accurate_search', 'codebase_exploration'],
    failure: ['context_overflow', 'wrong_approach'],
  },
  'multi_file': {
    success: ['multi_file_changes', 'correct_code_edits'],
    failure: ['wrong_approach', 'context_overflow'],
  },
  'debugging': {
    success: ['testing_and_debugging', 'bug_fix'],
    failure: ['buggy_code'],
  },
};

const RECOVERY_PATTERNS = [
  {
    name: 'Checkpoint Save',
    indicator: /save.*progress|checkpoint|backup/i,
    action: 'Save progress to disk before attempting expensive operations',
  },
  {
    name: 'Context Reset',
    indicator: /clear.*context|reset|start.*fresh/i,
    action: 'Use /clear between unrelated tasks to prevent context pollution',
  },
  {
    name: 'Subagent Delegation',
    indicator: /subagent|delegate|spawn.*agent/i,
    action: 'Delegate complex subtasks to specialized subagents',
  },
  {
    name: 'Incremental Approach',
    indicator: /step.*by.*step|incremental|small.*chunk/i,
    action: 'Break large tasks into smaller, verifiable steps',
  },
];

// ── Helper Functions ───────────────────────────────────────────────

/**
 * Detect project type based on goal categories
 */
function detectProjectType(categories: ICategoryStats[]): IProjectProfile {
  const categoryNames = categories.map(c => c.category.toLowerCase());
  const scores: Record<string, number> = {};

  for (const [type, indicators] of Object.entries(PROJECT_TYPE_INDICATORS)) {
    scores[type] = 0;
    for (const indicator of indicators) {
      const matches = categoryNames.filter(c => c.includes(indicator)).length;
      scores[type] += matches;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0];
  const secondary = sorted[1];

  // Extract tech indicators
  const techIndicators: string[] = [];
  const techPatterns = ['react', 'vue', 'angular', 'node', 'python', 'go', 'rust', 'typescript', 'sql', 'docker'];
  for (const pattern of techPatterns) {
    if (categoryNames.some(c => c.includes(pattern))) {
      techIndicators.push(pattern);
    }
  }

  return {
    projectType: primary[0],
    confidence: Math.min(primary[1] * 20, 100),
    primaryCategories: categories.slice(0, 3).map(c => c.category),
    secondaryCategories: categories.slice(3, 6).map(c => c.category),
    techIndicators,
  };
}

/**
 * Analyze workflow patterns from session data
 */
function analyzeWorkflowPatterns(
  sessions: ISessionFacet[],
  productivity: IProductivityResult,
  timePatterns?: ITimePatternResult
): IWorkflowPattern[] {
  const patterns: IWorkflowPattern[] = [];

  // Session type effectiveness
  productivity.sessionTypeStats.forEach(stat => {
    patterns.push({
      name: `${stat.type.replace(/_/g, ' ')} sessions`,
      type: stat.successRate > 70 ? 'strength' : stat.successRate < 40 ? 'weakness' : 'opportunity',
      frequency: stat.percentage,
      successRate: stat.successRate,
      description: `${stat.count} sessions with ${stat.successRate}% success rate`,
      sessionCount: stat.count,
    });
  });

  // Time-based patterns
  if (timePatterns?.optimalHours.length) {
    const bestHour = timePatterns.hourlyStats.find(h => h.slot === timePatterns.optimalHours[0]);
    if (bestHour) {
      patterns.push({
        name: 'Peak productivity time',
        type: 'strength',
        frequency: bestHour.percentage,
        successRate: bestHour.successRate,
        description: `Optimal performance at ${bestHour.slot} (${bestHour.successRate}% success)`,
        sessionCount: bestHour.sessionCount,
      });
    }
  }

  // Helpfulness correlation
  productivity.helpfulnessCorrelation.forEach(hc => {
    if (hc.total >= 3) {
      patterns.push({
        name: `${hc.helpfulness.replace(/_/g, ' ')} sessions`,
        type: hc.successRate > 70 ? 'strength' : 'opportunity',
        frequency: Math.round((hc.total / productivity.metrics.totalSessions) * 100),
        successRate: hc.successRate,
        description: `${hc.total} sessions rated as ${hc.helpfulness}`,
        sessionCount: hc.total,
      });
    }
  });

  return patterns.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Calculate impact score for a recommendation
 */
function calculateImpactScore(
  pattern: IBottleneckPattern | IWorkflowPattern,
  recency: number,
  frequency: number,
  options: IAdvancedGeneratorOptions
): number {
  const recencyWeight = options.recencyWeight ?? 0.3;
  const frequencyWeight = 1 - recencyWeight;

  const severityScore =
    'severity' in pattern
      ? pattern.severity === 'critical'
        ? 100
        : pattern.severity === 'high'
          ? 75
          : pattern.severity === 'medium'
            ? 50
            : 25
      : 'successRate' in pattern
        ? 100 - pattern.successRate
        : 50;

  const affectedScore =
    'affectedPercentage' in pattern
      ? pattern.affectedPercentage
      : 'frequency' in pattern
        ? pattern.frequency
        : 50;

  return Math.round(
    severityScore * 0.4 + affectedScore * 0.3 * frequencyWeight + recency * 0.3 * recencyWeight
  );
}

/**
 * Extract examples from successful sessions
 */
function extractSuccessExamples(
  sessions: ISessionFacet[],
  category: string,
  limit: number = 2
): IAdvisoryExample[] {
  const successful = sessions
    .filter(
      s =>
        (s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved') &&
        Object.keys(s.goal_categories).some(c => c.toLowerCase().includes(category.toLowerCase()))
    )
    .slice(0, limit);

  return successful.map(s => ({
    sessionId: s.session_id,
    description: s.underlying_goal.slice(0, 80),
    outcome: s.outcome,
    lesson: s.primary_success === 'correct_code_edits'
      ? 'Precise code edits led to success'
      : s.primary_success === 'multi_file_changes'
        ? 'Well-coordinated multi-file approach'
        : s.primary_success === 'fast_accurate_search'
          ? 'Efficient search and navigation'
          : 'Consistent execution pattern',
  }));
}

/**
 * Extract examples from failed sessions for learning
 */
function extractFailureExamples(
  sessions: ISessionFacet[],
  pattern: string,
  limit: number = 2
): IAdvisoryExample[] {
  const failed = sessions
    .filter(
      s =>
        (s.outcome === 'not_achieved' || s.outcome === 'partially_achieved') &&
        (s.friction_detail?.toLowerCase().includes(pattern.toLowerCase()) ||
          Object.keys(s.friction_counts).some(f => f.toLowerCase().includes(pattern.toLowerCase())))
    )
    .slice(0, limit);

  return failed.map(s => ({
    sessionId: s.session_id,
    description: s.underlying_goal.slice(0, 80),
    outcome: s.outcome,
    lesson: s.friction_detail?.slice(0, 100) || 'Pattern detected in friction data',
  }));
}

/**
 * Generate recovery patterns based on API error analysis
 */
function generateRecoveryPatterns(apiErrors: IApiErrorResult): string[] {
  const patterns: string[] = [];

  if (apiErrors.metrics.errorSessionRate > 20) {
    patterns.push('Implement exponential backoff: wait 30s, 60s, 120s between retries');
    patterns.push('Save checkpoints every 5 minutes during long operations');
  }

  if (apiErrors.metrics.maxErrorsInSingleSession > 10) {
    patterns.push('Break large tasks into smaller chunks (< 30 min each)');
    patterns.push('Document partial progress before attempting risky operations');
  }

  const hasInfrastructureErrors = apiErrors.errorTypes.some(et =>
    et.type.toLowerCase().includes('infrastructure')
  );
  if (hasInfrastructureErrors) {
    patterns.push('Check Anthropic status page when seeing 502/503 errors');
    patterns.push('Consider scheduling critical work during off-peak hours');
  }

  return patterns;
}

// ── Advisory Generators ────────────────────────────────────────────

/**
 * Generate project-specific constraints advisory
 */
function generateProjectConstraintsAdvisory(
  profile: IProjectProfile,
  categorySuccess: ICategorySuccessResult,
  sessions: ISessionFacet[]
): IAdvancedAdvisory {
  const topCategory = categorySuccess.topPerforming[0];
  const weakCategory = categorySuccess.underperforming[0];

  const content = `## Project-Specific Constraints

Based on analysis of your ${profile.projectType} project patterns:

### Technology Stack
${profile.techIndicators.map(t => `- ${t}`).join('\n') || '- General purpose development'}

### Your Strengths
${topCategory
      ? `- **${topCategory.category.replace(/_/g, ' ')}**: ${topCategory.successRate}% success rate\n  - Leverage this for complex tasks\n  - Document patterns that work for you`
      : '- Continue building consistent patterns'}

### Areas Requiring Attention
${weakCategory
      ? `- **${weakCategory.category.replace(/_/g, ' ')}**: ${weakCategory.successRate}% success rate\n  - Review failed sessions for common pitfalls\n  - Consider breaking these tasks into smaller steps`
      : '- Monitor for emerging patterns'}

### Project-Type Guidelines
${profile.projectType === 'frontend'
      ? `- Always check component hierarchy before changes\n- Verify CSS/styling impact across breakpoints\n- Test interactive elements thoroughly`
      : profile.projectType === 'backend'
        ? `- Validate API contracts before implementation\n- Check database migration safety\n- Review error handling coverage`
        : profile.projectType === 'data'
          ? `- Validate data pipelines incrementally\n- Check memory usage with large datasets\n- Document transformation logic`
          : `- Follow general best practices\n- Adapt patterns to specific domain needs`}
`;

  const examples = topCategory
    ? extractSuccessExamples(sessions, topCategory.category, 2)
    : [];

  return {
    id: 'project-constraints',
    title: 'Project-Specific Constraints',
    section: '## Project Context',
    priority: 'high',
    impactScore: 75,
    content,
    basedOnPatterns: ['category_analysis', 'project_type_detection'],
    examples,
    checklist: [
      'Review your top-performing category patterns',
      'Document successful approaches for your project type',
      'Set up project-specific validation checks',
    ],
    generatedAt: new Date().toISOString(),
    dataSources: ['category_success', 'productivity'],
  };
}

/**
 * Generate personalized workflow recommendations
 */
function generateWorkflowAdvisory(
  patterns: IWorkflowPattern[],
  timePatterns?: ITimePatternResult,
  sessions: ISessionFacet[] = []
): IAdvancedAdvisory {
  const strengths = patterns.filter(p => p.type === 'strength').slice(0, 3);
  const weaknesses = patterns.filter(p => p.type === 'weakness').slice(0, 2);
  const opportunities = patterns.filter(p => p.type === 'opportunity').slice(0, 2);

  const optimalTime = timePatterns?.optimalHours[0];
  const avoidTime = timePatterns?.recommendations.find(r => r.type === 'avoid_time');

  const content = `## Personalized Workflow Recommendations

### Your Productivity Patterns

**Strengths to Leverage:**
${strengths.map(s => `- **${s.name}**: ${s.successRate}% success (${s.sessionCount} sessions)`).join('\n') || '- Building baseline patterns'}

**Optimization Opportunities:**
${opportunities.map(o => `- **${o.name}**: Currently ${o.successRate}% success - potential for improvement`).join('\n') || '- Continue current practices'}

${weaknesses.length
      ? `**Patterns to Avoid:**\n${weaknesses.map(w => `- **${w.name}**: ${w.successRate}% success - consider alternative approaches`).join('\n')}`
      : ''}

### Time-Based Optimization
${optimalTime
      ? `- **Peak Performance**: Schedule complex tasks at ${optimalTime}\n  - Your success rate is highest during this time\n  - Reserve deep work for these hours`
      : '- Continue tracking to identify peak times'}
${avoidTime
      ? `- **Low Energy Period**: ${avoidTime.title}\n  - Success rate drops during this time\n  - Schedule lighter tasks or breaks`
      : ''}

### Session Type Guidelines
- **Single Task**: Best for focused, deep work
- **Multi Task**: Good for related changes across files
- **Exploration**: Use for discovery and learning
- **Iterative Refinement**: Break complex tasks into iterations
`;

  return {
    id: 'workflow-recommendations',
    title: 'Personalized Workflow Recommendations',
    section: '## Workflow Guidelines',
    priority: 'high',
    impactScore: 80,
    content,
    basedOnPatterns: patterns.map(p => p.name),
    examples: strengths.length
      ? extractSuccessExamples(sessions, strengths[0].name.split(' ')[0].toLowerCase(), 2)
      : [],
    checklist: [
      'Schedule complex tasks during your peak hours',
      'Use session types appropriate to the task',
      'Track which patterns lead to success',
    ],
    generatedAt: new Date().toISOString(),
    dataSources: ['productivity', 'time_patterns'],
  };
}

/**
 * Generate tool selection guidelines
 */
function generateToolGuidelinesAdvisory(
  productivity: IProductivityResult,
  categorySuccess: ICategorySuccessResult,
  sessions: ISessionFacet[]
): IAdvancedAdvisory {
  const searchSuccess = categorySuccess.categories.find(c => c.category.includes('exploration'));
  const multiFileSuccess = categorySuccess.categories.find(c => c.category.includes('code_change'));
  const debugSuccess = categorySuccess.categories.find(c => c.category.includes('debug'));

  const content = `## Tool Selection Guidelines

Based on your success patterns, here are guidelines for choosing the right approach:

### When to Use Search
${searchSuccess
      ? `- **Your Success Rate**: ${searchSuccess.successRate}% for exploration tasks\n- Use for: Finding patterns, understanding codebase, locating specific code\n- Avoid: When you need to modify multiple files`
      : '- Effective for codebase navigation\n- Use grep/find for pattern matching\n- Read file summaries before deep reads'}

### When to Use Multi-File Changes
${multiFileSuccess
      ? `- **Your Success Rate**: ${multiFileSuccess.successRate}% for code changes\n- Use for: Refactoring, feature implementation, cross-cutting concerns\n- Requirements: Clear understanding of dependencies`
      : '- Coordinate changes across related files\n- Verify all affected files are updated\n- Test incrementally'}

### When to Use Debugging Tools
${debugSuccess
      ? `- **Your Success Rate**: ${debugSuccess.successRate}% for debugging\n- Use for: Root cause analysis, fixing bugs, investigating issues\n- Combine with: Search for finding related code`
      : '- Isolate issues before fixing\n- Verify fixes don\'t introduce regressions\n- Document debugging process'}

### Primary Success Patterns
Your most successful sessions use:
${productivity.primarySuccessDistribution
      .slice(0, 3)
      .map(ps => `- **${ps.name.replace(/_/g, ' ')}**: ${ps.value} sessions`)
      .join('\n')}

### Friction Patterns to Avoid
${productivity.frictionPatterns
      .slice(0, 3)
      .map(fp => `- ${fp.pattern.slice(0, 60)}${fp.pattern.length > 60 ? '...' : ''}`)
      .join('\n') || '- No significant friction patterns detected'}
`;

  return {
    id: 'tool-guidelines',
    title: 'Tool Selection Guidelines',
    section: '## Tool Usage',
    priority: 'medium',
    impactScore: 70,
    content,
    basedOnPatterns: productivity.primarySuccessDistribution.slice(0, 3).map(p => p.name),
    examples: [],
    checklist: [
      'Match tool to task complexity',
      'Use search before multi-file changes',
      'Verify understanding before debugging',
    ],
    generatedAt: new Date().toISOString(),
    dataSources: ['productivity', 'category_success'],
  };
}

/**
 * Generate context management strategies
 */
function generateContextManagementAdvisory(
  bottleneck: IBottleneckResult,
  sessions: ISessionFacet[]
): IAdvancedAdvisory {
  const hasContextOverflow = bottleneck.patterns.some(p => p.pattern === 'Context Overflow');
  const overflowPattern = bottleneck.patterns.find(p => p.pattern === 'Context Overflow');

  const content = `## Context Management Strategies

### Your Context Usage Patterns
${hasContextOverflow
      ? `- **Context Overflow Rate**: ${overflowPattern?.affectedPercentage}% of sessions\n- This indicates large codebase or complex tasks\n- Implement the strategies below to improve`
      : '- Context usage is within normal parameters\n- Continue current practices\n- Monitor for changes'}

### Effective Strategies

**1. Incremental Reading**
\`\`\`
1. Search for relevant files first
2. Read file summaries/headers
3. Deep-read only necessary sections
4. Summarize findings before proceeding
\`\`\`

**2. Batch Operations**
- Maximum 5 files per read operation
- Use glob patterns to check file count first
- Prefer search over full file reads

**3. Context Reset Points**
- Use /clear between unrelated tasks
- Save progress before context-heavy operations
- Break large tasks into 30-minute chunks

**4. Subagent Delegation**
- Delegate complex subtasks to focused agents
- Each subagent gets clean context
- Improves both accuracy and speed

### Warning Signs
Watch for these indicators that context is becoming a problem:
- "Prompt is too long" errors
- Slow response times
- Loss of track in conversation
- Repeated questions about previously discussed code
`;

  const examples = hasContextOverflow
    ? extractFailureExamples(sessions, 'context', 2)
    : [];

  return {
    id: 'context-management',
    title: 'Context Management Strategies',
    section: '## Context Guidelines',
    priority: hasContextOverflow ? 'high' : 'medium',
    impactScore: hasContextOverflow ? 85 : 60,
    content,
    basedOnPatterns: hasContextOverflow ? ['Context Overflow'] : ['preventive_guidance'],
    examples,
    checklist: [
      'Count files before reading',
      'Use search instead of full reads when possible',
      'Reset context between unrelated tasks',
      'Delegate to subagents for complex subtasks',
    ],
    generatedAt: new Date().toISOString(),
    dataSources: ['bottleneck_analysis'],
  };
}

/**
 * Generate API error recovery advisory
 */
function generateApiErrorRecoveryAdvisory(
  apiErrors: IApiErrorResult,
  sessions: ISessionFacet[]
): IAdvancedAdvisory {
  const recoveryPatterns = generateRecoveryPatterns(apiErrors);
  const worstSession = apiErrors.worstSessions[0];

  const content = `## API Error Recovery Patterns

### Your API Error Profile
- **Error Rate**: ${apiErrors.metrics.errorSessionRate}% of sessions affected
- **Total Errors**: ${apiErrors.metrics.totalErrorCount} across all sessions
- **Peak Errors**: ${apiErrors.metrics.maxErrorsInSingleSession} in a single session

### Recovery Patterns

${recoveryPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}

### Error-Specific Responses

**502 Bad Gateway / Infrastructure Errors**
\`\`\`
1. Acknowledge the error to user
2. Save current progress immediately
3. Wait 30 seconds
4. Retry with smaller context window
5. If still failing, suggest user retry later
\`\`\`

**Context Length Exceeded**
\`\`\`
1. Identify the largest context contributors
2. Use /compact to summarize
3. Remove unnecessary file contents
4. Break task into smaller chunks
\`\`\`

**Rate Limiting**
\`\`\`
1. Implement exponential backoff
2. Queue non-urgent operations
3. Consider batching requests
\`\`\`

### Prevention Strategies
- Save checkpoints every 5 minutes
- Document partial progress frequently
- Break large tasks into smaller subtasks
- Monitor error trends over time

${worstSession
      ? `### Worst Affected Session
- **Session**: ${worstSession.sessionId.slice(0, 8)}...\n- **Errors**: ${worstSession.totalErrors} occurrences\n- **Goal**: ${worstSession.goal.slice(0, 60)}...`
      : ''}
`;

  const examples = apiErrors.worstSessions.slice(0, 2).map(s => ({
    sessionId: s.sessionId,
    description: s.goal.slice(0, 80),
    outcome: s.outcome,
    lesson: `${s.totalErrors} API errors - consider smaller task scope`,
  }));

  return {
    id: 'api-error-recovery',
    title: 'API Error Recovery Patterns',
    section: '## Error Handling',
    priority: apiErrors.metrics.errorSessionRate > 30 ? 'critical' : apiErrors.metrics.errorSessionRate > 10 ? 'high' : 'medium',
    impactScore: Math.min(apiErrors.metrics.errorSessionRate * 2, 100),
    content,
    basedOnPatterns: apiErrors.errorTypes.slice(0, 3).map(et => et.type),
    examples,
    checklist: [
      'Save progress before risky operations',
      'Implement retry with exponential backoff',
      'Break large tasks into checkpoints',
      'Monitor error trends',
    ],
    generatedAt: new Date().toISOString(),
    dataSources: ['api_error_analysis'],
  };
}

// ── Main Generator ─────────────────────────────────────────────────

/**
 * Generate advanced CLAUDE.md advisories based on comprehensive analysis
 */
export function generateAdvancedAdvisories(
  data: IInsightsDay[],
  bottleneck: IBottleneckResult,
  productivity: IProductivityResult,
  apiErrors: IApiErrorResult,
  categorySuccess: ICategorySuccessResult,
  timePatterns?: ITimePatternResult,
  options: IAdvancedGeneratorOptions = {}
): IAdvancedAdvisoryResult {
  const sessions = deduplicateSessions(data);

  // Detect project profile
  const projectProfile = detectProjectType(productivity.categoryStats);

  // Analyze workflow patterns
  const workflowPatterns = analyzeWorkflowPatterns(sessions, productivity, timePatterns);

  // Generate advisories
  const advisories: IAdvancedAdvisory[] = [];

  // 1. Project-specific constraints
  advisories.push(generateProjectConstraintsAdvisory(projectProfile, categorySuccess, sessions));

  // 2. Personalized workflow recommendations
  advisories.push(generateWorkflowAdvisory(workflowPatterns, timePatterns, sessions));

  // 3. Tool selection guidelines
  advisories.push(generateToolGuidelinesAdvisory(productivity, categorySuccess, sessions));

  // 4. Context management
  advisories.push(generateContextManagementAdvisory(bottleneck, sessions));

  // 5. API error recovery (if applicable)
  if (apiErrors.metrics.errorSessionRate > 5) {
    advisories.push(generateApiErrorRecoveryAdvisory(apiErrors, sessions));
  }

  // Sort by impact score and priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  advisories.sort((a, b) => {
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.impactScore - a.impactScore;
  });

  // Apply limits
  const maxAdvisories = options.maxAdvisories ?? 10;
  const minImpactScore = options.minImpactScore ?? 0;
  const filteredAdvisories = advisories
    .filter(a => a.impactScore >= minImpactScore)
    .slice(0, maxAdvisories);

  // Calculate stats
  const stats = {
    totalAdvisories: filteredAdvisories.length,
    criticalCount: filteredAdvisories.filter(a => a.priority === 'critical').length,
    highCount: filteredAdvisories.filter(a => a.priority === 'high').length,
    mediumCount: filteredAdvisories.filter(a => a.priority === 'medium').length,
    lowCount: filteredAdvisories.filter(a => a.priority === 'low').length,
    averageImpactScore: Math.round(
      filteredAdvisories.reduce((sum, a) => sum + a.impactScore, 0) /
        Math.max(filteredAdvisories.length, 1)
    ),
  };

  // Build summary
  const summaryParts: string[] = [];
  summaryParts.push(`Generated ${stats.totalAdvisories} advisories`);
  if (stats.criticalCount) summaryParts.push(`${stats.criticalCount} critical`);
  if (stats.highCount) summaryParts.push(`${stats.highCount} high priority`);
  summaryParts.push(`Project type: ${projectProfile.projectType} (${projectProfile.confidence}% confidence)`);
  summaryParts.push(`Average impact score: ${stats.averageImpactScore}/100`);

  return {
    generatedAt: new Date().toISOString(),
    projectProfile,
    workflowPatterns,
    advisories: filteredAdvisories,
    stats,
    summary: summaryParts.join('; '),
  };
}

// ── Output Formatters ──────────────────────────────────────────────

/**
 * Format advisories as structured markdown for CLAUDE.md
 */
export function formatAdvisoriesAsMarkdown(result: IAdvancedAdvisoryResult): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Advanced CLAUDE.md Recommendations`);
  lines.push('');
  lines.push(`> Generated: ${new Date(result.generatedAt).toLocaleString()}`);
  lines.push(`> Project Type: ${result.projectProfile.projectType} (${result.projectProfile.confidence}% confidence)`);
  lines.push(`> Total Advisories: ${result.stats.totalAdvisories} (${result.stats.criticalCount} critical, ${result.stats.highCount} high, ${result.stats.mediumCount} medium, ${result.stats.lowCount} low)`);
  lines.push('');

  // Executive summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  // Workflow patterns summary
  lines.push('### Your Workflow Patterns');
  lines.push('');
  result.workflowPatterns.slice(0, 5).forEach(pattern => {
    const emoji = pattern.type === 'strength' ? '✅' : pattern.type === 'weakness' ? '⚠️' : '💡';
    lines.push(`${emoji} **${pattern.name}**: ${pattern.successRate}% success (${pattern.sessionCount} sessions)`);
  });
  lines.push('');

  // Advisories
  result.advisories.forEach(advisory => {
    const priorityEmoji =
      advisory.priority === 'critical' ? '🔴 CRITICAL'
        : advisory.priority === 'high' ? '🟠 HIGH'
          : advisory.priority === 'medium' ? '🟡 MEDIUM'
            : '🟢 LOW';

    lines.push(`---`);
    lines.push('');
    lines.push(`<!-- ID: ${advisory.id} -->`);
    lines.push(`<!-- Priority: ${priorityEmoji} | Impact: ${advisory.impactScore}/100 -->`);
    lines.push(`<!-- Based on: ${advisory.basedOnPatterns.join(', ')} -->`);
    lines.push('');
    lines.push(advisory.content);
    lines.push('');

    // Checklist
    if (advisory.checklist.length > 0) {
      lines.push('### Checklist');
      lines.push('');
      advisory.checklist.forEach(item => {
        lines.push(`- [ ] ${item}`);
      });
      lines.push('');
    }

    // Examples
    if (advisory.examples.length > 0) {
      lines.push('### Examples from Your Sessions');
      lines.push('');
      advisory.examples.forEach(ex => {
        lines.push(`**${ex.outcome === 'fully_achieved' || ex.outcome === 'mostly_achieved' ? '✅ Success' : '❌ Learning'}**: ${ex.description}`);
        lines.push(`- *Lesson*: ${ex.lesson}`);
        lines.push('');
      });
    }
  });

  return lines.join('\n');
}

/**
 * Generate a compact summary of advisories
 */
export function generateAdvisorySummary(result: IAdvancedAdvisoryResult): string {
  const lines: string[] = [];

  lines.push(`📝 Advanced Advisory Summary`);
  lines.push(`   Project: ${result.projectProfile.projectType} (${result.projectProfile.confidence}% confidence)`);
  lines.push(`   Generated: ${new Date(result.generatedAt).toLocaleDateString()}`);
  lines.push('');
  lines.push(`   ${result.stats.totalAdvisories} advisories:`);
  if (result.stats.criticalCount) lines.push(`   - 🔴 ${result.stats.criticalCount} critical`);
  if (result.stats.highCount) lines.push(`   - 🟠 ${result.stats.highCount} high priority`);
  if (result.stats.mediumCount) lines.push(`   - 🟡 ${result.stats.mediumCount} medium priority`);
  if (result.stats.lowCount) lines.push(`   - 🟢 ${result.stats.lowCount} low priority`);
  lines.push('');
  lines.push('   Top Recommendations:');
  result.advisories.slice(0, 3).forEach((a, i) => {
    lines.push(`   ${i + 1}. ${a.title} (Impact: ${a.impactScore}/100)`);
  });

  return lines.join('\n');
}

/**
 * Export advisories as JSON for programmatic use
 */
export function exportAdvisoriesAsJson(result: IAdvancedAdvisoryResult): string {
  return JSON.stringify(
    {
      generatedAt: result.generatedAt,
      projectProfile: result.projectProfile,
      stats: result.stats,
      advisories: result.advisories.map(a => ({
        id: a.id,
        title: a.title,
        section: a.section,
        priority: a.priority,
        impactScore: a.impactScore,
        checklist: a.checklist,
      })),
    },
    null,
    2
  );
}

// ── Backward Compatibility ─────────────────────────────────────────

/**
 * Convert advanced advisories to basic suggestion format
 * for backward compatibility with existing code
 */
export function convertToBasicSuggestions(
  advisories: IAdvancedAdvisory[]
): Array<{
  title: string;
  section: string;
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  basedOnPatterns: string[];
}> {
  return advisories.map(a => ({
    title: a.title,
    section: a.section,
    content: a.content,
    priority: a.priority,
    basedOnPatterns: a.basedOnPatterns,
  }));
}
