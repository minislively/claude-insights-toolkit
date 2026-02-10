/**
 * Pattern Extractor - Analyzes successful workflow patterns from session facets
 *
 * Identifies common characteristics of successful sessions (fully_achieved/mostly_achieved)
 * and creates reusable pattern templates for achieving better outcomes.
 *
 * Key features:
 * 1. Extracts patterns from successful sessions
 * 2. Scores pattern effectiveness based on success correlation
 * 3. Provides pattern recommendations for new goals
 * 4. Integrates with bottleneck and trend analyzers
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

// ── Pattern Template Interfaces ─────────────────────────────────────

/**
 * A reusable pattern template extracted from successful sessions
 */
export interface IPatternTemplate {
  /** Unique identifier for the pattern */
  id: string;
  /** Human-readable pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Pattern type/category */
  type: PatternType;
  /** Goal categories this pattern applies to */
  applicableCategories: string[];
  /** Session types where this pattern is effective */
  effectiveSessionTypes: string[];
  /** Characteristics of successful sessions using this pattern */
  characteristics: IPatternCharacteristics;
  /** Friction patterns to avoid */
  avoidedFrictions: string[];
  /** Effectiveness score (0-100) */
  effectivenessScore: number;
  /** Success rate when following this pattern */
  successRate: number;
  /** Number of sessions this pattern is based on */
  sampleSize: number;
  /** Confidence level (0-1) based on sample size */
  confidence: number;
  /** Recommended helpfulness level */
  recommendedHelpfulness: string;
  /** Actionable recommendations for applying this pattern */
  recommendations: string[];
  /** Example session IDs that demonstrate this pattern */
  exampleSessionIds: string[];
  /** When this pattern was extracted */
  extractedAt: string;
}

/**
 * Pattern type classification
 */
export type PatternType =
  | 'goal_category'
  | 'session_type'
  | 'friction_avoidance'
  | 'helpfulness_correlation'
  | 'combined';

/**
 * Characteristics of successful sessions
 */
export interface IPatternCharacteristics {
  /** Common goal categories */
  goalCategories: Array<{ category: string; frequency: number }>;
  /** Common session types */
  sessionTypes: Array<{ type: string; frequency: number }>;
  /** Common helpfulness levels */
  helpfulnessLevels: Array<{ level: string; frequency: number }>;
  /** Common primary success indicators */
  primarySuccesses: Array<{ success: string; frequency: number }>;
  /** Average friction count */
  avgFrictionCount: number;
  /** Common outcomes */
  outcomeDistribution: Record<string, number>;
}

/**
 * Pattern match result for goal-based recommendations
 */
export interface IPatternMatch {
  /** The matched pattern */
  pattern: IPatternTemplate;
  /** Relevance score (0-100) */
  relevanceScore: number;
  /** Why this pattern matches */
  matchReason: string;
  /** Estimated success probability */
  estimatedSuccessProbability: number;
}

/**
 * Complete result from pattern extraction analysis
 */
export interface IPatternExtractionResult {
  /** Human-readable summary */
  summary: string;
  /** ISO timestamp when analysis was generated */
  generatedAt: string;
  /** All extracted patterns */
  patterns: IPatternTemplate[];
  /** Patterns sorted by effectiveness */
  topPatterns: IPatternTemplate[];
  /** Patterns by category */
  patternsByCategory: Record<string, IPatternTemplate[]>;
  /** Pattern effectiveness statistics */
  statistics: IPatternStatistics;
  /** Insights derived from pattern analysis */
  insights: IPatternInsight[];
}

/**
 * Pattern extraction statistics
 */
export interface IPatternStatistics {
  /** Total sessions analyzed */
  totalSessions: number;
  /** Successful sessions count */
  successfulSessions: number;
  /** Failed sessions count */
  failedSessions: number;
  /** Overall success rate */
  overallSuccessRate: number;
  /** Total patterns extracted */
  totalPatterns: number;
  /** High-confidence patterns (confidence >= 0.7) */
  highConfidencePatterns: number;
  /** Average pattern effectiveness score */
  avgEffectivenessScore: number;
}

/**
 * Insight from pattern analysis
 */
