/**
 * Advisory data extractor
 * Extracts patterns, insights, and recommendations from analyzer results
 */

import type {
  IInsightsDay,
  ISessionFacet,
  ICountObject,
} from '../types/insights';
import type {
  IAdvisoryPattern,
  IFrictionInsight,
  IContextStrategy,
  IRecoveryPattern,
  IPromptTemplate,
  ICrossAnalyzerCorrelation,
  IPatternEvidence,
  IContributingFactor,
  IMitigation,
  IAdvisoryExtractionResult,
} from '../types/advisory';
import { AdvisorySource, PatternQuality, ClaudeMdSection } from '../types/advisory';
import type { IBottleneckResult, IBottleneckPattern } from '../analyzers/bottleneck';
import type { IApiErrorResult, IApiErrorSession } from '../analyzers/api-errors';
import type {
  ISessionEfficiencyResult,
  IInefficientSessionPattern,
  ISessionEfficiency,
} from '../analyzers/session-efficiency';
import { deduplicateSessions } from '../utils/sessions';

// ── Constants ───────────────────────────────────────────────────────

/** Minimum sessions required for pattern detection */
const MIN_SESSIONS_FOR_PATTERN = 3;

/** Minimum percentage for pattern significance */
const MIN_PATTERN_PERCENTAGE = 5;

/** Confidence thresholds */
const CONFIDENCE_THRESHOLDS = {
  verified: 0.8,
  likely: 0.5,
  experimental: 0.2,
};

// ── ID Generation ───────────────────────────────────────────────────

/**
 * Generate a unique ID for patterns
 */
