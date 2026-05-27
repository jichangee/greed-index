## Greed Index（S&P 500 贪婪/恐惧指数）

一个用 **Next.js App Router** 写的轻量级数据看板：聚合 Multpl/FRED 指标，计算综合风险分数（0~1，UI 显示为 0~100），给出低/中/高风险提示。

### 功能

- **实时/最新**：首页加载时请求 `GET /api/market`，返回估值、利率、VIX 与综合风险提示。
- **历史重放（按日期）**：`GET /api/market?date=YYYY-MM-DD`，以该日期对齐到最近一个交易日后计算指标与信号（返回输入与对齐日期）。

### 环境变量

复制示例文件并填写 Key：

```bash
cp example.env .env
```

当前用到的变量（见 `example.env`）：

- `FINNHUB_API_KEY`
- `FRED_API_KEY`
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

### 评分逻辑

综合风险评分满分 100，API 中以 `0~1` 返回，页面显示为 `0~100`：

- 席勒 CAPE：25 分，`>35` 进入高风险区间
- S&P 500 PE：15 分
- 10Y 国债利率：20 分，`>4.5%` 进入高风险区间
- 利率-股息利差：15 分，`>3%` 表示债券相对股票更有吸引力
- VIX：25 分

#### `GET /api/market`

- **用途**：获取“最新”的综合分与信号（带 5 分钟缓存）。
- **响应（稳定字段）**：
  - `totalScore`: number（0~1）
  - `signal`: `'LOW' | 'MEDIUM' | 'HIGH'`
  - `cachedAt`: string（ISO 时间）
  - `asOfDate`: string
  - `inputs`: 指标原始输入

#### `GET /api/market?date=YYYY-MM-DD`

- **用途**：按指定日期回放（会自动对齐到 `asOfDate <= date` 的交易日）。
- **额外返回**：
  - `asOfDate`: string（实际用于计算的交易日，ISO 日期）
  - `inputs`: 指标原始输入（见 `types/indicator.ts` 的 `IndicatorData`）
  - `meta.peSource`: `'multpl' | 'twelvedata_latest_fallback'`

### 目录速览

- `app/page.tsx`：首页 UI（展示估值/利率/波动率卡片、综合风险评分）
- `app/api/market/route.ts`：最新/历史重放 API
- `lib/*`：数据源与指标计算（FRED / TwelveData / Finnhub / Multpl 等）

### 免责声明

本项目仅用于学习与研究，不构成任何投资建议。数据源可能存在延迟/缺失/修订，请自行甄别与承担风险。
