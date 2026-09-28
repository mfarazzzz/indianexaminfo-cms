/**
 * cms-login.mjs — one-time, by-hand login that saves a Playwright storageState.
 *
 * Usage:  npm run cms:login            (dev server on http://localhost:5173)
 *         CMS_URL=https://admincms1.indianexaminfo.com npm run cms:login
 *
 * A HEADED Chromium opens the CMS login page. The OWNER types the credentials in
 * that window. This script never reads, asks for, logs or stores a username or a
 * password: it only saves the browser session (cookies + localStorage) to
 * .auth/cms.json once the owner says the login is finished. .auth/ is gitignored.
 * Re-run whenever the session expires.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';

const BASE = (process.env.CMS_URL || 'http://localhost:5173').replace(/\/$/, '');
const AUTH_FILE = path.resolve(process.env.AUTH_FILE || '.auth/cms.json');

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'load' });

console.log(`CMS login page opened at ${BASE}/login`);
console.log('Sign in inside that browser window. No credentials are read by this script.');

const rl = createInterface({ input, output });
await rl.question('When the CMS dashboard is visible in the window, press Enter to save the session... ');
rl.close();

// Record only that a session exists - never the credential itself.
const hasSession = await page
  .evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-')))
  .catch(() => false);

await mkdir(path.dirname(AUTH_FILE), { recursive: true });
await ctx.storageState({ path: AUTH_FILE });
await browser.close();

if (!hasSession) {
  console.warn(`WARNING: no Supabase session key found in localStorage before saving ${AUTH_FILE}.`);
  console.warn('If the state file is stale, screens of protected routes will show the login page.');
}
console.log(`storageState saved -> ${AUTH_FILE}`);