function generatePatternId(source: AdvisorySource, name: string): string {
  const timestamp = Date.now().toString(36);
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${source}-${sanitizedName}-${timestamp}`;
}

/**
 * Generate a friction insight ID
 */
function generateFrictionId(frictionType: string): string {
  const timestamp = Date.now().toString(36);
  return `friction-${frictionType}-${timestamp}`;
}

/**
 * Generate a strategy ID
 */
function generateStrategyId(name: string): string {
  const timestamp = Date.now().toString(36);
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `strategy-${sanitizedName}-${timestamp}`;
}

/**
 * Generate a recovery pattern ID
 */
function generateRecoveryId(errorType: string): string {
  const timestamp = Date.now().toString(36);
  return `recovery-${errorType}-${timestamp}`;
}

/**
 * Generate a correlation ID
 */
function generateCorrelationId(analyzerA: AdvisorySource, analyzerB: AdvisorySource): string {
  return `correlation-${analyzerA}-${analyzerB}`;
}

// ── Evidence Extraction ─────────────────────────────────────────────

/**
 * Extract pattern evidence from a session
 */
function extractEvidence(
  session: ISessionFacet,
  date: string,
  context?: string
): IPatternEvidence {
  return {
    sessionId: session.session_id,
    date,
    frictionTypes: Object.keys(session.friction_counts).filter(
      k => session.friction_counts[k] > 0
    ),
    outcome: session.outcome,
    frictionCounts: { ...session.friction_counts },
    context,
  };
}

// ── Confidence Scoring ──────────────────────────────────────────────

/**
 * Calculate confidence score for a pattern
 */
export function calculateConfidenceScore(
  occurrenceCount: number,
  totalSessions: number,
  successRateDelta?: number
): number {
  // Base confidence from occurrence rate
  const occurrenceRate = occurrenceCount / totalSessions;

  // Adjust based on sample size (more sessions = more reliable)
  const sampleSizeFactor = Math.min(1, totalSessions / 50);

  // Adjust based on success rate impact if available
  let impactFactor = 1;
  if (successRateDelta !== undefined) {
    // Higher impact = higher confidence in pattern significance
    impactFactor = 1 + Math.abs(successRateDelta) / 100;
  }

  const confidence = occurrenceRate * sampleSizeFactor * impactFactor;
  return Math.min(1, confidence);
}

/**
 * Determine pattern quality from confidence score
 */
function determineQuality(confidence: number): PatternQuality {
  if (confidence >= CONFIDENCE_THRESHOLDS.verified) {
    return PatternQuality.VERIFIED;
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.likely) {
    return PatternQuality.LIKELY;
  }
  return PatternQuality.EXPERIMENTAL;
}

// ── Main Extraction Function ────────────────────────────────────────

/**
 * Extract advisory data from all available analyzer results
 */
export function extractAdvisoryData(
  data: IInsightsDay[],
  bottleneckResult?: IBottleneckResult,
  apiErrorResult?: IApiErrorResult,
  sessionEfficiencyResult?: ISessionEfficiencyResult
): IAdvisoryExtractionResult {
  const allSessions = deduplicateSessions(data);
  const totalSessions = allSessions.length;

  if (totalSessions === 0) {
    return emptyExtractionResult();
  }

  const dateRange = {
    start: data.map(d => d.date).sort()[0] || new Date().toISOString().split('T')[0],
    end: data.map(d => d.date).sort().reverse()[0] || new Date().toISOString().split('T')[0],
  };

  const newPatterns: IAdvisoryPattern[] = [];
  const newInsights: IFrictionInsight[] = [];
  const newStrategies: IContextStrategy[] = [];
  const newRecoveryPatterns: IRecoveryPattern[] = [];
  const newCorrelations: ICrossAnalyzerCorrelation[] = [];

  // Extract from bottleneck result
  if (bottleneckResult) {
    const bottleneckPatterns = extractPatternsFromBottleneck(bottleneckResult, data);
    newPatterns.push(...bottleneckPatterns);
  }

  // Extract from API error result
  if (apiErrorResult) {
    const apiErrorPatterns = extractPatternsFromApiErrors(apiErrorResult, data);
    newPatterns.push(...apiErrorPatterns);

    const recoveryPatterns = extractRecoveryPatterns(apiErrorResult, data);
    newRecoveryPatterns.push(...recoveryPatterns);
  }

  // Extract from session efficiency result
  if (sessionEfficiencyResult) {
    const efficiencyPatterns = extractPatternsFromEfficiency(sessionEfficiencyResult, data);
    newPatterns.push(...efficiencyPatterns);

    const frictionInsights = extractFrictionInsights(sessionEfficiencyResult, data);
    newInsights.push(...frictionInsights);

    const contextStrategies = extractContextStrategies(sessionEfficiencyResult, data);
    newStrategies.push(...contextStrategies);
  }

  // Cross-correlate analyzers if multiple results available
  if (bottleneckResult && apiErrorResult) {
    const correlation = crossCorrelateAnalyzers(
      AdvisorySource.BOTTLENECK,
      AdvisorySource.API_ERROR,
      bottleneckResult,
      apiErrorResult,
      data
    );
    if (correlation) {
      newCorrelations.push(correlation);
    }
  }

  if (bottleneckResult && sessionEfficiencyResult) {
    const correlation = crossCorrelateAnalyzers(
      AdvisorySource.BOTTLENECK,
      AdvisorySource.SESSION_EFFICIENCY,
      bottleneckResult,
      sessionEfficiencyResult,
      data
    );
    if (correlation) {
      newCorrelations.push(correlation);
    }
  }

  if (apiErrorResult && sessionEfficiencyResult) {
    const correlation = crossCorrelateAnalyzers(
      AdvisorySource.API_ERROR,
      AdvisorySource.SESSION_EFFICIENCY,
      apiErrorResult,
      sessionEfficiencyResult,
      data
    );
    if (correlation) {
      newCorrelations.push(correlation);
    }
  }

  // Build summary
  const summary = buildExtractionSummary(
    totalSessions,
    newPatterns.length,
    newInsights.length,
    newStrategies.length,
    newRecoveryPatterns.length,
    newCorrelations.length
  );

  return {
    extractedAt: new Date().toISOString(),
    dateRange,
    sessionsAnalyzed: totalSessions,
    newPatterns,
    updatedPatterns: [], // Populated by store merge
    newInsights,
    newStrategies,
    newRecoveryPatterns,
    newCorrelations,
    summary,
  };
}

// ── Bottleneck Pattern Extraction ───────────────────────────────────

/**
 * Extract advisory patterns from bottleneck analysis result
 */
export function extractPatternsFromBottleneck(
  result: IBottleneckResult,
  data: IInsightsDay[]
): IAdvisoryPattern[] {
  const patterns: IAdvisoryPattern[] = [];
  const allSessions = deduplicateSessions(data);
  const totalSessions = allSessions.length;

  for (const pattern of result.patterns) {
    // Skip patterns with too few occurrences
    if (pattern.affectedCount < MIN_SESSIONS_FOR_PATTERN) {
      continue;
    }

    const confidence = calculateConfidenceScore(
      pattern.affectedCount,
      totalSessions
    );

    // Extract evidence from affected sessions
    const evidence: IPatternEvidence[] = [];
    for (const sessionId of pattern.sessionIds) {
      const session = allSessions.find(s => s.session_id === sessionId);
      const day = data.find(d => d.sessions.some(s => s.session_id === sessionId));
      if (session && day) {
        evidence.push(extractEvidence(session, day.date, pattern.description));
      }
    }

    // Determine suggested CLAUDE.md section
    const { section, content } = generateClaudeMdSuggestion(pattern);

    patterns.push({
      id: generatePatternId(AdvisorySource.BOTTLENECK, pattern.pattern),
      name: pattern.pattern,
      description: pattern.description,
      source: AdvisorySource.BOTTLENECK,
      quality: determineQuality(confidence),
      firstDetected: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      occurrenceCount: pattern.affectedCount,
      affectedPercentage: pattern.affectedPercentage,
      sessionIds: pattern.sessionIds,
      evidence,
      suggestedSection: section,
      suggestedContent: content,
      priority: mapSeverityToPriority(pattern.severity),
      tags: ['bottleneck', pattern.pattern.toLowerCase().replace(/\s+/g, '-')],
    });
  }

  return patterns;
}

/**
 * Map bottleneck severity to advisory priority
 */
function mapSeverityToPriority(severity: 'critical' | 'high' | 'medium' | 'low'): 'critical' | 'high' | 'medium' | 'low' {
  return severity;
}

/**
 * Generate CLAUDE.md suggestion for a bottleneck pattern
 */
function generateClaudeMdSuggestion(
  pattern: IBottleneckPattern
): { section: ClaudeMdSection; content: string } {
  switch (pattern.pattern) {
    case 'API Error Cascade':
      return {
        section: ClaudeMdSection.CONSTRAINTS,
        content: `### API Error Resilience\n\nWhen API errors occur:\n1. Implement exponential backoff (1s, 2s, 4s, 8s)\n2. Save progress checkpoints every 5 minutes\n3. After 3 consecutive errors, pause and notify user\n4. Use circuit breaker pattern for persistent errors`,
      };

    case 'Wrong Approach Pattern':
      return {
        section: ClaudeMdSection.CORE_PROTOCOL,
        content: `### Architecture Verification Protocol\n\nBefore implementing complex changes:\n1. Confirm approach with user\n2. Document design decisions\n3. Verify assumptions before execution\n4. Break large tasks into verifiable milestones`,
      };

    case 'Context Overflow':
      return {
        section: ClaudeMdSection.CONTEXT,
        content: `### Context Management Guidelines\n\nTo avoid context length issues:\n1. Use search tools instead of full file reads\n2. Batch related operations\n3. Summarize context periodically\n4. Prefer targeted reads over broad exploration`,
      };

    default:
      return {
        section: ClaudeMdSection.PATTERNS,
        content: `### ${pattern.pattern}\n\n${pattern.description}\n\nConsider addressing this pattern to improve session efficiency.`,
      };
  }
}