export interface IPatternInsight {
  /** Insight type */
  type: 'success_factor' | 'avoidance' | 'correlation' | 'recommendation';
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Supporting metrics */
  metrics?: Record<string, number | string>;
  /** Related pattern IDs */
  relatedPatterns?: string[];
}

// ── Constants ───────────────────────────────────────────────────────

/** Minimum sample size for high confidence */
const HIGH_CONFIDENCE_THRESHOLD = 10;

/** Minimum sample size for medium confidence */
const MEDIUM_CONFIDENCE_THRESHOLD = 5;

/** Success outcome types */
const SUCCESS_OUTCOMES = ['fully_achieved', 'mostly_achieved'];

/** Failure outcome types */
const FAILURE_OUTCOMES = ['not_achieved', 'partially_achieved'];

/** High-impact friction types to avoid */
const HIGH_IMPACT_FRICTIONS = [
  'api_error',
  'api_errors',
  'api_infrastructure_error',
  'wrong_approach',
  'context_length_exceeded',
  'context_limit',
  'buggy_code',
];

// ── Helper Functions ───────────────────────────────────────────────

/**
 * Check if an outcome is considered successful
 */
function isSuccessful(outcome: string): boolean {
  return SUCCESS_OUTCOMES.includes(outcome);
}

/**
 * Calculate confidence level based on sample size
 */
function calculateConfidence(sampleSize: number): number {
  if (sampleSize >= HIGH_CONFIDENCE_THRESHOLD) return 0.9 + Math.min((sampleSize - 10) * 0.01, 0.1);
  if (sampleSize >= MEDIUM_CONFIDENCE_THRESHOLD) return 0.6 + (sampleSize - 5) * 0.06;
  return 0.3 + sampleSize * 0.06;
}

/**
 * Calculate effectiveness score based on success rate and confidence
 */
function calculateEffectivenessScore(successRate: number, confidence: number, sampleSize: number): number {
  // Base score from success rate (0-70 points)
  const successScore = successRate * 0.7;
  // Confidence bonus (0-20 points)
  const confidenceBonus = confidence * 20;
  // Sample size bonus (0-10 points, logarithmic)
  const sampleBonus = Math.min(Math.log10(sampleSize + 1) * 5, 10);

  return Math.round(successScore + confidenceBonus + sampleBonus);
}

/**
 * Aggregate counts from an array of count objects
 */
function aggregateCounts(items: ICountObject[]): Map<string, number> {
  const aggregated = new Map<string, number>();
  for (const item of items) {
    for (const [key, count] of Object.entries(item)) {
      aggregated.set(key, (aggregated.get(key) || 0) + count);
    }
  }
  return aggregated;
}

/**
 * Get top N items from a frequency map
 */
function getTopItems(freqMap: Map<string, number>, n: number): Array<{ item: string; frequency: number }> {
  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item, frequency]) => ({ item, frequency }));
}

/**
 * Calculate frequency distribution as percentages
 */
