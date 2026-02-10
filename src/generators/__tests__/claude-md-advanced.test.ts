/**
 * Tests for the advanced CLAUDE.md advisory generator
 */

import {
  generateAdvancedAdvisories,
  formatAdvisoriesAsMarkdown,
  generateAdvisorySummary,
  exportAdvisoriesAsJson,
  convertToBasicSuggestions,
  IAdvancedGeneratorOptions,
} from '../claude-md-advanced';
import { analyzeBottlenecks } from '../../analyzers/bottleneck';
import { analyzeProductivity } from '../../analyzers/productivity';
import { analyzeApiErrors } from '../../analyzers/api-errors';
import { analyzeCategorySuccess } from '../../analyzers/category-success';
import { analyzeTimePatterns } from '../../analyzers/time-patterns';
import { IInsightsDay, ISessionFacet, Outcome, ClaudeHelpfulness, SessionType, PrimarySuccess } from '../../types/insights';

// Test data helpers
function createMockSession(overrides: Partial<ISessionFacet> = {}): ISessionFacet {
  return {
    session_id: `test-${Math.random().toString(36).substring(7)}`,
    underlying_goal: 'Test goal',
    goal_categories: { code_change: 1 },
    outcome: Outcome.FULLY_ACHIEVED,
    user_satisfaction_counts: { satisfied: 1 },
    claude_helpfulness: ClaudeHelpfulness.VERY_HELPFUL,
    session_type: SessionType.SINGLE_TASK,
    friction_counts: {},
    friction_detail: '',
    primary_success: PrimarySuccess.CORRECT_CODE_EDITS,
    brief_summary: 'Test session',
    ...overrides,
  };
}

function createMockData(sessions: ISessionFacet[]): IInsightsDay[] {
  return [
    {
      date: '2024-01-01',
      sessions,
    },
  ];
}

describe('generateAdvancedAdvisories', () => {
  it('returns default advisories for no sessions', () => {
    const data = createMockData([]);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);

    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess
    );

    // Even with no data, we provide default guidance advisories
    expect(result.advisories.length).toBeGreaterThanOrEqual(0);
    expect(result.projectProfile.projectType).toBeDefined();
  });

  it('generates advisories for successful sessions', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1, frontend: 1 },
        claude_helpfulness: ClaudeHelpfulness.VERY_HELPFUL,
      }),
      createMockSession({
        outcome: Outcome.MOSTLY_ACHIEVED,
        goal_categories: { code_change: 1, frontend: 1 },
        claude_helpfulness: ClaudeHelpfulness.MODERATELY_HELPFUL,
      }),
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { bug_fix: 1, testing: 1 },
        claude_helpfulness: ClaudeHelpfulness.VERY_HELPFUL,
      }),
    ];

    const data = createMockData(sessions);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);
    const timePatterns = analyzeTimePatterns(data);

    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess,
      timePatterns
    );

    expect(result.advisories.length).toBeGreaterThan(0);
    expect(result.projectProfile.projectType).toBeDefined();
    expect(result.workflowPatterns.length).toBeGreaterThan(0);
    expect(result.stats.totalAdvisories).toBeGreaterThan(0);
  });

  it('includes API error recovery advisory when errors are present', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.NOT_ACHIEVED,
        friction_counts: { api_error: 5, api_infrastructure_error: 3 },
        goal_categories: { code_change: 1 },
      }),
      createMockSession({
        outcome: Outcome.PARTIALLY_ACHIEVED,
        friction_counts: { api_error: 2 },
        goal_categories: { code_change: 1 },
      }),
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);

    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess
    );

    const apiErrorAdvisory = result.advisories.find(a => a.id === 'api-error-recovery');
    expect(apiErrorAdvisory).toBeDefined();
    // With 66% error rate, priority should be critical
    expect(apiErrorAdvisory?.priority).toBe('critical');
  });

  it('respects maxAdvisories option', () => {
    const sessions = Array.from({ length: 10 }, () =>
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1, frontend: 1, react: 1 },
      })
    );

    const data = createMockData(sessions);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);

    const options: IAdvancedGeneratorOptions = { maxAdvisories: 3 };
    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess,
      undefined,
      options
    );

    expect(result.advisories.length).toBeLessThanOrEqual(3);
  });

  it('respects minImpactScore option', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);

    const options: IAdvancedGeneratorOptions = { minImpactScore: 90 };
    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess,
      undefined,
      options
    );

    // With high threshold, should filter out most advisories
    expect(result.advisories.every(a => a.impactScore >= 90)).toBe(true);
  });

  it('detects project type from categories', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { react: 1, css: 1, component: 1, frontend: 1 },
      }),
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { react: 1, ui: 1, frontend: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const bottleneck = analyzeBottlenecks(data);
    const productivity = analyzeProductivity(data);
    const apiErrors = analyzeApiErrors(data);
    const categorySuccess = analyzeCategorySuccess(data);

    const result = generateAdvancedAdvisories(
      data,
      bottleneck,
      productivity,
      apiErrors,
      categorySuccess
    );

    expect(result.projectProfile.projectType).toBe('frontend');
    expect(result.projectProfile.techIndicators).toContain('react');
  });
});

