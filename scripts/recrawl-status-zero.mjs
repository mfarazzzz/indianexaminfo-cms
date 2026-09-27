/**
 * recrawl-status-zero.mjs — Re-crawl the CSV rows whose final_status was 0.
 * The original crawler recorded 0 because it could not follow a redirect that
 * carried a RELATIVE Location header. This script follows redirects MANUALLY
 * (redirect:'manual'), resolving each Location against the current URL, and
 * rewrites those rows in place. Read/write only the CSV; no DB, no code changes.
 *
 * Usage: node scripts/recrawl-status-zero.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV = resolve(__dirname, '..', 'docs', 'seo', 'gsc-crawl-2026-09-27.csv')

const HEADERS = ['url','first_status','first_location','hops','final_url','final_status','meta_refresh','canonical_on_final_page']
const MAX_HOPS = 6
const TIMEOUT = 20000

// Minimal CSV parser (no embedded commas/quotes expected in these fields).
function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length)
  const header = lines[0].split(',')
  return lines.slice(1).map((l) => {
    const cells = l.split(',')
    const row = {}
    header.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
}
function toCsv(rows) {
  return [HEADERS.join(','), ...rows.map((r) => HEADERS.map((h) => r[h] ?? '').join(','))].join('\n') + '\n'
}

// Extract <link rel="canonical"> and any <meta http-equiv="refresh"> from HTML.
function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)
  if (!m) return ''
  const href = m[0].match(/href=["']([^"']+)["']/i)
  return href ? href[1] : ''
}
function hasMetaRefresh(html) {
  return /<meta[^>]+http-equiv=["']refresh["']/i.test(html) ? 'y' : 'n'
}

async function fetchManual(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'seo-recrawl/1.0' } })
    return res
  } finally {
    clearTimeout(t)
  }
}

// Follow the redirect chain by hand; resolve relative Location against `base`.
async function crawl(startUrl) {
  let current = startUrl
  let firstStatus = ''
  let firstLocation = ''
  let hops = 0
  let finalUrl = startUrl
  let finalStatus = ''
  let meta = 'n'
  let canonical = ''

  for (let i = 0; i <= MAX_HOPS; i++) {
    let res
    try {
      res = await fetchManual(current)
    } catch (e) {
      finalStatus = '0'
      finalUrl = current
      break
    }
    // Node/undici surfaces the real 3xx status + Location under redirect:'manual'
    // (verified against production), so no opaqueredirect workaround is needed.
    const status = res.status
    const loc = res.headers.get('location') || ''

    if (i === 0) {
      firstStatus = String(status)
      firstLocation = loc
    }

    const isRedirect = status >= 300 && status < 400 && loc
    if (!isRedirect) {
      finalUrl = current
      finalStatus = String(status)
      // Read body for canonical / meta-refresh on non-redirect responses.
      try {
        const html = await res.text()
        canonical = extractCanonical(html)
        meta = hasMetaRefresh(html)
      } catch { /* body unreadable */ }
      break
    }
    // Resolve relative Location against the current URL.
    try {
      current = new URL(loc, current).toString()
    } catch {
      finalUrl = current
      finalStatus = String(status)
      break
    }
    hops++
    finalUrl = current
  }

  return {
    first_status: firstStatus,
    first_location: firstLocation,
    hops: String(hops),
    final_url: finalUrl,
    final_status: finalStatus,
    meta_refresh: meta,
    canonical_on_final_page: canonical,
  }
}

async function main() {
  const rows = parseCsv(readFileSync(CSV, 'utf8'))
  const targets = rows.filter((r) => r.final_status === '0')
  console.log(`Re-crawling ${targets.length} status-0 rows of ${rows.length} total...`)

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i]
    const out = await crawl(r.url)
    Object.assign(r, out)
    if ((i + 1) % 10 === 0 || i === targets.length - 1) {
      console.log(`  ${i + 1}/${targets.length}  ${r.url}  ->  ${out.final_status} ${out.final_url}`)
    }
  }

  // Sort back into a stable order (by url) and write.
  rows.sort((a, b) => a.url.localeCompare(b.url))
  writeFileSync(CSV, toCsv(rows), 'utf8')

  const stillZero = rows.filter((r) => r.final_status === '0').length
  console.log(`\nDone. Wrote ${CSV}`)
  console.log(`Status-0 before: ${targets.length}, after: ${stillZero}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