function calculateDistribution(
  items: string[],
  total: number
): Array<{ item: string; frequency: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([item, count]) => ({
      item,
      frequency: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Calculate average friction count per session
 */
function calculateAvgFrictionCount(sessions: ISessionFacet[]): number {
  if (sessions.length === 0) return 0;

  const totalFrictions = sessions.reduce((sum, session) => {
    return sum + Object.values(session.friction_counts).reduce((a, b) => a + b, 0);
  }, 0);

  return Math.round((totalFrictions / sessions.length) * 10) / 10;
}

/**
 * Identify friction types that are avoided in successful sessions
 */
function identifyAvoidedFrictions(
  successfulSessions: ISessionFacet[],
  failedSessions: ISessionFacet[]
): string[] {
  const successfulFrictionSet = new Set<string>();
  const failedFrictionMap = new Map<string, number>();

  // Collect frictions from successful sessions
  for (const session of successfulSessions) {
    for (const friction of Object.keys(session.friction_counts)) {
      if (session.friction_counts[friction] > 0) {
        successfulFrictionSet.add(friction);
      }
    }
  }

  // Count frictions in failed sessions
  for (const session of failedSessions) {
    for (const [friction, count] of Object.entries(session.friction_counts)) {
      if (count > 0) {
        failedFrictionMap.set(friction, (failedFrictionMap.get(friction) || 0) + count);
      }
    }
  }

  // Find frictions that appear significantly more in failed sessions
  const avoided: string[] = [];
  for (const [friction, failedCount] of failedFrictionMap) {
    if (!successfulFrictionSet.has(friction) || failedCount > successfulSessions.length * 0.3) {
      avoided.push(friction);
    }
  }

  return avoided.sort((a, b) => (failedFrictionMap.get(b) || 0) - (failedFrictionMap.get(a) || 0));
}

// ── Pattern Extraction Functions ────────────────────────────────────

/**
 * Extract goal category patterns from successful sessions
 */
function extractGoalCategoryPatterns(
  successfulSessions: ISessionFacet[],
  allSessions: ISessionFacet[]
): IPatternTemplate[] {
  const patterns: IPatternTemplate[] = [];

  // Aggregate goal categories from successful sessions
  const categorySuccessMap = new Map<
    string,
    { sessions: ISessionFacet[]; count: number; successCount: number }
  >();

  for (const session of allSessions) {
    for (const category of Object.keys(session.goal_categories)) {
      if (!categorySuccessMap.has(category)) {
        categorySuccessMap.set(category, { sessions: [], count: 0, successCount: 0 });
      }
      const entry = categorySuccessMap.get(category)!;
      entry.count++;
      if (isSuccessful(session.outcome)) {
        entry.sessions.push(session);
        entry.successCount++;
      }
    }
  }

  // Create patterns for high-performing categories
  for (const [category, data] of categorySuccessMap.entries()) {
    if (data.successCount < 3) continue; // Need minimum sample size

    const successRate = Math.round((data.successCount / data.count) * 100);
    if (successRate < 60) continue; // Only patterns with good success rates

    const confidence = calculateConfidence(data.successCount);
    const effectivenessScore = calculateEffectivenessScore(successRate, confidence, data.successCount);

    const characteristics = extractCharacteristics(data.sessions);
    const avoidedFrictions = identifyAvoidedFrictions(data.sessions, allSessions.filter(s => !isSuccessful(s.outcome)));

    patterns.push({
      id: `goal-category-${category}`,
      name: `Successful ${category.replace(/_/g, ' ')} Pattern`,
      description: `Pattern for ${category.replace(/_/g, ' ')} tasks with ${successRate}% success rate`,
      type: 'goal_category',
      applicableCategories: [category],
      effectiveSessionTypes: characteristics.sessionTypes.map(t => t.type),
      characteristics,
      avoidedFrictions: avoidedFrictions.slice(0, 5),
      effectivenessScore,
      successRate,
      sampleSize: data.successCount,
      confidence,
      recommendedHelpfulness: characteristics.helpfulnessLevels[0]?.level || 'very_helpful',
      recommendations: generateCategoryRecommendations(category, characteristics, avoidedFrictions),
      exampleSessionIds: data.sessions.slice(0, 5).map(s => s.session_id),
      extractedAt: new Date().toISOString(),
    });
  }

  return patterns.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

/**
 * Extract session type patterns from successful sessions
 */
function extractSessionTypePatterns(
  successfulSessions: ISessionFacet[],
  allSessions: ISessionFacet[]
): IPatternTemplate[] {
  const patterns: IPatternTemplate[] = [];

  // Group by session type
  const typeGroups = new Map<string, ISessionFacet[]>();
  for (const session of allSessions) {
    if (!typeGroups.has(session.session_type)) {
      typeGroups.set(session.session_type, []);
    }
    typeGroups.get(session.session_type)!.push(session);
  }

  // Analyze each session type
  for (const [sessionType, sessions] of typeGroups.entries()) {
    const successfulOfType = sessions.filter(s => isSuccessful(s.outcome));
    if (successfulOfType.length < 3) continue;

    const successRate = Math.round((successfulOfType.length / sessions.length) * 100);
    if (successRate < 60) continue;

    const confidence = calculateConfidence(successfulOfType.length);
    const effectivenessScore = calculateEffectivenessScore(successRate, confidence, successfulOfType.length);

    const characteristics = extractCharacteristics(successfulOfType);
    const failedOfType = sessions.filter(s => !isSuccessful(s.outcome));
    const avoidedFrictions = identifyAvoidedFrictions(successfulOfType, failedOfType);

    // Collect applicable categories
    const categorySet = new Set<string>();
    for (const session of successfulOfType) {
      Object.keys(session.goal_categories).forEach(c => categorySet.add(c));
    }

    patterns.push({
      id: `session-type-${sessionType}`,
      name: `Effective ${sessionType.replace(/_/g, ' ')} Pattern`,
      description: `Using ${sessionType.replace(/_/g, ' ')} approach yields ${successRate}% success rate`,
      type: 'session_type',
      applicableCategories: Array.from(categorySet).slice(0, 10),
      effectiveSessionTypes: [sessionType],
      characteristics,
      avoidedFrictions: avoidedFrictions.slice(0, 5),
      effectivenessScore,
      successRate,
      sampleSize: successfulOfType.length,
      confidence,
      recommendedHelpfulness: characteristics.helpfulnessLevels[0]?.level || 'very_helpful',
      recommendations: generateSessionTypeRecommendations(sessionType, characteristics, avoidedFrictions),
      exampleSessionIds: successfulOfType.slice(0, 5).map(s => s.session_id),
      extractedAt: new Date().toISOString(),
    });
  }

  return patterns.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

/**
 * Extract friction avoidance patterns
 */
function extractFrictionAvoidancePatterns(
  successfulSessions: ISessionFacet[],
  allSessions: ISessionFacet[]
): IPatternTemplate[] {
  const patterns: IPatternTemplate[] = [];

  // Identify frictions that successful sessions avoid
  const failedSessions = allSessions.filter(s => !isSuccessful(s.outcome));
  const avoidedFrictions = identifyAvoidedFrictions(successfulSessions, failedSessions);

  if (avoidedFrictions.length === 0) return patterns;

  // Create a pattern for friction avoidance
  const characteristics = extractCharacteristics(successfulSessions);
  const successRate = Math.round((successfulSessions.length / allSessions.length) * 100);
  const confidence = calculateConfidence(successfulSessions.length);
  const effectivenessScore = calculateEffectivenessScore(successRate, confidence, successfulSessions.length);

  const categorySet = new Set<string>();
  for (const session of successfulSessions) {
    Object.keys(session.goal_categories).forEach(c => categorySet.add(c));
  }

  patterns.push({
    id: 'friction-avoidance-pattern',
    name: 'Friction Avoidance Pattern',
    description: `Successful sessions avoid: ${avoidedFrictions.slice(0, 3).join(', ').replace(/_/g, ' ')}`,
    type: 'friction_avoidance',
    applicableCategories: Array.from(categorySet).slice(0, 10),
    effectiveSessionTypes: characteristics.sessionTypes.map(t => t.type),
    characteristics,
    avoidedFrictions,
    effectivenessScore,
    successRate,
    sampleSize: successfulSessions.length,
    confidence,
    recommendedHelpfulness: characteristics.helpfulnessLevels[0]?.level || 'very_helpful',
    recommendations: avoidedFrictions.map(f => `Avoid ${f.replace(/_/g, ' ')} by planning ahead and verifying approach`),
    exampleSessionIds: successfulSessions.slice(0, 5).map(s => s.session_id),
    extractedAt: new Date().toISOString(),
  });

  return patterns;
}

/**
 * Extract helpfulness correlation patterns
 */
function extractHelpfulnessPatterns(
  successfulSessions: ISessionFacet[],
  allSessions: ISessionFacet[]
): IPatternTemplate[] {
  const patterns: IPatternTemplate[] = [];

  // Group by helpfulness level
  const helpfulnessGroups = new Map<string, ISessionFacet[]>();
  for (const session of allSessions) {
    if (!helpfulnessGroups.has(session.claude_helpfulness)) {
      helpfulnessGroups.set(session.claude_helpfulness, []);
    }
    helpfulnessGroups.get(session.claude_helpfulness)!.push(session);
  }

  // Find helpfulness levels with high success rates
  for (const [helpfulness, sessions] of helpfulnessGroups.entries()) {
    const successfulOfLevel = sessions.filter(s => isSuccessful(s.outcome));
    if (successfulOfLevel.length < 3) continue;

    const successRate = Math.round((successfulOfLevel.length / sessions.length) * 100);
    if (successRate < 70) continue;

    const confidence = calculateConfidence(successfulOfLevel.length);
    const effectivenessScore = calculateEffectivenessScore(successRate, confidence, successfulOfLevel.length);

    const characteristics = extractCharacteristics(successfulOfLevel);
    const categorySet = new Set<string>();
    for (const session of successfulOfLevel) {
      Object.keys(session.goal_categories).forEach(c => categorySet.add(c));
    }

    patterns.push({
      id: `helpfulness-${helpfulness}`,
      name: `${helpfulness.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Pattern`,
      description: `Sessions rated as "${helpfulness.replace(/_/g, ' ')}" achieve ${successRate}% success`,
      type: 'helpfulness_correlation',
      applicableCategories: Array.from(categorySet).slice(0, 10),
      effectiveSessionTypes: characteristics.sessionTypes.map(t => t.type),
      characteristics,
      avoidedFrictions: identifyAvoidedFrictions(
        successfulOfLevel,
        sessions.filter(s => !isSuccessful(s.outcome))
      ).slice(0, 5),
      effectivenessScore,
      successRate,
      sampleSize: successfulOfLevel.length,
      confidence,
      recommendedHelpfulness: helpfulness,
      recommendations: [
        `Aim for "${helpfulness.replace(/_/g, ' ')}" level assistance by being specific about requirements`,
        'Provide clear context and constraints upfront',
        'Use iterative refinement when needed',
      ],
      exampleSessionIds: successfulOfLevel.slice(0, 5).map(s => s.session_id),
      extractedAt: new Date().toISOString(),
    });
  }

  return patterns.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

/**
 * Extract characteristics from a set of sessions
 */
function extractCharacteristics(sessions: ISessionFacet[]): IPatternCharacteristics {
  const total = sessions.length;

  // Goal categories
  const categoryMap = new Map<string, number>();
  for (const session of sessions) {
    for (const [cat, count] of Object.entries(session.goal_categories)) {
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + count);
    }
  }

  // Session types
  const typeMap = new Map<string, number>();
  for (const session of sessions) {
    typeMap.set(session.session_type, (typeMap.get(session.session_type) || 0) + 1);
  }

  // Helpfulness levels
  const helpfulnessMap = new Map<string, number>();
  for (const session of sessions) {
    helpfulnessMap.set(session.claude_helpfulness, (helpfulnessMap.get(session.claude_helpfulness) || 0) + 1);
  }

  // Primary success indicators
  const successMap = new Map<string, number>();
  for (const session of sessions) {
    if (session.primary_success && session.primary_success !== 'none') {
      successMap.set(session.primary_success, (successMap.get(session.primary_success) || 0) + 1);
    }
  }

  // Outcome distribution
  const outcomeDistribution: Record<string, number> = {};
  for (const session of sessions) {
    outcomeDistribution[session.outcome] = (outcomeDistribution[session.outcome] || 0) + 1;
  }

  return {
    goalCategories: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, frequency: Math.round((count / total) * 100) }))
      .sort((a, b) => b.frequency - a.frequency),
    sessionTypes: Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, frequency: Math.round((count / total) * 100) }))
      .sort((a, b) => b.frequency - a.frequency),
    helpfulnessLevels: Array.from(helpfulnessMap.entries())
      .map(([level, count]) => ({ level, frequency: Math.round((count / total) * 100) }))
      .sort((a, b) => b.frequency - a.frequency),
    primarySuccesses: Array.from(successMap.entries())
      .map(([success, count]) => ({ success, frequency: Math.round((count / total) * 100) }))
      .sort((a, b) => b.frequency - a.frequency),
    avgFrictionCount: calculateAvgFrictionCount(sessions),
    outcomeDistribution,
  };
}

