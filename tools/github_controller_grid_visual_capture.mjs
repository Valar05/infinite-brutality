#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {
    url: '',
    outDir: 'generated/cloud-visual-evidence/controller-grid/github-actions',
    jobId: 'github_actions_controller_grid_visual_qa',
    timeoutMs: 180000,
    settleMs: 500,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') args.url = argv[++i] || '';
    else if (arg.startsWith('--url=')) args.url = arg.slice('--url='.length);
    else if (arg === '--out-dir') args.outDir = argv[++i] || '';
    else if (arg === '--job-id') args.jobId = argv[++i] || '';
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i] || args.timeoutMs);
    else if (arg === '--settle-ms') args.settleMs = Number(argv[++i] || args.settleMs);
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: node tools/github_controller_grid_visual_capture.mjs --url HOSTED_URL [--out-dir DIR]');
      process.exit(0);
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }

  if (!args.url) throw new Error('--url with an exact hosted URL is required');
  const parsed = new URL(args.url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('hosted URL must use http or https');
  if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error('local URLs are forbidden for cloud visual QA');
  if (!args.outDir) throw new Error('--out-dir is required');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('--timeout-ms must be positive');
  return args;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function browserLaunchOptions() {
  const channel = process.env.PLAYWRIGHT_CHROME_CHANNEL || 'chrome';
  return {
    channel,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  };
}

async function inspectSurface(page) {
  return page.evaluate(() => {
    const status = document.querySelector('#status')?.textContent?.trim() || '';
    const canvas = document.querySelector('canvas');
    const bounds = canvas?.getBoundingClientRect();
    return {
      url: location.href,
      title: document.title,
      status,
      canvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        bounds: [bounds.left, bounds.top, bounds.right, bounds.bottom].map((value) => Math.round(value)),
      } : null,
    };
  });
}

function requireReadySurface(surface, label) {
  const status = surface?.status?.toLowerCase() || '';
  if (!status || status.includes('booting') || !status.includes('controller kata')) {
    throw new Error(`${label} status is not controller-kata ready: ${surface?.status || '<missing>'}`);
  }
  const canvas = surface?.canvas;
  if (!canvas || canvas.width <= 0 || canvas.height <= 0 || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
    throw new Error(`${label} canvas has zero size`);
  }
}

const args = parseArgs(process.argv);
const outDir = path.resolve(args.outDir);
await fs.mkdir(outDir, { recursive: true });

const launchOptions = browserLaunchOptions();
const consoleEvents = [];
const pageErrors = [];
const networkFailures = [];
const responseErrors = [];
let browser = null;
let page = null;
let fatalError = '';
let initialSurface = null;
let finalSurface = null;
let initialScreenshot = null;
let inputScreenshot = null;
let inputHeld = false;

try {
  browser = await chromium.launch(launchOptions);
  page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(args.timeoutMs);
  page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text().slice(0, 1000) }));
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 1000)));
  page.on('requestfailed', (request) => networkFailures.push({ url: request.url(), failure: request.failure()?.errorText || '' }));
  page.on('response', (response) => {
    if (response.status() >= 400) responseErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForFunction(() => {
    const status = document.querySelector('#status')?.textContent?.trim().toLowerCase() || '';
    return status && !status.includes('booting') && status.includes('controller kata');
  }, null, { timeout: args.timeoutMs });
  await page.waitForTimeout(Math.max(0, Math.min(args.settleMs, 30000)));

  initialSurface = await inspectSurface(page);
  requireReadySurface(initialSurface, 'initial');
  const initialPath = path.join(outDir, 'initial-hosted.png');
  const initialBytes = await page.screenshot({ path: initialPath, fullPage: false });
  initialScreenshot = { file: path.basename(initialPath), sha256: sha256(initialBytes) };

  await page.keyboard.down('w');
  inputHeld = true;
  await page.waitForTimeout(850);
  await page.keyboard.press('Space');
  await page.waitForTimeout(650);
  await page.keyboard.up('w');
  inputHeld = false;
  await page.waitForTimeout(350);

  finalSurface = await inspectSurface(page);
  requireReadySurface(finalSurface, 'after-input');
  const inputPath = path.join(outDir, 'after-keyboard-input.png');
  const inputBytes = await page.screenshot({ path: inputPath, fullPage: false });
  inputScreenshot = { file: path.basename(inputPath), sha256: sha256(inputBytes) };

  if (initialScreenshot.sha256 === inputScreenshot.sha256) {
    throw new Error('initial and after-input screenshots are byte-identical');
  }
} catch (error) {
  fatalError = String(error?.stack || error?.message || error).slice(0, 4000);
} finally {
  if (inputHeld && page) {
    try { await page.keyboard.up('w'); } catch {}
  }
}

const consoleErrors = consoleEvents.filter((event) => event.type === 'error');
const errors = {
  fatal: fatalError,
  console: consoleErrors,
  page: pageErrors,
  network: networkFailures,
  responses: responseErrors,
};
const ok = !fatalError && !consoleErrors.length && !pageErrors.length && !networkFailures.length && !responseErrors.length;
const manifest = {
  schema: 'controller-grid-cloud-visual-evidence-v1',
  target: 'product-one-controller-grid',
  captureKind: 'cloud-hosted-keyboard-proof',
  jobId: args.jobId,
  capturedAt: new Date().toISOString(),
  startUrl: args.url,
  finalUrl: page?.url() || '',
  statuses: {
    initial: initialSurface?.status || '',
    afterKeyboardInput: finalSurface?.status || '',
  },
  screenshots: {
    initial: initialScreenshot,
    afterKeyboardInput: inputScreenshot,
  },
  inputExercise: {
    forwardKey: 'w',
    jumpKey: 'Space',
    forwardHoldMs: 1500,
  },
  surface: {
    runtime: 'github-actions-playwright',
    browser: 'system-chrome',
    channel: launchOptions.channel,
    viewport: { width: 1366, height: 900 },
    initial: initialSurface,
    afterKeyboardInput: finalSurface,
  },
  consoleEvents,
  errors,
  ok,
};
const manifestPath = path.join(outDir, 'visual_qa_manifest.json');
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

if (browser) await browser.close();

if (!ok) {
  console.error(JSON.stringify({ ok: false, manifest: manifestPath, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, manifest: manifestPath, screenshots: manifest.screenshots }, null, 2));
}
