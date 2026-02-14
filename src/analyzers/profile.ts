import type { IReportData, IChartData } from '../parsers/report-html';
import type { IInsightsDay } from '../types/insights';

export interface ICodingProfile {
  generatedAt: string;

  // Identity
  identity: {
    totalMessages: number;
    totalSessions: number;
    activeDays: number;
    msgsPerDay: number;
    dateRange: { start: string; end: string };
  };

  // Language Profile
  languages: Array<{ name: string; value: number; percentage: number }>;
  primaryLanguage: string;

  // Tool Usage Profile
  tools: Array<{ name: string; value: number; percentage: number }>;
  topTool: string;

  // Work Style
  workStyle: {
    dominantSessionType: string;
    sessionTypeBreakdown: Array<{ type: string; count: number; percentage: number }>;
    avgResponseTime: { median: number; average: number } | null;
    multiClauding: { overlapEvents: number; sessionsInvolved: number; ofMessages: string } | null;
  };

  // Time Patterns
  timePatterns: {
    hourlyActivity: Record<string, number>;
    peakPeriod: string; // "Morning", "Afternoon", "Evening", "Night"
    peakHours: string; // e.g. "12-18"
  };

  // Goal Categories (what you work on)
  goalCategories: Array<{ name: string; count: number; percentage: number }>;
  topGoalCategory: string;

  // Project Areas
  projectAreas: Array<{ name: string; sessionCount: string; description: string }>;

  // Success Profile
  successProfile: {
    outcomes: Array<{ name: string; count: number }>;
    successRate: number; // (fully + mostly) / total * 100
    whatHelpsMost: Array<{ name: string; count: number }>;
  };

  // Friction Profile
  frictionProfile: {
    topFrictionTypes: Array<{ name: string; count: number }>;
    categories: Array<{ title: string; description: string; examples: string[] }>;
  };

  // Satisfaction
  satisfaction: {
    distribution: Array<{ name: string; count: number }>;
    overallSentiment: 'positive' | 'mixed' | 'negative';
  };

  // Strengths & Weaknesses (from report narratives)
  strengths: string[]; // from bigWins titles
  weaknesses: string[]; // from frictionCategories titles
  keyInsight: string; // from narrative.keyInsight

  // Recommendations
  claudeMdSuggestions: Array<{ code: string; reason: string }>;
  featureRecommendations: Array<{ title: string; oneliner: string; why: string }>;
}

/**
 * Find a chart by title substring (case-insensitive)
 */
function findChart(charts: IChartData[], titleSubstring: string): IChartData | undefined {
  return charts.find(c => c.title.toLowerCase().includes(titleSubstring.toLowerCase()));
}

/**
 * Convert chart items to format with percentages
 */
function withPercentages(items: Array<{ label: string; value: number }>): Array<{ name: string; value: number; percentage: number }> {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  return items.map(i => ({
    name: i.label,
    value: i.value,
    percentage: total > 0 ? Math.round((i.value / total) * 100) : 0,
  }));
}

/**
 * Calculate peak period from hourly activity
 */
function calculatePeakPeriod(hourlyActivity: Record<string, number>): { peakPeriod: string; peakHours: string } {
  const periods = {
    Morning: { hours: [6, 7, 8, 9, 10, 11], total: 0 },
    Afternoon: { hours: [12, 13, 14, 15, 16, 17], total: 0 },
    Evening: { hours: [18, 19, 20, 21, 22, 23], total: 0 },
    Night: { hours: [0, 1, 2, 3, 4, 5], total: 0 },
  };

  // Sum activity for each period
  Object.entries(periods).forEach(([_periodName, period]) => {
    period.total = period.hours.reduce((sum, hour) => {
      // Try both zero-padded and non-padded keys
      return sum + (hourlyActivity[hour.toString()] || hourlyActivity[hour.toString().padStart(2, '0')] || 0);
    }, 0);
  });

  // Find peak period
  let peakPeriod = 'Morning';
  let maxTotal = 0;
  let peakHours = '6-11';

  Object.entries(periods).forEach(([periodName, period]) => {
    if (period.total > maxTotal) {
      maxTotal = period.total;
      peakPeriod = periodName;
      const minHour = Math.min(...period.hours);
      const maxHour = Math.max(...period.hours);
      peakHours = `${minHour}-${maxHour}`;
    }
  });

  return { peakPeriod, peakHours };
}

/**
 * Determine overall satisfaction sentiment
 */
function determineSentiment(distribution: Array<{ name: string; count: number }>): 'positive' | 'mixed' | 'negative' {
  const positiveTerms = ['satisfied', 'likely_satisfied', 'happy'];
  const negativeTerms = ['dissatisfied', 'frustrated'];

  let positiveCount = 0;
  let negativeCount = 0;

  distribution.forEach(item => {
    const name = item.name.toLowerCase();
    if (positiveTerms.some(term => name.includes(term))) {
      positiveCount += item.count;
    } else if (negativeTerms.some(term => name.includes(term))) {
      negativeCount += item.count;
    }
  });

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'mixed';
}