// ── API Error Pattern Extraction ────────────────────────────────────

/**
 * Extract patterns from API error analysis
 */
function extractPatternsFromApiErrors(
  result: IApiErrorResult,
  data: IInsightsDay[]
): IAdvisoryPattern[] {
  const patterns: IAdvisoryPattern[] = [];
  const allSessions = deduplicateSessions(data);
  const totalSessions = allSessions.length;

  // Pattern 1: High API error rate
  if (result.metrics.errorSessionRate > 20) {
    const confidence = calculateConfidenceScore(
      result.metrics.errorSessions,
      totalSessions
    );

    const evidence: IPatternEvidence[] = [];
    for (const session of result.worstSessions.slice(0, 10)) {
      const fullSession = allSessions.find(s => s.session_id === session.sessionId);
      const day = data.find(d => d.sessions.some(s => s.session_id === session.sessionId));
      if (fullSession && day) {
        evidence.push(extractEvidence(fullSession, day.date, `API errors: ${session.totalErrors}`));
      }
    }

    patterns.push({
      id: generatePatternId(AdvisorySource.API_ERROR, 'high-api-error-rate'),
      name: 'High API Error Rate',
      description: `${result.metrics.errorSessionRate}% of sessions affected by API errors`,
      source: AdvisorySource.API_ERROR,
      quality: determineQuality(confidence),
      firstDetected: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      occurrenceCount: result.metrics.errorSessions,
      affectedPercentage: result.metrics.errorSessionRate,
      sessionIds: result.worstSessions.map(s => s.sessionId),
      evidence,
      suggestedSection: ClaudeMdSection.CONSTRAINTS,
      suggestedContent: `### API Error Handling\n\n${result.metrics.errorSessionRate}% of sessions are affected by API errors.\n\nGuidelines:\n1. Implement retry with exponential backoff\n2. Save checkpoints before risky operations\n3. Check Anthropic status page during widespread issues\n4. Consider breaking large tasks into smaller chunks`,
      priority: result.metrics.errorSessionRate > 50 ? 'critical' : 'high',
      tags: ['api-error', 'infrastructure', 'resilience'],
    });
  }

  // Pattern 2: Specific error type patterns
  for (const errorType of result.errorTypes.slice(0, 3)) {
    if (errorType.sessions >= MIN_SESSIONS_FOR_PATTERN) {
      const confidence = calculateConfidenceScore(errorType.sessions, totalSessions);

      patterns.push({
        id: generatePatternId(AdvisorySource.API_ERROR, errorType.type),
        name: `Frequent ${errorType.type}`,
        description: `${errorType.count} occurrences affecting ${errorType.sessions} sessions`,
        source: AdvisorySource.API_ERROR,
        quality: determineQuality(confidence),
        firstDetected: new Date().toISOString(),
        lastObserved: new Date().toISOString(),
        occurrenceCount: errorType.sessions,
        affectedPercentage: errorType.percentageOfErrorSessions,
        sessionIds: result.worstSessions
          .filter(s => s.errorTypes.includes(errorType.type))
          .map(s => s.sessionId),
        evidence: [], // Would need to extract from sessions
        suggestedSection: ClaudeMdSection.CONSTRAINTS,
        suggestedContent: `### Handling ${errorType.type}\n\nThis error type has occurred ${errorType.count} times.\n\nMitigation:\n1. Add specific retry logic for this error\n2. Monitor frequency and timing patterns\n3. Consider alternative approaches when this error occurs`,
        priority: errorType.count > 20 ? 'high' : 'medium',
        tags: ['api-error', errorType.type.toLowerCase().replace(/\s+/g, '-')],
      });
    }
  }

  return patterns;
}

