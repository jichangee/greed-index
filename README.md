## Greed Index（S&P 500 贪婪/恐惧指数）

一个用 **Next.js App Router** 写的轻量级页面：聚合多数据源指标，计算综合分数（0~1，UI 显示为 0~100），给出 `BUY/HOLD/SELL/DANGER` 信号，并支持近 52 周的**周频回测曲线**。

### 功能

- **实时/最新**：首页加载时请求 `GET /api/market`，返回当前综合分与信号。
- **历史重放（按日期）**：`GET /api/market?date=YYYY-MM-DD`，以该日期对齐到最近一个交易日后计算指标与信号（返回输入与对齐日期）。
- **回测（周频）**：`GET /api/backtest?start=YYYY-MM-DD&end=YYYY-MM-DD`，返回区间内每个 ISO 周最后一个交易日的点位（用于绘制分数与价格曲线）。

### 环境变量

复制示例文件并填写 Key：

```bash
cp example.env .env
```

当前用到的变量（见 `example.env`）：

- `FINNHUB_API_KEY`
- `FRED_API_KEY`
- `FMP_API_KEY`
- `TWELVE_DATA_API_KEY`

### 快速开始（pnpm）

安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。

### 常用命令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

### API 说明

#### `GET /api/market`

- **用途**：获取“最新”的综合分与信号（带 5 分钟缓存）。
- **响应（稳定字段）**：
  - `totalScore`: number（0~1）
  - `signal`: `'BUY' | 'HOLD' | 'SELL' | 'DANGER'`
  - `cachedAt`: string（ISO 时间）

#### `GET /api/market?date=YYYY-MM-DD`

- **用途**：按指定日期回放（会自动对齐到 `asOfDate <= date` 的交易日）。
- **额外返回**：
  - `asOfDate`: string（实际用于计算的交易日，ISO 日期）
  - `inputs`: 指标原始输入（见 `types/indicator.ts` 的 `IndicatorData`）
  - `meta.peSource`: `'multpl' | 'twelvedata_latest_fallback'`

#### `GET /api/backtest?start=YYYY-MM-DD&end=YYYY-MM-DD`

- **用途**：计算回测序列（目前固定周频）。
- **响应**：
  - `start`, `end`: string（ISO 日期）
  - `frequency`: `'week'`
  - `points`: `{ date, totalScore, signal, price }[]`
  - `cachedAt`: string（ISO 时间）

### 目录速览

- `app/page.tsx`：首页 UI（展示分数、信号、回测开关）
- `app/api/market/route.ts`：最新/历史重放 API
- `app/api/backtest/route.ts`：回测 API
- `components/BacktestChart.tsx`：回测图（分数曲线 + 价格曲线）
- `lib/*`：数据源与指标计算（FRED / TwelveData / Finnhub / Multpl 等）

### 免责声明

本项目仅用于学习与研究，不构成任何投资建议。数据源可能存在延迟/缺失/修订，请自行甄别与承担风险。