/**
 * Generate recommendations for goal category patterns
 */
function generateCategoryRecommendations(
  category: string,
  characteristics: IPatternCharacteristics,
  avoidedFrictions: string[]
): string[] {
  const recommendations: string[] = [];

  recommendations.push(`Focus on ${category.replace(/_/g, ' ')} tasks with clear, specific goals`);

  if (characteristics.sessionTypes[0]?.type) {
    recommendations.push(`Use ${characteristics.sessionTypes[0].type.replace(/_/g, ' ')} approach for best results`);
  }

  if (avoidedFrictions.length > 0) {
    recommendations.push(`Avoid ${avoidedFrictions[0].replace(/_/g, ' ')} by planning approach upfront`);
  }

  if (characteristics.avgFrictionCount < 2) {
    recommendations.push('Keep friction minimal by verifying each step before proceeding');
  }

  return recommendations;
}

/**
 * Generate recommendations for session type patterns
 */
function generateSessionTypeRecommendations(
  sessionType: string,
  characteristics: IPatternCharacteristics,
  avoidedFrictions: string[]
): string[] {
  const recommendations: string[] = [];

  recommendations.push(`Use ${sessionType.replace(/_/g, ' ')} approach for complex tasks`);

  if (characteristics.goalCategories.length > 0) {
    const topCategory = characteristics.goalCategories[0].category;
    recommendations.push(`Well-suited for ${topCategory.replace(/_/g, ' ')} tasks`);
  }

  if (avoidedFrictions.includes('wrong_approach')) {
    recommendations.push('Verify approach early to avoid rework');
  }

  if (avoidedFrictions.includes('context_length_exceeded') || avoidedFrictions.includes('context_limit')) {
    recommendations.push('Manage context carefully - summarize periodically');
  }

  return recommendations;
}