// ── Recovery Pattern Extraction ─────────────────────────────────────

/**
 * Extract recovery patterns from API error analysis
 */
export function extractRecoveryPatterns(
  result: IApiErrorResult,
  data: IInsightsDay[]
): IRecoveryPattern[] {
  const patterns: IRecoveryPattern[] = [];
  const allSessions = deduplicateSessions(data);

  // Find sessions with API errors that still succeeded
  const successfulRecoveries = result.worstSessions.filter(
    s => s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
  );

  if (successfulRecoveries.length < MIN_SESSIONS_FOR_PATTERN) {
    return patterns;
  }

  // Group by error types
  const recoveriesByErrorType = new Map<string, IApiErrorSession[]>();
  for (const recovery of successfulRecoveries) {
    for (const errorType of recovery.errorTypes) {
      if (!recoveriesByErrorType.has(errorType)) {
        recoveriesByErrorType.set(errorType, []);
      }
      recoveriesByErrorType.get(errorType)!.push(recovery);
    }
  }

  // Create recovery patterns for each error type
  for (const [errorType, recoveries] of recoveriesByErrorType) {
    if (recoveries.length < MIN_SESSIONS_FOR_PATTERN) {
      continue;
    }

    const evidence: IPatternEvidence[] = [];
    for (const recovery of recoveries) {
      const session = allSessions.find(s => s.session_id === recovery.sessionId);
      const day = data.find(d => d.sessions.some(s => s.session_id === recovery.sessionId));
      if (session && day) {
        evidence.push(extractEvidence(session, day.date, `Recovered from ${errorType}`));
      }
    }

    const successRate = Math.round((recoveries.length / result.worstSessions.filter(
      s => s.errorTypes.includes(errorType)
    ).length) * 100);

    patterns.push({
      id: generateRecoveryId(errorType),
      errorType,
      name: `${errorType} Recovery`,
      description: `Successful recovery pattern for ${errorType}`,
      steps: [
        'Pause and assess the error',
        'Wait briefly before retry (exponential backoff)',
        'Save current progress if possible',
        'Retry with simplified approach if needed',
      ],
      successRate,
      occurrenceCount: recoveries.length,
      sessionIds: recoveries.map(r => r.sessionId),
      evidence,
      claudeMdContent: `### Recovering from ${errorType}\n\nWhen encountering ${errorType}:\n1. Pause and assess\n2. Wait briefly before retry\n3. Save progress\n4. Retry with simplified approach\n\nSuccess rate: ${successRate}%`,
    });
  }

  return patterns;
}