/**
 * Generate coding profile from report data and optional facets data
 */
export function generateProfile(reportData: IReportData, _facetsData?: IInsightsDay[]): ICodingProfile {
  const charts = reportData.charts;

  // 1. Identity
  const identity = {
    totalMessages: reportData.stats.messages,
    totalSessions: reportData.stats.sessions,
    activeDays: reportData.stats.days,
    msgsPerDay: reportData.stats.msgsPerDay,
    dateRange: reportData.dateRange,
  };

  // 2. Languages
  const languagesChart = findChart(charts, 'language');
  const languages = languagesChart ? withPercentages(languagesChart.items) : [];
  const primaryLanguage = languages.length > 0 ? languages[0].name : 'Unknown';

  // 3. Tools
  const toolsChart = findChart(charts, 'tool');
  const tools = toolsChart ? withPercentages(toolsChart.items) : [];
  const topTool = tools.length > 0 ? tools[0].name : 'Unknown';

  // 4. Work Style
  const sessionTypesChart = findChart(charts, 'session type');
  const sessionTypeItems = sessionTypesChart ? withPercentages(sessionTypesChart.items) : [];
  const sessionTypeBreakdown = sessionTypeItems.map(i => ({ type: i.name, count: i.value, percentage: i.percentage }));
  const dominantSessionType = sessionTypeBreakdown.length > 0 ? sessionTypeBreakdown[0].type : 'Unknown';

  const workStyle = {
    dominantSessionType,
    sessionTypeBreakdown,
    avgResponseTime: reportData.responseTime,
    multiClauding: reportData.multiClauding,
  };

  // 5. Time Patterns
  const { peakPeriod, peakHours } = calculatePeakPeriod(reportData.hourlyActivity);
  const timePatterns = {
    hourlyActivity: reportData.hourlyActivity,
    peakPeriod,
    peakHours,
  };

  // 6. Goal Categories
  const goalCategoriesChart = findChart(charts, 'what you wanted');
  const goalCategoriesRaw = goalCategoriesChart ? withPercentages(goalCategoriesChart.items) : [];
  const goalCategories = goalCategoriesRaw.map(i => ({ name: i.name, count: i.value, percentage: i.percentage }));
  const topGoalCategory = goalCategories.length > 0 ? goalCategories[0].name : 'Unknown';

  // 7. Project Areas
  const projectAreas = reportData.projectAreas;

  // 8. Success Profile
  const outcomesChart = findChart(charts, 'outcome');
  const outcomes = outcomesChart ? outcomesChart.items.map(i => ({ name: i.label, count: i.value })) : [];

  let successRate = 0;
  if (outcomes.length > 0) {
    const total = outcomes.reduce((sum, o) => sum + o.count, 0);
    const successCount = outcomes
      .filter(o => o.name.toLowerCase().includes('full') || o.name.toLowerCase().includes('most'))
      .reduce((sum, o) => sum + o.count, 0);
    successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
  }

  const helpedMostChart = findChart(charts, 'what helped');
  const whatHelpsMost = helpedMostChart ? helpedMostChart.items.map(i => ({ name: i.label, count: i.value })) : [];

  const successProfile = {
    outcomes,
    successRate,
    whatHelpsMost,
  };

  // 9. Friction Profile
  const frictionChart = findChart(charts, 'friction');
  const topFrictionTypes = frictionChart ? frictionChart.items.map(i => ({ name: i.label, count: i.value })) : [];

  const frictionProfile = {
    topFrictionTypes,
    categories: reportData.frictionCategories,
  };

  // 10. Satisfaction
  const satisfactionChart = findChart(charts, 'satisfaction');
  const satisfactionDistribution = satisfactionChart ? satisfactionChart.items.map(i => ({ name: i.label, count: i.value })) : [];
  const overallSentiment = determineSentiment(satisfactionDistribution);

  const satisfaction = {
    distribution: satisfactionDistribution,
    overallSentiment,
  };

  // 11. Strengths
  const strengths = reportData.bigWins.map(w => w.title);

  // 12. Weaknesses
  const weaknesses = reportData.frictionCategories.map(f => f.title);

  // 13. Key Insight
  const keyInsight = reportData.narrative.keyInsight;

  // 14. Recommendations
  const claudeMdSuggestions = reportData.claudeMdSuggestions;
  const featureRecommendations = reportData.featureCards;

  return {
    generatedAt: new Date().toISOString(),
    identity,
    languages,
    primaryLanguage,
    tools,
    topTool,
    workStyle,
    timePatterns,
    goalCategories,
    topGoalCategory,
    projectAreas,
    successProfile,
    frictionProfile,
    satisfaction,
    strengths,
    weaknesses,
    keyInsight,
    claudeMdSuggestions,
    featureRecommendations,
  };
}

