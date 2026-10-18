// Cold/cached entry and first-perfect feedback, including a deliberately delayed animation.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = process.env.NAITUAN_PREVIEW || 'http://127.0.0.1:8775/';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let failed = false;
  async function check(name, run) {
    try { await run(); console.log('PASS', name); }
    catch (error) { failed = true; console.error('FAIL', name, error.message); }
  }
  async function fixture(heldHappy) {
    const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/https:\/\//, route => route.abort());
    await page.route('**/game.js*', async route => {
      const source = process.env.NAITUAN_BASELINE ? execFileSync('git', ['show', process.env.NAITUAN_BASELINE + ':game.js'], { encoding: 'utf8' }) : await (await route.fetch()).text();
      // Expose the existing state only in this isolated test response, for a precisely aligned box.
      await route.fulfill({ contentType: 'application/javascript', body: source.replace('window.NT = {', 'window.NT = { __stackForTest: function () { return SG; },') });
    });
    if (heldHappy) await page.route('**/assets/animated/**', async route => {
      if (decodeURI(route.request().url()).includes('开心.webp')) await heldHappy;
      await route.continue();
    });
    async function open() {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('#splashEnter').disabled);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-room-source]')].every(img => img.complete && img.naturalWidth > 0));
      await page.evaluate(() => { NT.S().welcome = 1; NT.S().acc.gift = 1; NT.S().bgm = false; NaituanBGM.configure({ enabled: false }); NT.save(); });
    }
    return { context, page, errors, open };
  }
  try {
    {
      let release;
      const hold = new Promise(resolve => { release = resolve; });
      const { context, page, errors, open } = await fixture(hold);
      try {
        await open();
        await check('poster uses the same canvas as the full animation', async () => {
          const size = await page.locator('#catimg').evaluate(img => [img.naturalWidth, img.naturalHeight]);
          assert.deepEqual(size, [503, 402]);
        });
        for (const cached of [false, true]) {
          if (cached) await open();
          await page.locator('#splashEnter').click(); await page.locator('#splash').waitFor({ state: 'detached' });
          await check((cached ? 'cached' : 'cold') + ' entry enables real mouse dragging', async () => {
            const before = await page.locator('#catbox').boundingBox();
            await page.mouse.move(before.x + before.width / 2, before.y + before.height * .55);
            await page.mouse.down();
            await page.mouse.move(before.x + before.width / 2 + 55, before.y + before.height * .55 - 15, { steps: 5 });
            await page.mouse.up();
            const after = await page.locator('#catbox').boundingBox();
            assert.ok(Math.abs(after.x - before.x) > 20, 'Cat did not move');
            assert.ok(await page.evaluate(() => !!NT.S().catPosition), 'Position was not saved');
          });
        }
        release(); assert.deepEqual(errors, []);
      } finally { release(); await context.close(); }
    }
    {
      let release;
      const hold = new Promise(resolve => { release = resolve; });
      const { context, page, errors, open } = await fixture(hold);
      try {
        await open(); await page.locator('#splashEnter').click(); await page.locator('#splash').waitFor({ state: 'detached' });
        await page.evaluate(() => document.getElementById('btnStack').click());
        await page.evaluate(() => {
          const stack = NT.__stackForTest(); stack.m.x = stack.tower[stack.tower.length - 1].x;
          document.getElementById('sgCanvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        });
        await check('perfect text is inside the stack game and visible above its canvas', async () => {
          assert.equal(await page.locator('#sg .fx.txt').innerText({ timeout: 2000 }), '完美！');
          const visible = await page.locator('#sg .fx.txt').evaluate(el => {
            const r = el.getBoundingClientRect(); el.style.pointerEvents = 'auto';
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            el.style.pointerEvents = ''; return top === el;
          });
          assert.equal(visible, true);
          if (process.env.NAITUAN_SCREENSHOT) { await page.waitForTimeout(180); await page.screenshot({ path: process.env.NAITUAN_SCREENSHOT }); }
        });
        await check('first perfect has immediate feedback and plays after a slow animation arrives', async () => {
          await page.waitForTimeout(1000);
          assert.equal(await page.locator('#sgCat').getAttribute('data-pose'), 'happy');
          assert.equal(await page.locator('#sgCat').getAttribute('data-render'), 'still');
          release();
          await page.waitForFunction(() => document.querySelector('#sgCat').dataset.render === 'animated' && document.querySelector('#sgCat').dataset.pose === 'happy');
          await page.waitForTimeout(250);
          assert.equal(await page.locator('#sgCat').getAttribute('data-pose'), 'happy');
          await page.waitForFunction(() => document.querySelector('#sgCat').dataset.pose === 'sit');
        });
        assert.deepEqual(errors, []);
      } finally { release(); await context.close(); }
    }
    if (failed) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
