// Run against a local static preview. Set PLAYWRIGHT_PATH if Playwright is not on Node's module path.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.NAITUAN_PREVIEW || 'http://127.0.0.1:8775/';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function fixture() {
    const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => {
      if (request.url().startsWith(base) && /\.(js|css)(?:\?|$)/.test(request.url())) console.log('COMPONENT_REQUEST_FAILED', request.url(), request.failure()?.errorText);
    });
    await page.route(/https:\/\//, route => route.abort()); // Fonts/statistics are optional.
    return { context, page, errors };
  }
  async function ready(page) {
    await page.waitForFunction(() => !document.querySelector('#splashEnter').disabled, null, { timeout: 30000 }).catch(async error => {
      console.log('STARTUP', await page.locator('#splash').innerText(), await page.evaluate(() => NaituanAssets.status()));
      throw error;
    });
    assert.match(await page.locator('#splashStatus').innerText(), /准备好了/);
  }
  async function enter(page) {
    await ready(page);
    await page.locator('#splashEnter').click();
    await page.locator('#splash').waitFor({ state: 'detached' });
  }
  try {
    // Cold start prepares usable sprites; a second visit survives failed media network requests.
    {
      const { context, page, errors } = await fixture();
      const earlyAnimations = [];
      const onRequest = request => { if (request.url().includes('/animated/')) earlyAnimations.push(request.url()); };
      page.on('request', onRequest);
      const start = Date.now();
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await ready(page);
      assert.deepEqual(earlyAnimations, [], 'Full animations must not compete with first entry');
      console.log('ENTRY_READY_MS', Date.now() - start, 'ANIMATIONS_BEFORE_ENTRY', earlyAnimations.length);
      page.off('request', onRequest);
      await enter(page);
      await page.locator('#quickFeed').click();
      assert.equal(await page.locator('#cat').getAttribute('data-pose'), 'fish');
      await page.waitForFunction(() => NaituanBGM.status().playing);
      await page.waitForFunction(() => document.querySelector('#cat').dataset.pose === 'fish' && document.querySelector('#catimg').dataset.render === 'animated');
      await page.waitForFunction(() => NT.S().welcome);
      const before = await page.evaluate(() => { NT.S().fish = 731; NT.S().hunger = 72; NT.S().acc.gift = 1; NT.save(); return NT.S().fish; });
      // Wait until asynchronous cache writes have completed, rather than treating a render as disk proof.
      await page.waitForFunction(async () => {
        const names = await caches.keys(); const store = await caches.open(names.find(n => n.startsWith('naituan-media-')));
        return (await store.keys()).filter(r => /\/assets\/(sit|happy|fish)\.webp/.test(r.url)).length === 3;
      });
      let mediaAttempts = 0;
      await page.route('**/assets/animated/**', route => {
        // The study planner has its own decorative image outside the managed home animation path.
        if (!new URL(route.request().url()).searchParams.has('nv')) return route.continue();
        mediaAttempts++; return route.abort();
      });
      await page.route('**/assets/music/**', route => { mediaAttempts++; return route.abort(); });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enter(page);
      assert.equal(await page.evaluate(() => NT.S().fish), before);
      await page.locator('#quickFeed').click();
      assert.equal(await page.locator('#cat').getAttribute('data-pose'), 'fish');
      await page.waitForFunction(() => NaituanBGM.status().playing);
      assert.equal(mediaAttempts, 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: process.env.NAITUAN_SCREENSHOT || 'loading-preview.png' });
      await context.close();
      console.log('PASS cold start, persistent cache, music, old save');
    }
    // A missing non-core animation must receive its whole display time after the download.
    {
      const { context, page, errors } = await fixture();
      let release, requested;
      const arrived = new Promise(resolve => { requested = resolve; });
      const held = new Promise(resolve => { release = resolve; });
      await page.route('**/assets/animated/**', async route => {
        if (decodeURI(route.request().url()).includes('打滚笑.webp')) { requested(); await held; }
        await route.continue();
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await enter(page);
      await page.evaluate(() => { NT.S().welcome = 1; NT.S().acc.gift = 1; NT.setPose('roll', 1800); NT.say('等待动作下载', 1800); });
      await arrived;
      await page.waitForFunction(() => /仍在下载|连接较慢/.test(document.querySelector('#resourceMessage').textContent), null, { timeout: 10000 }).catch(async error => {
        console.log('SLOW', await page.evaluate(() => ({ loading: NaituanAssets.status(), pose: document.querySelector('#cat').dataset.pose, errors: document.querySelector('#splashDetail')?.textContent })));
        throw error;
      });
      assert.equal(await page.locator('#cat').getAttribute('data-pose'), 'roll');
      assert.equal(await page.locator('#catimg').getAttribute('data-render'), 'still');
      assert.match(await page.locator('#resourceMessage').innerText(), /仍在下载|连接较慢/);
      release();
      await page.waitForFunction(() => document.querySelector('#cat').dataset.pose === 'roll' && document.querySelector('#catimg').dataset.render === 'animated');
      await page.waitForTimeout(800);
      assert.equal(await page.locator('#cat').getAttribute('data-pose'), 'roll');
      await page.waitForFunction(() => document.querySelector('#cat').dataset.pose !== 'roll');
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS slow pose starts its timer after the image is ready');
    }
    // Distinguish known website errors from a connection failure; retry must recover without clearing saves.
    for (const problem of [404, 503, 'connection']) {
      const { context, page, errors } = await fixture();
      let broken = true;
      await page.route('**/assets/fish.webp*', route => {
        if (!broken) return route.continue();
        return problem === 'connection' ? route.abort('failed') : route.fulfill({ status: problem, body: 'unavailable' });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('#splashRetry').hidden);
      assert.equal(await page.locator('#splashEnter').isDisabled(), true);
      const text = await page.locator('#splashDetail').innerText();
      assert.match(text, problem === 404 ? /网站有资源缺失/ : problem === 503 ? /网站资源服务暂时异常/ : /无法判断是网络还是网站/);
      broken = false;
      await page.locator('#splashRetry').click();
      await enter(page);
      assert.deepEqual(errors, []);
      await context.setOffline(true);
      await page.waitForFunction(() => document.querySelector('#resourceMessage').textContent.includes('设备已离线'));
      await context.setOffline(false);
      await page.waitForFunction(() => !document.querySelector('#resourceMessage').textContent.includes('设备已离线'));
      await context.close();
      console.log('PASS diagnosis and retry:', problem);
    }
    // An application exception should never be blamed on the visitor's network.
    {
      const { context, page } = await fixture();
      await page.route('**/game.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("simulated startup bug")' }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#splashDetail').textContent.includes('需要作者修复页面'));
      assert.equal(await page.locator('#splashEnter').isDisabled(), true);
      await context.close();
      console.log('PASS page exception distinguished from network problems');
    }
    {
      const { context, page } = await fixture();
      await page.route('**/splash.js*', route => route.abort());
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#resourceNotice').waitFor({ state: 'visible' });
      assert.match(await page.locator('#resourceMessage').innerText(), /页面组件加载失败/);
      assert.equal(await page.locator('#resourceRetry').innerText(), '重新打开');
      await context.close();
      console.log('PASS startup script failure leaves a visible recovery action');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