/**
 * Create ASCII bar chart
 */
function createBar(percentage: number, maxLength: number = 20): string {
  const filledLength = Math.round((percentage / 100) * maxLength);
  return '█'.repeat(filledLength);
}

/**
 * Format profile as human-readable text
 */
export function formatProfileText(profile: ICodingProfile): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════');
  lines.push('  YOUR CLAUDE CODE PROFILE');
  lines.push(`  ${profile.identity.dateRange.start} to ${profile.identity.dateRange.end}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');

  // Identity
  lines.push('📊 IDENTITY');
  lines.push(`  • ${profile.identity.totalMessages.toLocaleString()} messages across ${profile.identity.totalSessions} sessions`);
  lines.push(`  • ${profile.identity.activeDays} active days (${profile.identity.msgsPerDay.toFixed(1)} msgs/day)`);
  lines.push('');

  // Languages
  lines.push('💻 LANGUAGES');
  profile.languages.slice(0, 5).forEach(lang => {
    const bar = createBar(lang.percentage);
    lines.push(`  ${lang.name.padEnd(12)} ${bar} ${lang.percentage}%`);
  });
  lines.push('');

  // Top Tools
  lines.push('🔧 TOP TOOLS');
  profile.tools.slice(0, 5).forEach(tool => {
    const bar = createBar(tool.percentage);
    lines.push(`  ${tool.name.padEnd(12)} ${bar} ${tool.percentage}%`);
  });
  lines.push('');

  // Work Schedule
  lines.push('⏰ WORK SCHEDULE');
  lines.push(`  Peak: ${profile.timePatterns.peakPeriod} (${profile.timePatterns.peakHours})`);
  if (profile.workStyle.multiClauding) {
    lines.push(`  Multi-clauding: ${profile.workStyle.multiClauding.overlapEvents} overlap events (${profile.workStyle.multiClauding.ofMessages})`);
  }
  if (profile.workStyle.avgResponseTime) {
    lines.push(`  Response time: Median ${profile.workStyle.avgResponseTime.median.toFixed(1)}s, Avg ${profile.workStyle.avgResponseTime.average.toFixed(1)}s`);
  }
  lines.push('');

  // What You Work On
  lines.push('🎯 WHAT YOU WORK ON');
  profile.goalCategories.slice(0, 5).forEach(goal => {
    const bar = createBar(goal.percentage);
    lines.push(`  ${goal.name.padEnd(15)} ${bar} ${goal.percentage}%`);
  });
  lines.push('');

  // Success Profile
  lines.push('✅ SUCCESS PROFILE');
  lines.push(`  Success rate: ${profile.successProfile.successRate}% (Fully + Mostly achieved)`);
  if (profile.successProfile.whatHelpsMost.length > 0) {
    lines.push(`  Top helper: ${profile.successProfile.whatHelpsMost[0].name}`);
  }
  lines.push('');

  // Friction Points
  lines.push('⚡ FRICTION POINTS');
  const frictionSummary = profile.frictionProfile.topFrictionTypes
    .slice(0, 3)
    .map(f => `${f.name} (${f.count})`)
    .join(', ');
  lines.push(`  ${frictionSummary}`);
  lines.push('');

  // Strengths
  if (profile.strengths.length > 0) {
    lines.push('💪 STRENGTHS');
    profile.strengths.forEach(strength => {
      lines.push(`  • ${strength}`);
    });
    lines.push('');
  }

  // Areas to Improve
  if (profile.weaknesses.length > 0) {
    lines.push('⚠️  AREAS TO IMPROVE');
    profile.weaknesses.forEach(weakness => {
      lines.push(`  • ${weakness}`);
    });
    lines.push('');
  }

  // Key Insight
  if (profile.keyInsight) {
    lines.push('💡 KEY INSIGHT');
    // Word wrap at 60 characters
    const words = profile.keyInsight.split(' ');
    let currentLine = '  ';
    words.forEach(word => {
      if (currentLine.length + word.length + 1 > 62) {
        lines.push(currentLine);
        currentLine = '  ' + word;
      } else {
        currentLine += (currentLine.length > 2 ? ' ' : '') + word;
      }
    });
    if (currentLine.length > 2) {
      lines.push(currentLine);
    }
    lines.push('');
  }

  // Recommendations
  if (profile.claudeMdSuggestions.length > 0) {
    lines.push('🚀 RECOMMENDED CLAUDE.md ADDITIONS');
    profile.claudeMdSuggestions.slice(0, 3).forEach(sugg => {
      lines.push(`  • ${sugg.reason}`);
    });
    lines.push('');
  }

  if (profile.featureRecommendations.length > 0) {
    lines.push('💎 FEATURE RECOMMENDATIONS');
    profile.featureRecommendations.slice(0, 3).forEach(feat => {
      lines.push(`  • ${feat.title}: ${feat.oneliner}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}
