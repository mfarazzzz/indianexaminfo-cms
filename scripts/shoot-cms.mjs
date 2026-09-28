/**
 * shoot-cms.mjs — capture a CMS screen at the two proof sizes.
 *
 * Usage:  npm run shoot:cms -- /bulletin
 *         npm run shoot:cms -- /sarkari-naukri
 *         CMS_URL=https://admincms1.indianexaminfo.com npm run shoot:cms -- /dashboard
 *
 * Session: reuses .auth/cms.json created by `npm run cms:login` (gitignored).
 * When that file is absent the script still runs - but it can only show screens
 * that do not need auth, and it prints AUTH=none so the proof says so out loud.
 * A run that bounces to /login is reported as redirected, never as a screenshot.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
];

const route = process.argv[2];
if (!route || !route.startsWith('/')) {
  console.error('Usage: npm run shoot:cms -- /<route>');
  process.exit(2);
}

const BASE = (process.env.CMS_URL || 'http://localhost:5173').replace(/\/$/, '');
const AUTH_FILE = path.resolve(process.env.AUTH_FILE || '.auth/cms.json');
const outDir = path.resolve(process.env.SHOT_DIR || 'qa/screenshots');
await mkdir(outDir, { recursive: true });

const hasAuth = existsSync(AUTH_FILE);
console.log(`AUTH=${hasAuth ? '.auth/cms.json' : 'none (unauthenticated session - only public screens are meaningful)'}`);

const slug = route.replace(/[?#].*$/, '').split('/').filter(Boolean).join('-').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'root';

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 1,
      ...(hasAuth ? { storageState: AUTH_FILE } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 60_000 });
    // The SPA paints lazily; wait for the router to settle rather than the network.
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(700);
    const finalUrl = page.url();
    const title = await page.title();
    const redirected = !route.startsWith("/login") && /\/login/.test(finalUrl);
    const file = path.join(outDir, `${slug}-${vp.width}x${vp.height}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(
      `${redirected ? 'REDIRECTED-TO-LOGIN' : 'ok'} ${vp.width}x${vp.height} title="${title}" -> ${file}`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
}
