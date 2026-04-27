export interface IndicatorData {
  pe: number
  earningsYield: number
  bondYield: number
  vix: number
  rsi: number
  stochastic: number
  weekPosition52: number
  price: number
}

export type Signal = 'BUY' | 'HOLD' | 'SELL' | 'DANGER'

// Convenience type used by UI components.
export interface ScoreResult {
  totalScore: number
  signal: Signal
}

export interface MarketResponse {
  totalScore: number
  signal: Signal
  cachedAt: string
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