// ── Friction Insight Extraction ─────────────────────────────────────

/**
 * Extract friction insights from session efficiency analysis
 */
export function extractFrictionInsights(
  result: ISessionEfficiencyResult,
  data: IInsightsDay[]
): IFrictionInsight[] {
  const insights: IFrictionInsight[] = [];
  const allSessions = deduplicateSessions(data);

  for (const pattern of result.inefficientPatterns) {
    // Extract contributing factors
    const contributingFactors: IContributingFactor[] = [];

    for (const sessionType of pattern.commonSessionTypes) {
      contributingFactors.push({
        factor: `session_type:${sessionType.type}`,
        contributionScore: Math.round((sessionType.count / pattern.count) * 100),
        evidence: [`${sessionType.count} sessions of type ${sessionType.type}`],
        sessionCount: sessionType.count,
      });
    }

    for (const outcome of pattern.commonOutcomes) {
      contributingFactors.push({
        factor: `outcome:${outcome.outcome}`,
        contributionScore: Math.round((outcome.count / pattern.count) * 100),
        evidence: [`${outcome.count} sessions with outcome ${outcome.outcome}`],
        sessionCount: outcome.count,
      });
    }

    // Calculate success rate
    const successfulOutcomes = pattern.commonOutcomes.filter(
      o => o.outcome === 'fully_achieved' || o.outcome === 'mostly_achieved'
    );
    const successCount = successfulOutcomes.reduce((sum, o) => sum + o.count, 0);
    const successRate = Math.round((successCount / pattern.count) * 100);

    // Generate mitigations
    const mitigations: IMitigation[] = generateMitigationsForPattern(pattern);

    insights.push({
      id: generateFrictionId(pattern.pattern),
      frictionType: pattern.pattern,
      description: pattern.description,
      source: AdvisorySource.SESSION_EFFICIENCY,
      firstDetected: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      occurrenceCount: pattern.count,
      affectedSessions: pattern.sessionIds,
      rootCauseAnalysis: generateRootCauseAnalysis(pattern),
      contributingFactors,
      mitigations,
      successRate,
      successRateDelta: successRate - result.stats.efficiencyRate,
    });
  }

  return insights;
}

/**
 * Generate root cause analysis for a pattern
 */
