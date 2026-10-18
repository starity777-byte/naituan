// Browser checks for the real settlement paths. Run against the same preview as verify-loading.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
function solve(lanes, cap, caps) {
  const queue = [[lanes, []]], seen = new Set([JSON.stringify(lanes)]);
  for (const [state, moves] of queue) {
    if (state.every(lane => !lane.length)) return moves;
    for (let a = 0; a < state.length; a++) for (let b = 0; b < state.length; b++) {
      if (a === b || !state[a].length || state[b].length >= caps[b] || state[b].length && state[b][0] !== state[a][0]) continue;
      const next = state.map(lane => lane.slice()), kind = next[a].shift(); next[b].unshift(kind);
      if (next[b].length === cap && next[b].every(cat => cat === kind)) next[b] = [];
      const key = JSON.stringify(next);
      if (!seen.has(key)) { seen.add(key); queue.push([next, moves.concat([[a, b]])]); }
    }
  }
  throw new Error('No solution');
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/https:\/\//, route => route.abort());
    await page.goto(process.env.NAITUAN_PREVIEW || 'http://127.0.0.1:8775/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#splashEnter').disabled);
    await page.evaluate(() => { NT.S().welcome = 1; NT.S().acc.gift = 1; NT.S().fish = 4173; NT.save(); });
    await page.locator('#splashEnter').click(); await page.locator('#splash').waitFor({ state: 'detached' });
    const fish = () => page.evaluate(() => NT.S().fish);
    const launch = id => page.evaluate(id => document.getElementById(id).click(), id);
    for (const [score, top, reward] of [[1000, 7, 135], [3000, 10, 430], [8000, 12, 1080]]) {
      const before = await fish(); await launch('btnLion'); await page.locator('#mlGo').click();
      await page.evaluate(({ score, top }) => { const g = NaituanLion.get().game; g.score = score; g.topLevel = top; }, { score, top });
      await page.waitForFunction(n => NaituanLion.get().game.paid === n, reward);
      assert.equal(await fish() - before, reward);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('naituan-house-v1')).fish), await fish());
      assert.match(await page.locator('#mlIncome').innerText(), new RegExp('\\+' + reward));
      await page.locator('#mlQuit').click(); assert.equal(await fish() - before, reward);
    }
    const beforeMerge = await fish(); await launch('btnLion'); await page.locator('#mlGo').click();
    await page.evaluate(() => { const w = NaituanLion.get().world; w.add(0, 150, 220, 0, 0); w.add(0, 150, 220, 0, 0); });
    await page.waitForFunction(() => NaituanLion.get().game.paid > 0);
    assert.ok(await fish() > beforeMerge); await page.locator('#mlQuit').click();
    const kept = await fish(); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#splashEnter').disabled);
    assert.equal(await fish(), kept); await page.locator('#splashEnter').click(); await page.locator('#splash').waitFor({ state: 'detached' });
    console.log('PASS lion: high-level rewards, actual merge, immediate save, no duplicate payout, reload');

    const beforeCake = await fish(); await page.evaluate(() => { Math.random = () => 0; document.getElementById('btnCake').click(); });
    await page.locator('#cqLvs button').first().click();
    const level = await page.evaluate(() => NT_LEVELS[0]), moves = solve(level.variants[0].lanes, level.cap, level.caps);
    for (const [a, b] of moves) { await page.locator('.cq-lane').nth(a).click(); await page.locator('.cq-lane').nth(b).click(); }
    await page.locator('#cqWin').waitFor({ state: 'visible' }); assert.equal(await fish() - beforeCake, 35);
    await page.locator('#cqWinMenu').click(); await page.locator('#cqHome').click();
    console.log('PASS cake: first level completed for 35 fish');

    const beforeStack = await fish(); await launch('btnStack'); await page.waitForTimeout(650); await page.locator('#sgCanvas').click();
    assert.equal(await page.locator('#sgScore').innerText(), '1 层'); await page.locator('#sgQuit').click();
    assert.ok([4, 6].includes(await fish() - beforeStack));
    console.log('PASS stack: a completed floor pays 4 fish, perfect placement adds 2');

    const beforeHide = await fish(); await launch('btnHide'); await page.locator('#rhLevels [data-lv="0"]').click();
    await page.evaluate(() => { window.incomeTaps = setInterval(() => document.querySelectorAll('#slots .slot:not([hidden])').forEach(button => button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))), 80); });
    await page.waitForFunction(() => Number(document.getElementById('rhScore').textContent) > 0, null, { timeout: 10000 });
    await page.evaluate(() => clearInterval(window.incomeTaps)); await page.locator('#hsQuit').click();
    await page.locator('#rhMenu').waitFor({ state: 'visible' });
    const earned = await fish() - beforeHide; assert.ok(earned >= 2); assert.equal(await page.evaluate(() => NT.S().hs.unlocked), 1);
    await page.locator('#rhIntroQuit').click(); assert.equal(await fish() - beforeHide, earned);
    assert.deepEqual(errors, []);
    console.log('PASS hide: partial exit pays existing hits, does not unlock, and never pays twice');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
