type PePoint = { date: string; value: number }

const DEFAULT_URL = 'https://www.multpl.com/s-p-500-pe-ratio/table/by-month'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
let cache: { points: PePoint[]; fetchedAt: number; url: string } | null = null

function parseIsoDateOnly(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (!m) throw new Error(`Invalid date format: ${input}. Expected YYYY-MM-DD`)
  return input
}

function parseNumeric(value: string): number {
  const cleaned = value
    // Strip common HTML entities (e.g. &#x2002;) that appear in Multpl tables
    .replace(/&#x[0-9a-fA-F]+;|&#\d+;|&[a-zA-Z]+;/g, ' ')
    .replace(/†/g, '')
    .replace(/[%,$]/g, '')
    .trim()
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric value "${value}"`)
  return n
}

function parseDateFromText(s: string): string | null {
  // Accept "2026-03-28"
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // Accept "Mar 28, 2026" / "March 28, 2026"
  const m = /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/.exec(s.trim())
  if (!m) return null
  const monthName = m[1].toLowerCase()
  const day = Number(m[2])
  const year = Number(m[3])
  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  }
  const month = monthMap[monthName]
  if (!month || day < 1 || day > 31 || year < 1900 || year > 2100) return null
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function extractTableRows(html: string): string[] {
  // Best-effort: find the first <table>...</table>, then split rows.
  const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html)
  if (!tableMatch) return []
  const tableHtml = tableMatch[1]
  return tableHtml.split(/<\/tr>/i).map((r) => r.trim()).filter(Boolean)
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = []
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  let m: RegExpExecArray | null = null
  while ((m = re.exec(rowHtml))) {
    const raw = m[1]
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) cells.push(text)
  }
  return cells
}

async function fetchPePoints(url: string): Promise<PePoint[]> {
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; greed-index/1.0; +https://example.invalid) AppleWebKit/537.36 (KHTML, like Gecko)',
    },
  })
  if (!res.ok) throw new Error(`Multpl request failed: ${res.status}`)
  const html = await res.text()

  const rows = extractTableRows(html)
  const points: PePoint[] = []

  for (const row of rows) {
    const cells = extractCells(row)
    if (cells.length < 2) continue
    const dateIso = parseDateFromText(cells[0])
    if (!dateIso) continue
    try {
      const value = parseNumeric(cells[1])
      points.push({ date: dateIso, value })
    } catch {
      // ignore non-numeric rows
    }
  }

  // Fallback: some pages embed CSV-like data in scripts as ["YYYY-MM-DD",value]
  if (!points.length) {
    const re = /\[\s*["'](\d{4}-\d{2}-\d{2})["']\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*\]/g
    let m: RegExpExecArray | null = null
    while ((m = re.exec(html))) {
      points.push({ date: m[1], value: parseFloat(m[2]) })
    }
  }

  // Fallback 2: scan any <tr><td>Date</td><td>Value</td> rows across the whole document.
  if (!points.length) {
    const rowRe =
      /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
    let m: RegExpExecArray | null = null
    while ((m = rowRe.exec(html))) {
      const dateText = m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const valueText = m[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const dateIso = parseDateFromText(dateText)
      if (!dateIso) continue
      try {
        const value = parseNumeric(valueText.replace('†', '').trim())
        points.push({ date: dateIso, value })
      } catch {
        // ignore
      }
    }
  }

  const dedup = new Map<string, number>()
  for (const p of points) {
    if (!dedup.has(p.date)) dedup.set(p.date, p.value)
  }

  const sorted = Array.from(dedup.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  if (!sorted.length) {
    throw new Error(`Unable to parse PE history from Multpl page. url=${url}`)
  }
  return sorted
}

function candidateUrls(url: string): string[] {
  const u = url.trim().replace(/\/+$/, '')
  const out = [u]
  // If user provides the main page (which may require JS), fall back to the table view.
  if (!u.includes('/table/')) {
    out.push(`${u}/table/by-month`)
  }
  return Array.from(new Set(out))
}

async function getCachedPoints(url: string): Promise<PePoint[]> {
  if (cache && cache.url === url && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.points

  let lastError: unknown = null
  for (const candidate of candidateUrls(url)) {
    try {
      const points = await fetchPePoints(candidate)
      cache = { points, fetchedAt: Date.now(), url: candidate }
      return points
    } catch (e) {
      lastError = e
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch Multpl PE history')
}

export async function getNdxPeAt(dateIso: string): Promise<number> {
  const date = parseIsoDateOnly(dateIso)
  const url = process.env.MULTPL_SP500_PE_URL || process.env.MULTPL_NDX_PE_URL || DEFAULT_URL
  const points = await getCachedPoints(url)

  // points ascending; find last <= date
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].date <= date) return points[i].value
  }
  throw new Error(`No PE observation found on Multpl at or before ${dateIso}`)
}

export async function getSp500PeAt(dateIso: string): Promise<number> {
  return getNdxPeAt(dateIso)
}