function generateRootCauseAnalysis(pattern: IInefficientSessionPattern): string {
  switch (pattern.pattern) {
    case 'high_iteration_refinement':
      return 'Unclear requirements or success criteria leading to repeated adjustments';

    case 'excessive_changes_pattern':
      return 'Insufficient planning before implementation, leading to rework';

    case 'wrong_approach_pattern':
      return 'Lack of architecture verification before major implementation';

    case 'context_overflow_pattern':
      return 'Inefficient context management, reading too much data at once';

    case 'poor_outcome_high_friction':
      return 'Multiple compounding issues creating a negative feedback loop';

    default:
      return 'Complex interaction of factors requiring further investigation';
  }
}

/**
 * Generate mitigations for a pattern
 */
function generateMitigationsForPattern(pattern: IInefficientSessionPattern): IMitigation[] {
  const mitigations: IMitigation[] = [];

  switch (pattern.pattern) {
    case 'high_iteration_refinement':
      mitigations.push({
        description: 'Add explicit success criteria at session start',
        expectedImpact: 'high',
        implementationEffort: 'low',
        targetSection: ClaudeMdSection.CORE_PROTOCOL,
        draftContent: '### Requirements Clarification\n\nBefore starting refinement:\n1. Define explicit success criteria\n2. Confirm understanding with user\n3. Set iteration limit (max 5)',
      });
      break;

    case 'excessive_changes_pattern':
      mitigations.push({
        description: 'Implement "think before edit" protocol',
        expectedImpact: 'high',
        implementationEffort: 'medium',
        targetSection: ClaudeMdSection.WORKFLOW,
        draftContent: '### Think Before Edit\n\nBefore making changes:\n1. Plan the full approach\n2. Document in CLAUDE.md\n3. Get confirmation for complex changes',
      });
      break;

    case 'wrong_approach_pattern':
      mitigations.push({
        description: 'Add architecture verification step',
        expectedImpact: 'high',
        implementationEffort: 'medium',
        targetSection: ClaudeMdSection.CORE_PROTOCOL,
        draftContent: '### Architecture Verification\n\nFor complex changes:\n1. Present approach before implementation\n2. Confirm with user\n3. Document decisions',
      });
      break;

    case 'context_overflow_pattern':
      mitigations.push({
        description: 'Use search-first approach for file exploration',
        expectedImpact: 'medium',
        implementationEffort: 'low',
        targetSection: ClaudeMdSection.CONTEXT,
        draftContent: '### Search-First Approach\n\nWhen exploring code:\n1. Use grep/search tools first\n2. Read only relevant sections\n3. Batch related reads',
      });
      break;
  }

  return mitigations;
}

// ── Context Strategy Extraction ─────────────────────────────────────

/**
 * Extract context management strategies from efficiency analysis
 */
export function extractContextStrategies(
  result: ISessionEfficiencyResult,
  data: IInsightsDay[]
): IContextStrategy[] {
  const strategies: IContextStrategy[] = [];
  const allSessions = deduplicateSessions(data);

  // Strategy 1: From efficient sessions
  const efficientSessions = result.sessionAnalysis.filter(
    s => s.classification === 'highly_efficient' || s.classification === 'efficient'
  );

  if (efficientSessions.length >= MIN_SESSIONS_FOR_PATTERN) {
    const evidence: IPatternEvidence[] = [];
    for (const session of efficientSessions.slice(0, 10)) {
      const fullSession = allSessions.find(s => s.session_id === session.sessionId);
      const day = data.find(d => d.sessions.some(s => s.session_id === session.sessionId));
      if (fullSession && day) {
        evidence.push(extractEvidence(fullSession, day.date, 'Efficient session'));
      }
    }

    strategies.push({
      id: generateStrategyId('efficient-session-pattern'),
      name: 'Efficient Session Pattern',
      description: 'Characteristics of highly efficient sessions',
      whenToApply: 'When starting new tasks',
      benefits: ['Higher success rate', 'Fewer iterations', 'Less friction'],
      supportingEvidence: evidence,
      claudeMdContent: `### Efficient Session Guidelines\n\nCharacteristics of efficient sessions:\n- Clear goals\n- Minimal friction\n- Single-task focus\n- Proper planning`,
      targetSection: ClaudeMdSection.WORKFLOW,
      confidence: PatternQuality.LIKELY,
    });
  }

  // Strategy 2: From low-iteration refinement sessions
  const lowIterationRefinement = result.iterativeRefinementAnalysis.outcomeCorrelation
    .find(r => r.iterationRange === '1-2 iterations' && r.successRate > 70);

  if (lowIterationRefinement && lowIterationRefinement.count >= MIN_SESSIONS_FOR_PATTERN) {
    strategies.push({
      id: generateStrategyId('minimal-refinement'),
      name: 'Minimal Refinement Strategy',
      description: 'Achieve goals in 1-2 iterations with clear initial approach',
      whenToApply: 'For iterative refinement sessions',
      benefits: ['Faster completion', 'Higher success rate', 'Less context usage'],
      supportingEvidence: [],
      claudeMdContent: `### Minimal Refinement Strategy\n\nTo minimize iterations:\n1. Clarify requirements upfront\n2. Confirm approach before changes\n3. Set clear success criteria`,
      targetSection: ClaudeMdSection.WORKFLOW,
      confidence: PatternQuality.EXPERIMENTAL,
    });
  }

  return strategies;
}

