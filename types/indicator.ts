export interface IndicatorData {
  pe: number
  ps: number
  earningsYield: number
  bondYield: number
  vix: number
  rsi: number
  price: number
}

export interface ScoreResult {
  valuationScore: number
  macroScore: number
  sentimentScore: number
  totalScore: number
  signal: 'BUY' | 'HOLD' | 'SELL' | 'DANGER'
}

export interface MarketResponse extends IndicatorData, ScoreResult {
  cachedAt: string
}
