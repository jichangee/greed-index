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

export interface MarketResponse {
  totalScore: number
  signal: Signal
  cachedAt: string
}
