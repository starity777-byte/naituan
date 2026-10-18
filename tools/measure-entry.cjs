// Compare cold entry against a Git baseline under the same simulated slow connection.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const baseline = process.argv[2] || '0ad549a', source = {};
  for (const file of ['index.html', 'game.js', 'splash.js', 'planner.js']) source[file] = execFileSync('git', ['show', baseline + ':' + file], { encoding: 'utf8' });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const results = [];
    for (const old of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 430, height: 900 } }), page = await context.newPage();
      await page.route(/https:\/\//, route => route.abort());
      if (old) await page.route('http://127.0.0.1:8775/**', route => {
        const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
        return source[name] ? route.fulfill({ contentType: name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8', body: source[name] }) : route.continue();
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 180, downloadThroughput: 180 * 1024, uploadThroughput: 100 * 1024 });
      const started = Date.now();
      await page.goto('http://127.0.0.1:8775/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('#splashEnter').disabled, null, { timeout: 120000 });
      results.push({ version: old ? baseline : 'working-tree', readyMs: Date.now() - started });
      console.log(JSON.stringify(results.at(-1)));
      if (!old && process.env.NAITUAN_SCREENSHOT) await page.screenshot({ path: process.env.NAITUAN_SCREENSHOT });
      await context.close();
    }
    assert.ok(results[1].readyMs < results[0].readyMs * .5, 'Cold entry should take less than half the previous time');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