// ── Efficiency Pattern Extraction ───────────────────────────────────

/**
 * Extract patterns from session efficiency analysis
 */
function extractPatternsFromEfficiency(
  result: ISessionEfficiencyResult,
  data: IInsightsDay[]
): IAdvisoryPattern[] {
  const patterns: IAdvisoryPattern[] = [];
  const allSessions = deduplicateSessions(data);
  const totalSessions = result.stats.totalSessions;

  // Pattern from inefficient sessions
  if (result.stats.inefficientSessions > MIN_SESSIONS_FOR_PATTERN) {
    const confidence = calculateConfidenceScore(
      result.stats.inefficientSessions,
      totalSessions
    );

    const evidence: IPatternEvidence[] = [];
    const inefficientSessionIds = result.sessionAnalysis
      .filter(s => s.classification === 'inefficient' || s.classification === 'highly_inefficient')
      .slice(0, 10);

    for (const session of inefficientSessionIds) {
      const fullSession = allSessions.find(s => s.session_id === session.sessionId);
      const day = data.find(d => d.sessions.some(s => s.session_id === session.sessionId));
      if (fullSession && day) {
        evidence.push(extractEvidence(
          fullSession,
          day.date,
          `Inefficient: ${session.inefficiencyFactors.join(', ')}`
        ));
      }
    }

    patterns.push({
      id: generatePatternId(AdvisorySource.SESSION_EFFICIENCY, 'inefficient-sessions'),
      name: 'Inefficient Session Pattern',
      description: `${result.stats.inefficientSessions} sessions (${100 - result.stats.efficiencyRate}%) classified as inefficient`,
      source: AdvisorySource.SESSION_EFFICIENCY,
      quality: determineQuality(confidence),
      firstDetected: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      occurrenceCount: result.stats.inefficientSessions,
      affectedPercentage: 100 - result.stats.efficiencyRate,
      sessionIds: result.sessionAnalysis
        .filter(s => s.classification === 'inefficient' || s.classification === 'highly_inefficient')
        .map(s => s.sessionId),
      evidence,
      suggestedSection: ClaudeMdSection.QUALITY,
      suggestedContent: `### Improving Session Efficiency\n\n${result.stats.inefficientSessions} sessions (${100 - result.stats.efficiencyRate}%) were inefficient.\n\nRecommendations:\n1. Plan before executing\n2. Clarify requirements upfront\n3. Use iterative refinement sparingly`,
      priority: result.stats.efficiencyRate < 50 ? 'critical' : 'high',
      tags: ['efficiency', 'session-optimization'],
    });
  }

  return patterns;
}

// ── Cross-Analyzer Correlation ──────────────────────────────────────

/**
 * Find correlations between different analyzer results
 */