/**
 * Generate insights from extracted patterns
 */
function generateInsights(
  patterns: IPatternTemplate[],
  successfulSessions: ISessionFacet[],
  allSessions: ISessionFacet[]
): IPatternInsight[] {
  const insights: IPatternInsight[] = [];

  // Success factor insights
  const topCategoryPattern = patterns.find(p => p.type === 'goal_category');
  if (topCategoryPattern) {
    insights.push({
      type: 'success_factor',
      title: `Top Success Category: ${topCategoryPattern.applicableCategories[0]}`,
      description: `${topCategoryPattern.name} shows ${topCategoryPattern.successRate}% success rate`,
      metrics: { successRate: topCategoryPattern.successRate, sampleSize: topCategoryPattern.sampleSize },
      relatedPatterns: [topCategoryPattern.id],
    });
  }

  // Session type insight
  const sessionTypePatterns = patterns.filter(p => p.type === 'session_type');
  if (sessionTypePatterns.length > 0) {
    const bestType = sessionTypePatterns[0];
    insights.push({
      type: 'success_factor',
      title: `Most Effective Session Type: ${bestType.effectiveSessionTypes[0]}`,
      description: bestType.description,
      metrics: { effectivenessScore: bestType.effectivenessScore },
      relatedPatterns: sessionTypePatterns.map(p => p.id),
    });
  }

  // Avoidance insight
  const frictionPattern = patterns.find(p => p.type === 'friction_avoidance');
  if (frictionPattern && frictionPattern.avoidedFrictions.length > 0) {
    insights.push({
      type: 'avoidance',
      title: 'Key Frictions to Avoid',
      description: `Successful sessions avoid: ${frictionPattern.avoidedFrictions.slice(0, 3).join(', ').replace(/_/g, ' ')}`,
      relatedPatterns: [frictionPattern.id],
    });
  }

  // Helpfulness correlation
  const helpfulnessPatterns = patterns.filter(p => p.type === 'helpfulness_correlation');
  if (helpfulnessPatterns.length > 0) {
    const topHelpfulness = helpfulnessPatterns[0];
    insights.push({
      type: 'correlation',
      title: 'Helpfulness-Success Correlation',
      description: topHelpfulness.description,
      metrics: { correlationStrength: topHelpfulness.effectivenessScore },
      relatedPatterns: helpfulnessPatterns.map(p => p.id),
    });
  }

  // Overall recommendation
  const highConfidencePatterns = patterns.filter(p => p.confidence >= 0.7);
  if (highConfidencePatterns.length > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Proven Patterns Available',
      description: `${highConfidencePatterns.length} high-confidence patterns extracted from your successful sessions`,
      metrics: { highConfidencePatterns: highConfidencePatterns.length },
    });
  }

  return insights;
}

