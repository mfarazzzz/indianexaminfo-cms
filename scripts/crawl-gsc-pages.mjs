/**
 * GSC Pages Crawler — reads gsc-pages-2026-09-27.csv, curls each URL (1/s),
 * follows up to 5 redirects, extracts status chain, meta-refresh, canonical.
 * Outputs gsc-crawl-2026-09-27.csv.
 * Run: node scripts/crawl-gsc-pages.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { request } from "https";
import { get } from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(__dirname, "../docs/seo/gsc-pages-2026-09-27.csv");
const OUTPUT = resolve(__dirname, "../docs/seo/gsc-crawl-2026-09-27.csv");

const DELAY_MS = 1000;
const MAX_HOPS = 5;
const TIMEOUT_MS = 20000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpHead(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "HEAD", timeout: TIMEOUT_MS }, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location || "" });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    get(url, { timeout: TIMEOUT_MS, headers: { "User-Agent": "Mozilla/5.0 (compatible; GSC-Crawler/1.0)" } }, (res) => {
      // Follow redirects for GET too
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        return httpGet(next).then(resolve, reject);
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body, finalUrl: url }));
    }).on("error", reject).on("timeout", function() { this.destroy(); reject(new Error("timeout")); });
  });
}

async function crawlOne(url) {
  let currentUrl = url;
  let hops = 0;
  let firstStatus = 0;
  let firstLocation = "";
  let finalStatus = 0;
  let finalUrl = url;

  // Phase 1: HEAD chain (no body)
  for (let i = 0; i <= MAX_HOPS; i++) {
    try {
      const res = await httpHead(currentUrl);
      if (i === 0) { firstStatus = res.status; firstLocation = res.location; }
      if ([301, 302, 303, 307, 308].includes(res.status) && res.location && i < MAX_HOPS) {
        hops++;
        currentUrl = new URL(res.location, currentUrl).href;
        continue;
      }
      finalStatus = res.status;
      finalUrl = currentUrl;
      break;
    } catch (e) {
      finalStatus = 0; // error
      finalUrl = currentUrl;
      break;
    }
  }

  // Phase 2: GET final page to check meta-refresh and canonical
  let metaRefresh = "n";
  let canonical = "";
  try {
    const page = await httpGet(url);
    finalStatus = page.status;
    finalUrl = page.finalUrl;
    const body = page.body;
    if (/<meta[^>]*http-equiv\s*=\s*["']refresh["']/i.test(body)) metaRefresh = "y";
    const cMatch = body.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i) 
                || body.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i);
    canonical = cMatch ? cMatch[1] : "";
  } catch (e) { /* keep defaults */ }

  return { url, firstStatus, firstLocation, hops, finalUrl, finalStatus, metaRefresh, canonical };
}

async function main() {
  const raw = readFileSync(INPUT, "utf8").trim();
  const lines = raw.split("\n");
  const header = lines[0]; // url,host,path,clicks,impressions,ctr,position
  const urls = lines.slice(1).map(l => {
    const commaIdx = l.indexOf(",");
    return commaIdx > 0 ? l.slice(0, commaIdx) : l;
  });

  console.log(`Crawling ${urls.length} URLs at 1/s...`);
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const r = await crawlOne(urls[i]);
    results.push(r);
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${urls.length} done`);
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  // Write output CSV
  const outHeader = "url,first_status,first_location,hops,final_url,final_status,meta_refresh,canonical_on_final_page";
  const outLines = results.map(r => {
    const loc = r.firstLocation.includes(",") ? `"${r.firstLocation}"` : r.firstLocation;
    const fu = r.finalUrl.includes(",") ? `"${r.finalUrl}"` : r.finalUrl;
    const can = r.canonical.includes(",") ? `"${r.canonical}"` : r.canonical;
    return `${r.url},${r.firstStatus},${loc},${r.hops},${fu},${r.finalStatus},${r.metaRefresh},${can}`;
  });
  writeFileSync(OUTPUT, [outHeader, ...outLines].join("\n") + "\n", "utf8");

  // Summary
  const byStatus = {};
  const notFound = [];
  const multiHop = [];
  const metaRefreshPages = [];
  const canonicalMismatch = [];
  const apex200 = [];

  for (const r of results) {
    byStatus[r.finalStatus] = (byStatus[r.finalStatus] || 0) + 1;
    if (r.finalStatus === 404) notFound.push(r.url);
    if (r.hops > 1) multiHop.push(`${r.url} → ${r.finalUrl} (${r.hops} hops)`);
    if (r.metaRefresh === "y") metaRefreshPages.push(r.url);
    if (r.canonical && r.canonical !== r.finalUrl) canonicalMismatch.push(`${r.url} canonical=${r.canonical}`);
    if (r.url.startsWith("https://indianexaminfo.com") && r.finalStatus === 200) apex200.push(r.url);
  }

  console.log("\n═══ SUMMARY ═══");
  console.log("Final status counts:", byStatus);
  console.log(`404 pages (${notFound.length}):`); notFound.forEach(u => console.log("  " + u));
  console.log(`Multi-hop chains >1 (${multiHop.length}):`); multiHop.forEach(s => console.log("  " + s));
  console.log(`Meta-refresh pages (${metaRefreshPages.length}):`); metaRefreshPages.forEach(u => console.log("  " + u));
  console.log(`Canonical mismatches (${canonicalMismatch.length}):`); canonicalMismatch.forEach(s => console.log("  " + s));
  console.log(`Apex URLs returning 200 (${apex200.length}):`); apex200.forEach(u => console.log("  " + u));
  console.log(`\nOutput written to ${OUTPUT}`);
}

main().catch(console.error);
