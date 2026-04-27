# NASDAQ100 估值预警仪表盘技术架构

## 一、项目定位

构建一个基于多维指标的可视化仪表盘，用于评估纳斯达克100指数当前估值水平，并输出明确的投资信号（买入 / 持有 / 减仓 / 风险）。

---

## 二、技术栈

### 前端
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Recharts（图表）
- Zustand（状态管理）
- SWR（数据请求与缓存）

### 后端（轻量）
- Next.js API Routes
- Edge Runtime（可选）

### 数据源
- Yahoo Finance（基础数据）
- Financial Modeling Prep（估值数据）
- Alpha Vantage（补充）

---

## 三、系统架构

```
用户浏览器
   ↓
Next.js 前端（Dashboard UI）
   ↓
SWR / 状态管理
   ↓
Next.js API Routes
   ↓
外部数据源 API
```

---

## 四、目录结构

```
/app
  /api
    /market
      route.ts
  /dashboard
    page.tsx

/components
  ScoreGauge.tsx
  ScoreTrendChart.tsx
  FactorBreakdown.tsx
  SignalBadge.tsx

/lib
  scoring.ts
  fetcher.ts

/store
  useMarketStore.ts

/types
  indicator.ts

/utils
  normalize.ts
```

---

## 五、核心数据结构

```ts
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
```

---

## 六、核心计算模块

```ts
export function calculateScore(data: IndicatorData): ScoreResult {
  const valuationScore =
    normalize(data.pe, [10, 35]) * 0.4 +
    normalize(data.ps, [2, 10]) * 0.3 +
    normalize(data.bondYield - data.earningsYield, [-3, 2]) * 0.3

  const macroScore =
    normalize(data.bondYield, [1, 5]) * 0.6 +
    normalize(data.vix, [10, 40], true) * 0.4

  const sentimentScore = normalize(data.vix, [10, 40], true)

  const totalScore =
    valuationScore * 0.45 +
    macroScore * 0.35 +
    sentimentScore * 0.2

  return {
    valuationScore,
    macroScore,
    sentimentScore,
    totalScore,
    signal: getSignal(totalScore)
  }
}
```

---

## 七、API设计

### GET /api/market

返回：

```json
{
  "pe": 28,
  "ps": 6,
  "bondYield": 4.2,
  "vix": 15,
  "totalScore": 0.72,
  "signal": "SELL"
}
```

---

## 八、前端页面结构

### Dashboard 页面

- 顶部：当前指数 + 信号
- 中部：评分仪表盘（Gauge）
- 下部：
  - 历史趋势图
  - 分项评分

---

## 九、核心组件设计

### 1. ScoreGauge
- 展示总评分（0-100）
- 颜色渐变（绿 → 红）

### 2. ScoreTrendChart
- 折线图
- 显示历史评分变化

### 3. FactorBreakdown
- 展示估值 / 宏观 / 情绪分项

### 4. SignalBadge
- 显示 BUY / SELL 等标签

---

## 十、状态管理

使用 Zustand：

```ts
export const useMarketStore = create((set) => ({
  data: null,
  setData: (data) => set({ data })
}))
```

---

## 十一、缓存策略

- SWR 自动缓存
- API 层增加 5~15 分钟缓存
- 可使用 ISR（Incremental Static Regeneration）

---

## 十二、性能优化

- 使用 Edge Runtime 降低延迟
- 图表组件懒加载
- 数据预取（prefetch）

---

## 十三、扩展能力

- 多指数支持（标普500、道指）
- 加入 AI 解读模块
- 推送通知（高估/低估提醒）
- 回测系统

---

## 十四、部署方案

- Vercel（推荐）
- 环境变量管理 API Key

---

## 十五、未来升级方向

- 因子回测系统
- 用户自定义权重
- 多资产组合分析
- 机器学习预测模型

---

## 总结

该架构强调：

- 轻后端
- 强前端可视化
- 模块化评分体系

目标是将复杂金融指标转化为直观的投资信号。