// ── Main Analyzer ───────────────────────────────────────────────────

/**
 * Extract patterns from session data
 *
 * Analyzes successful sessions (fully_achieved/mostly_achieved) and extracts
 * reusable pattern templates that can be applied to future sessions.
 *
 * @param data - Array of daily insights data
 * @returns Complete pattern extraction result
 */
export function extractPatterns(data: IInsightsDay[]): IPatternExtractionResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // Separate successful and failed sessions
  const successfulSessions = allSessions.filter(s => isSuccessful(s.outcome));
  const failedSessions = allSessions.filter(s => !isSuccessful(s.outcome));

  if (successfulSessions.length === 0) {
    return emptyResult();
  }

  // Extract patterns from different dimensions
  const categoryPatterns = extractGoalCategoryPatterns(successfulSessions, allSessions);
  const sessionTypePatterns = extractSessionTypePatterns(successfulSessions, allSessions);
  const frictionPatterns = extractFrictionAvoidancePatterns(successfulSessions, allSessions);
  const helpfulnessPatterns = extractHelpfulnessPatterns(successfulSessions, allSessions);

  // Combine all patterns
  const allPatterns = [...categoryPatterns, ...sessionTypePatterns, ...frictionPatterns, ...helpfulnessPatterns];

  // Sort by effectiveness
  const topPatterns = [...allPatterns].sort((a, b) => b.effectivenessScore - a.effectivenessScore).slice(0, 10);

  // Group by category
  const patternsByCategory: Record<string, IPatternTemplate[]> = {};
  for (const pattern of allPatterns) {
    for (const category of pattern.applicableCategories) {
      if (!patternsByCategory[category]) {
        patternsByCategory[category] = [];
      }
      patternsByCategory[category].push(pattern);
    }
  }

  // Sort patterns within each category by effectiveness
  for (const category of Object.keys(patternsByCategory)) {
    patternsByCategory[category].sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  }

  // Calculate statistics
  const highConfidencePatterns = allPatterns.filter(p => p.confidence >= 0.7).length;
  const avgEffectiveness =
    allPatterns.length > 0
      ? Math.round(allPatterns.reduce((sum, p) => sum + p.effectivenessScore, 0) / allPatterns.length)
      : 0;

  const statistics: IPatternStatistics = {
    totalSessions: total,
    successfulSessions: successfulSessions.length,
    failedSessions: failedSessions.length,
    overallSuccessRate: Math.round((successfulSessions.length / total) * 100),
    totalPatterns: allPatterns.length,
    highConfidencePatterns,
    avgEffectivenessScore: avgEffectiveness,
  };

  // Generate insights
  const insights = generateInsights(allPatterns, successfulSessions, allSessions);

  // Build summary
  const summary = `Extracted ${allPatterns.length} patterns from ${successfulSessions.length} successful sessions: ` +
    `${categoryPatterns.length} category patterns, ${sessionTypePatterns.length} session type patterns, ` +
    `${highConfidencePatterns} high-confidence patterns`;

  return {
    summary,
    generatedAt: new Date().toISOString(),
    patterns: allPatterns,
    topPatterns,
    patternsByCategory,
    statistics,
    insights,
  };
}

