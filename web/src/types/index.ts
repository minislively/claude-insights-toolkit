// Re-export types from shared CLI project (type-only, no runtime dependency)
export type {
  IInsightsDay,
  ISessionFacet,
  ICountObject,
} from '@shared/types/insights'

export {
  Outcome,
  ClaudeHelpfulness,
  SessionType,
  PrimarySuccess,
} from '@shared/types/insights'

export interface IOverviewResponse {
  period: {
    days: number
    start_date: string
    end_date: string
  }
  kpis: {
    success_rate: number
    api_error_session_rate: number
    context_overflow_rate: number
    estimated_cost_usd: number | null
    cost_per_success: number | null
    iterative_refinement_share: number
    efficiency: {
      summary: {
        average_score: number
        median_score: number
        p90_score: number
      }
      distribution: Array<{
        bucket: string
        count: number
        share: number
      }>
    }
    helpfulness_distribution: Record<string, { count: number; share: number }>
    user_satisfaction_distribution: Record<string, { count: number; share: number }>
  }
}
