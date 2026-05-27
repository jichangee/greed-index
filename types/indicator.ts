export interface IndicatorData {
  cape: number | null
  pe: number | null
  earningsYield: number | null
  dividendYield: number | null
  bondYield: number | null
  vix: number | null
  rsi: number | null
  stochastic: number | null
  weekPosition52: number | null
  price: number | null
}

export type Signal = 'LOW' | 'MEDIUM' | 'HIGH'

// Convenience type used by UI components.
export interface ScoreResult {
  totalScore: number
  signal: Signal
}

export interface MarketResponse {
  totalScore: number
  signal: Signal
  cachedAt: string
  asOfDate: string
  inputs: IndicatorData
}

export interface MarketResponseWithInputs extends MarketResponse {
  /** Aligned trading date used for computation (<= requested date) */
  asOfDate: string
  /** Raw indicator inputs used to compute the score */
  inputs: IndicatorData
}

export type BacktestFrequency = 'week'

export interface BacktestPoint {
  date: string // ISO date of the trading day used for the point
  totalScore: number
  signal: Signal
  price: number
}

export interface BacktestResponse {
  start: string
  end: string
  frequency: BacktestFrequency
  points: BacktestPoint[]
  cachedAt: string
}