/**
 * Get recommended patterns for a specific goal
 *
 * Matches the goal against extracted patterns and returns the most relevant ones.
 *
 * @param goal - The goal description to match
 * @param patterns - Available patterns (from extractPatterns result)
 * @returns Array of pattern matches sorted by relevance
 */
export function getRecommendedPatterns(
  goal: string,
  patterns: IPatternTemplate[]
): IPatternMatch[] {
  const goalLower = goal.toLowerCase();
  const goalWords = goalLower.split(/\s+/).filter(w => w.length > 3);

  const matches: IPatternMatch[] = [];

  for (const pattern of patterns) {
    let relevanceScore = 0;
    const matchReasons: string[] = [];

    // Check applicable categories
    for (const category of pattern.applicableCategories) {
      const categoryLower = category.toLowerCase().replace(/_/g, ' ');
      if (goalLower.includes(categoryLower)) {
        relevanceScore += 30;
        matchReasons.push(`Goal matches category "${category}"`);
      }
      // Word-level matching
      for (const word of goalWords) {
        if (categoryLower.includes(word)) {
          relevanceScore += 10;
        }
      }
    }

    // Check pattern name/description
    const patternText = `${pattern.name} ${pattern.description}`.toLowerCase();
    for (const word of goalWords) {
      if (patternText.includes(word)) {
        relevanceScore += 5;
      }
    }

    // Boost by effectiveness score (normalized to 0-20)
    relevanceScore += (pattern.effectivenessScore / 100) * 20;

    // Boost by confidence
    relevanceScore += pattern.confidence * 10;

    // Only include if there's some relevance
    if (relevanceScore > 10) {
      const estimatedSuccessProbability = Math.round(
        (pattern.successRate * 0.6 + pattern.effectivenessScore * 0.4) * 10
      ) / 10;

      matches.push({
        pattern,
        relevanceScore: Math.min(Math.round(relevanceScore), 100),
        matchReason: matchReasons[0] || 'Semantic match with goal',
        estimatedSuccessProbability,
      });
    }
  }

  // Sort by relevance score
  return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Score a pattern's effectiveness
 *
 * @param pattern - The pattern to score
 * @returns Effectiveness score (0-100)
 */
export function scorePatternEffectiveness(pattern: IPatternTemplate): number {
  return calculateEffectivenessScore(pattern.successRate, pattern.confidence, pattern.sampleSize);
}

/**
 * Find patterns by type
 *
 * @param patterns - Available patterns
 * @param type - Pattern type to filter by
 * @returns Patterns of the specified type
 */
export function findPatternsByType(
  patterns: IPatternTemplate[],
  type: PatternType
): IPatternTemplate[] {
  return patterns.filter(p => p.type === type).sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

/**
 * Compare patterns between two time periods
 *
 * @param currentPatterns - Current period patterns
 * @param previousPatterns - Previous period patterns
 * @returns Comparison result with emerging and declining patterns
 */
export function comparePatterns(
  currentPatterns: IPatternTemplate[],
  previousPatterns: IPatternTemplate[]
): {
  emerging: IPatternTemplate[];
  declining: IPatternTemplate[];
  stable: IPatternTemplate[];
  improved: IPatternTemplate[];
} {
  const currentMap = new Map(currentPatterns.map(p => [p.id, p]));
  const previousMap = new Map(previousPatterns.map(p => [p.id, p]));

  const emerging: IPatternTemplate[] = [];
  const declining: IPatternTemplate[] = [];
  const stable: IPatternTemplate[] = [];
  const improved: IPatternTemplate[] = [];

  // Find emerging and stable patterns
  for (const current of currentPatterns) {
    const previous = previousMap.get(current.id);
    if (!previous) {
      emerging.push(current);
    } else if (current.effectivenessScore > previous.effectivenessScore + 10) {
      improved.push(current);
    } else {
      stable.push(current);
    }
  }

  // Find declining patterns
  for (const previous of previousPatterns) {
    if (!currentMap.has(previous.id)) {
      declining.push(previous);
    }
  }

  return { emerging, declining, stable, improved };
}

/**
 * Return empty result when no data is available
 */
function emptyResult(): IPatternExtractionResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    patterns: [],
    topPatterns: [],
    patternsByCategory: {},
    statistics: {
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      overallSuccessRate: 0,
      totalPatterns: 0,
      highConfidencePatterns: 0,
      avgEffectivenessScore: 0,
    },
    insights: [],
  };
}

// ── Utility Exports ────────────────────────────────────────────────

/**
 * Get the most effective patterns for quick reference
 */
export function getTopPatterns(
  data: IInsightsDay[],
  limit: number = 5
): Array<{
  id: string;
  name: string;
  type: PatternType;
  effectivenessScore: number;
  successRate: number;
  sampleSize: number;
}> {
  const result = extractPatterns(data);
  return result.topPatterns.slice(0, limit).map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    effectivenessScore: p.effectivenessScore,
    successRate: p.successRate,
    sampleSize: p.sampleSize,
  }));
}

/**
 * Get pattern statistics summary
 */
export function getPatternStatistics(data: IInsightsDay[]): IPatternStatistics {
  const result = extractPatterns(data);
  return result.statistics;
}
