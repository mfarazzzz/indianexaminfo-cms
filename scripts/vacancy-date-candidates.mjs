/**
 * vacancy-date-candidates.mjs — Parse sarkari_naukri description HTML for dates.
 * Read-only. Writes docs/seo/vacancy-date-candidates.csv. No DB changes.
 * Usage: node scripts/vacancy-date-candidates.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cwbhhcqsrbuoybeaondk.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YmhoY3FzcmJ1b3liZWFvbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjQ1MzgsImV4cCI6MjA5ODU0MDUzOH0.XUqU4JbWATEaxpxvP9IeLmQL0gQWlDC-jSakGObWBXU'

const MONTHS_EN = {
  'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
  'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
  'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
  'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
}
const MONTHS_HI = {
  'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
  'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'दिसंबर': 12,
  'दिसम्बर': 12,
}

// Label patterns for each date type
const NOTIF_LABELS = /notification\s*date|नोटिफिकेशन\s*डेट|अधिसूचना\s*दिन|notify\s*date|no[\s.]*date/i
const START_LABELS = /application\s*start|apply\s*from|start\s*date|आवेदन\s*शुभ|शुरु.*तारीख|प्रारंभ.*दिनांक|开始日期/i
const END_LABELS = /last\s*date|application\s*(end|close)|deadline|final\s*date|आवेदन\s*की\s*अंतिम|अंतिम\s*तारीख|अंतिम\s*दिनांक|समय\s*अंतिम|अन्तिम/i

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#38;/g, '&').replace(/\s+/g, ' ').trim()
}

function parseDateStr(s) {
  // "July 31, 2026" or "31 July 2026"
  let m = s.match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/)
  if (m) {
    const mon = MONTHS_EN[m[2].toLowerCase()] || MONTHS_HI[m[2]]
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  m = s.match(/([A-Za-z]+)\s*(\d{1,2}),?\s*(\d{4})/)
  if (m) {
    const mon = MONTHS_EN[m[1].toLowerCase()] || MONTHS_HI[m[1]]
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  }
  // "31/07/2026" or "31-07-2026"
  m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  // "2026-07-31"
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return m[0]
  // Hindi: "31 जुलाई 2026"
  m = s.match(/(\d{1,2})\s+([\u0900-\u097F]+)\s+(\d{4})/)
  if (m) {
    const mon = MONTHS_HI[m[2]]
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  return null
}

function findDateNearLabel(text, labelPattern) {
  const labelMatch = labelPattern.exec(text)
  if (!labelMatch) return { date: null, snippet: '' }
  // Search within 120 chars after the label
  const window = text.slice(labelMatch.index, labelMatch.index + 120)
  const date = parseDateStr(window)
  return { date, snippet: window.slice(0, 100).trim() }
}

// Load GSC CSV
const gscPath = resolve(ROOT, 'docs/seo/gsc-pages-2026-09-27.csv')
const gscMap = new Map() // slug -> { clicks, impressions }
try {
  const csv = readFileSync(gscPath, 'utf-8')
  for (const line of csv.split('\n').slice(1)) {
    const parts = line.split(',')
    const url = (parts[0] || '').trim()
    const clicks = parseInt(parts[3]) || 0
    const impressions = parseInt(parts[4]) || 0
    const slug = extractSlug(url)
    if (slug) {
      const existing = gscMap.get(slug) || { clicks: 0, impressions: 0 }
      existing.clicks += clicks
      existing.impressions += impressions
      gscMap.set(slug, existing)
    }
  }
} catch { console.log('GSC CSV not found; using 0 for all') }

function extractSlug(url) {
  if (!url) return null
  // Multi-segment: /sarkari-naukri/latest-jobs/{slug} → last segment
  const sarkariMulti = url.match(/\/sarkari-naukri\/[a-z-]+\/([a-z0-9-]+)/)
  if (sarkariMulti) return sarkariMulti[1]
  // Single-segment: /sarkari-naukri/{slug}
  const sarkariSingle = url.match(/\/sarkari-naukri\/([a-z0-9-]+)\/?$/)
  if (sarkariSingle) return sarkariSingle[1]
  // /exam/{slug}/...
  const examMatch = url.match(/\/exam\/([a-z0-9-]+)/)
  if (examMatch) return examMatch[1]
  return null
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Fetch all sarkari_naukri rows (slug, title, description, and existing date columns)
  const rows = []
  let offset = 0
  const BATCH = 500
  while (true) {
    const { data, error } = await supabase
      .from('sarkari_naukri')
      .select('slug, title, description, notification_date, application_start_date, application_end_date')
      .range(offset, offset + BATCH - 1)
      .order('slug')
    if (error) { console.error('Fetch error:', error.message); break }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < BATCH) break
    offset += BATCH
  }
  console.log(`Fetched ${rows.length} sarkari_naukri rows`)

  const results = rows.map((r) => {
    const text = stripHtml(r.description || '')
    const notif = findDateNearLabel(text, NOTIF_LABELS)
    const start = findDateNearLabel(text, START_LABELS)
    const end = findDateNearLabel(text, END_LABELS)
    const gsc = gscMap.get(r.slug) || { clicks: 0, impressions: 0 }
    const confidence = [notif.date, start.date, end.date].filter(Boolean).length
    return {
      slug: r.slug,
      title: r.title || '',
      gsc_clicks: gsc.clicks,
      gsc_impressions: gsc.impressions,
      parsed_notification: notif.date || '',
      parsed_start: start.date || '',
      parsed_end: end.date || '',
      snippet_notification: notif.snippet || '',
      snippet_start: start.snippet || '',
      snippet_end: end.snippet || '',
      confidence: confidence >= 2 ? 'exact label match' : confidence === 1 ? 'inferred' : 'none',
    }
  })

  // Sort by gsc_clicks desc
  results.sort((a, b) => b.gsc_clicks - a.gsc_clicks)

  // Write CSV
  const header = 'slug,title,gsc_clicks,gsc_impressions,parsed_notification,parsed_start,parsed_end,confidence,snippet_notification,snippet_start,snippet_end'
  const csvLines = [header, ...results.map(r => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`
    return [r.slug, esc(r.title), r.gsc_clicks, r.gsc_impressions, r.parsed_notification, r.parsed_start, r.parsed_end, r.confidence, esc(r.snippet_notification), esc(r.snippet_start), esc(r.snippet_end)].join(',')
  })]
  const outPath = resolve(ROOT, 'docs/seo/vacancy-date-candidates.csv')
  writeFileSync(outPath, csvLines.join('\n'), 'utf-8')
  console.log(`Wrote ${results.length} rows to ${outPath}`)

  // Summary
  const parsed = results.filter(r => r.parsed_end || r.parsed_start)
  console.log(`\nSummary: ${parsed.length}/${results.length} have at least one parsed date`)
  console.log(`Top 20 by GSC clicks:`)
  results.slice(0, 20).forEach((r, i) => console.log(`  ${i + 1}. ${r.slug} (${r.gsc_clicks}c): end=${r.parsed_end || '—'} start=${r.parsed_start || '—'}`))
}

main().catch(console.error)
