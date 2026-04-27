# NASDAQ 100 Valuation Monitor — MVP Design Spec

Date: 2026-04-27

## Overview

A minimal, single-purpose dashboard that displays a clear investment signal (BUY / HOLD / SELL / DANGER) for the NASDAQ 100 index based on multi-factor scoring. The UI is intentionally stripped to just the signal and a score gauge — nothing else.

---

## Architecture

**Pattern:** Next.js App Router + API Route with server-side in-memory cache.

**Data flow:**
```
Browser (React page)
  → GET /api/market (fetch + useState/useEffect, no SWR)
  → API Route (Next.js Route Handler)
      → In-memory cache (5-min TTL)
      → Finnhub API (on cache miss)
  → Score calculation (lib/scoring.ts)
  → JSON response to browser
```

**Dependencies to install:** None beyond what already exists. No Recharts, no Zustand, no SWR. Uses native fetch and React hooks only.

---

## Data Layer

### Finnhub endpoints (real data)

| Indicator | Finnhub endpoint | Symbol |
|---|---|---|
| QQQ price | `/quote` | `QQQ` |
| RSI (14-period) | `/indicator?indicator=rsi&resolution=D&timeperiod=14` | `QQQ` |
| VIX | `/quote` | `^VIX` |

### Mock / fixed values (free tier limitation)

| Indicator | Value | Display label |
|---|---|---|
| PE Ratio | 28 | Reference value |
| PS Ratio | 6 | Reference value |
| 10Y Treasury yield | 4.2% | Reference value |

---

## Scoring Logic

### normalize(value, [min, max], inverse?)
Linear map of `value` into [0, 1]. Values below `min` clamp to 0, above `max` clamp to 1. When `inverse=true`, result is `1 - normalized` (higher raw value → lower score).

Score of 0 = cheap / low risk. Score of 1 = expensive / high risk.

### Sub-scores

```
earningsYield = 1 / pe * 100

valuationScore =
  normalize(pe, [10, 35])                          × 0.4 +
  normalize(ps, [2, 10])                           × 0.3 +
  normalize(bondYield - earningsYield, [-3, 2])    × 0.3

macroScore =
  normalize(bondYield, [1, 5])                     × 0.6 +
  normalize(vix, [10, 40], inverse=true)           × 0.4

sentimentScore =
  normalize(rsi, [30, 80])                         × 0.6 +
  normalize(vix, [10, 40], inverse=true)           × 0.4

totalScore =
  valuationScore × 0.45 +
  macroScore     × 0.35 +
  sentimentScore × 0.20
```

### Signal thresholds

| totalScore | Signal | Color |
|---|---|---|
| < 0.35 | BUY | green |
| 0.35 – 0.55 | HOLD | blue |
| 0.55 – 0.75 | SELL | orange |
| ≥ 0.75 | DANGER | red |

---

## API

### GET /api/market

Server-side in-memory cache with 5-minute TTL. On cache hit, returns cached data immediately without calling Finnhub.

**Response:**
```json
{
  "price": 480.5,
  "pe": 28,
  "ps": 6,
  "bondYield": 4.2,
  "earningsYield": 3.57,
  "vix": 18.3,
  "rsi": 62.4,
  "valuationScore": 0.65,
  "macroScore": 0.58,
  "sentimentScore": 0.72,
  "totalScore": 0.64,
  "signal": "HOLD",
  "cachedAt": "2026-04-27T10:00:00.000Z"
}
```

**Error:** Returns `{ "error": "..." }` with appropriate HTTP status.

---

## UI

**Layout:** Single page, vertically and horizontally centered. White background (#ffffff). No header, no navigation, no data breakdown cards.

**Components:**

1. **ScoreGauge** — SVG semi-circle gauge (180° arc)
   - Renders a colored arc from left to right, filled proportional to `totalScore × 100`
   - Color gradient: green (0) → yellow (50) → red (100)
   - Displays the numeric score (0–100) in the center
   - Implemented with SVG path math, no chart library

2. **SignalBadge** — Large pill badge below the gauge
   - Text: `BUY` / `HOLD` / `SELL` / `DANGER`
   - Background color matches signal (green / blue / orange / red)
   - Font: large, bold, uppercase

**States:**
- Loading: spinner centered on page
- Error: short error message centered
- Data: gauge + badge

---

## File Structure

```
app/
  page.tsx                  — fetches /api/market, renders gauge + badge
  api/
    market/
      route.ts              — Finnhub calls, cache, score calc, JSON response

lib/
  scoring.ts                — normalize(), calculateScore(), getSignal()
  finnhub.ts                — Finnhub API fetch helpers

types/
  indicator.ts              — IndicatorData, ScoreResult interfaces
```

---

## Out of Scope (MVP)

- Historical score trend chart
- Factor breakdown cards
- Dark mode
- Zustand state management
- SWR
- Recharts
- Multiple index support
- User-configurable weights