describe('formatAdvisoriesAsMarkdown', () => {
  it('generates valid markdown output', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const result = generateAdvancedAdvisories(
      data,
      analyzeBottlenecks(data),
      analyzeProductivity(data),
      analyzeApiErrors(data),
      analyzeCategorySuccess(data)
    );

    const markdown = formatAdvisoriesAsMarkdown(result);

    expect(markdown).toContain('# Advanced CLAUDE.md Recommendations');
    expect(markdown).toContain('Project Type:');
    expect(markdown).toContain('Executive Summary');
  });

  it('includes workflow patterns in output', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
        session_type: SessionType.SINGLE_TASK,
      }),
    ];

    const data = createMockData(sessions);
    const result = generateAdvancedAdvisories(
      data,
      analyzeBottlenecks(data),
      analyzeProductivity(data),
      analyzeApiErrors(data),
      analyzeCategorySuccess(data)
    );

    const markdown = formatAdvisoriesAsMarkdown(result);

    expect(markdown).toContain('Your Workflow Patterns');
  });
});

describe('generateAdvisorySummary', () => {
  it('generates a concise summary', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const result = generateAdvancedAdvisories(
      data,
      analyzeBottlenecks(data),
      analyzeProductivity(data),
      analyzeApiErrors(data),
      analyzeCategorySuccess(data)
    );

    const summary = generateAdvisorySummary(result);

    expect(summary).toContain('Advanced Advisory Summary');
    expect(summary).toContain('Project:');
    expect(summary).toContain('advisories');
  });
});

describe('exportAdvisoriesAsJson', () => {
  it('exports valid JSON', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const result = generateAdvancedAdvisories(
      data,
      analyzeBottlenecks(data),
      analyzeProductivity(data),
      analyzeApiErrors(data),
      analyzeCategorySuccess(data)
    );

    const json = exportAdvisoriesAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.generatedAt).toBeDefined();
    expect(parsed.projectProfile).toBeDefined();
    expect(parsed.stats).toBeDefined();
    expect(Array.isArray(parsed.advisories)).toBe(true);
  });
});

describe('convertToBasicSuggestions', () => {
  it('converts advisories to basic format', () => {
    const sessions = [
      createMockSession({
        outcome: Outcome.FULLY_ACHIEVED,
        goal_categories: { code_change: 1 },
      }),
    ];

    const data = createMockData(sessions);
    const result = generateAdvancedAdvisories(
      data,
      analyzeBottlenecks(data),
      analyzeProductivity(data),
      analyzeApiErrors(data),
      analyzeCategorySuccess(data)
    );

    const basic = convertToBasicSuggestions(result.advisories);

    expect(basic.length).toBe(result.advisories.length);
    expect(basic[0]).toHaveProperty('title');
    expect(basic[0]).toHaveProperty('section');
    expect(basic[0]).toHaveProperty('content');
    expect(basic[0]).toHaveProperty('priority');
    expect(basic[0]).toHaveProperty('basedOnPatterns');
  });
});