export function crossCorrelateAnalyzers(
  sourceA: AdvisorySource,
  sourceB: AdvisorySource,
  resultA: IBottleneckResult | IApiErrorResult | ISessionEfficiencyResult,
  resultB: IBottleneckResult | IApiErrorResult | ISessionEfficiencyResult,
  data: IInsightsDay[]
): ICrossAnalyzerCorrelation | null {
  const allSessions = deduplicateSessions(data);

  // Extract session IDs from each result
  const sessionsA = extractSessionIdsFromResult(resultA);
  const sessionsB = extractSessionIdsFromResult(resultB);

  // Find overlapping sessions
  const overlap = sessionsA.filter(id => sessionsB.includes(id));

  if (overlap.length < MIN_SESSIONS_FOR_PATTERN) {
    return null;
  }

  // Calculate correlation strength
  const correlationStrength = overlap.length / Math.max(sessionsA.length, sessionsB.length);

  // Generate insight and recommendation
  const { insight, recommendation } = generateCorrelationInsight(
    sourceA,
    sourceB,
    overlap.length,
    correlationStrength
  );

  return {
    id: generateCorrelationId(sourceA, sourceB),
    analyzerA: sourceA,
    analyzerB: sourceB,
    description: `Correlation between ${sourceA} and ${sourceB} patterns`,
    correlationStrength,
    sessionIds: overlap,
    insight,
    recommendation,
  };
}

/**
 * Extract session IDs from an analyzer result
 */
function extractSessionIdsFromResult(
  result: IBottleneckResult | IApiErrorResult | ISessionEfficiencyResult
): string[] {
  if ('patterns' in result && Array.isArray(result.patterns)) {
    // IBottleneckResult
    return result.patterns.flatMap(p => p.sessionIds || []);
  }

  if ('worstSessions' in result) {
    // IApiErrorResult
    return result.worstSessions.map(s => s.sessionId);
  }

  if ('sessionAnalysis' in result) {
    // ISessionEfficiencyResult
    return result.sessionAnalysis
      .filter(s => s.classification === 'inefficient' || s.classification === 'highly_inefficient')
      .map(s => s.sessionId);
  }

  return [];
}

/**
 * Generate insight for a correlation
 */
function generateCorrelationInsight(
  sourceA: AdvisorySource,
  sourceB: AdvisorySource,
  overlapCount: number,
  correlationStrength: number
): { insight: string; recommendation: string } {
  const strength = correlationStrength > 0.7 ? 'strong' : correlationStrength > 0.4 ? 'moderate' : 'weak';

  const insight = `Found ${strength} correlation between ${sourceA} and ${sourceB} patterns ` +
    `(${overlapCount} overlapping sessions, ${Math.round(correlationStrength * 100)}% overlap)`;

  const recommendation = `Address ${sourceA} and ${sourceB} issues together as they frequently co-occur. ` +
    `Consider combined mitigation strategies in CLAUDE.md.`;

  return { insight, recommendation };
}

// ── Utility Functions ───────────────────────────────────────────────

/**
 * Build extraction summary
 */
function buildExtractionSummary(
  totalSessions: number,
  newPatterns: number,
  newInsights: number,
  newStrategies: number,
  newRecoveryPatterns: number,
  newCorrelations: number
): string {
  const parts: string[] = [];
  parts.push(`Analyzed ${totalSessions} sessions`);

  if (newPatterns > 0) parts.push(`${newPatterns} patterns detected`);
  if (newInsights > 0) parts.push(`${newInsights} friction insights`);
  if (newStrategies > 0) parts.push(`${newStrategies} context strategies`);
  if (newRecoveryPatterns > 0) parts.push(`${newRecoveryPatterns} recovery patterns`);
  if (newCorrelations > 0) parts.push(`${newCorrelations} cross-analyzer correlations`);

  if (parts.length === 1) {
    parts.push('No new patterns detected');
  }

  return parts.join(', ');
}

/**
 * Return empty extraction result
 */
function emptyExtractionResult(): IAdvisoryExtractionResult {
  const now = new Date().toISOString();
  return {
    extractedAt: now,
    dateRange: { start: now, end: now },
    sessionsAnalyzed: 0,
    newPatterns: [],
    updatedPatterns: [],
    newInsights: [],
    newStrategies: [],
    newRecoveryPatterns: [],
    newCorrelations: [],
    summary: 'No sessions to analyze',
  };
}
