// Re-export analyzers (they're pure functions, no Node.js deps)
export { analyzeBottlenecks, getHighSeveritySessions } from '@shared/analyzers/bottleneck'
export type { IBottleneckResult, IBottleneckPattern } from '@shared/analyzers/bottleneck'
export { analyzeTrends } from '@shared/analyzers/trends'
export type { ITrendResult, ITrendAnalysis, ITrendPoint } from '@shared/analyzers/trends'
export { analyzeProductivity, getHelpfulnessScore, getSatisfactionRatio } from '@shared/analyzers/productivity'
export type { IProductivityResult, ICategoryStats, IRecommendation, ISessionTypeStats, IHelpfulnessCorrelation, IFrictionPattern } from '@shared/analyzers/productivity'
