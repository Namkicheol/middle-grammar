const assert = require('node:assert/strict');
const { chromium } = require('/Users/namgicheol/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = (process.env.BASE_URL || 'http://127.0.0.1:8784') + '/grammar-kart/';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/namgicheol/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Fullscreen behavior is verified separately in Aside; avoid headless viewport races.
  await page.addInitScript(() => { document.documentElement.requestFullscreen = () => Promise.resolve(); });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('grammar-kart-laps-v2', '3'); });
    await page.reload();
    assert.equal(await page.locator('[data-laps][aria-pressed=true]').getAttribute('data-laps'), '5');
    for (const laps of [5, 7, 9]) {
      await page.locator(`[data-laps="${laps}"]`).click();
      await page.reload();
      assert.equal(await page.locator('[data-laps][aria-pressed=true]').getAttribute('data-laps'), String(laps));
      await page.locator('#solo-start').click();
      const state = await page.evaluate(() => GrammarKartApp.race.getState());
      assert.equal(state.total, laps * 1800);
      assert.equal(state.questionLimit, laps * 3);
      await page.locator('#leave').click();
    }
    await page.evaluate(() => localStorage.clear());
    const rounds = [];
    for (let round = 0; round < 2; round++) {
      await page.evaluate(() => { window.testQuestions = []; GrammarKartApp.mount({ mode: 'solo', lesson: 'g1-l1', map: 'coastal', laps: 5, autoStart: false, onQuestion: q => testQuestions.push(q.id) }); GrammarKartApp.race.start(); });
      for (let i = 0; i < 15; i++) {
        await page.evaluate(i => GrammarKartApp.race.setProgress(Math.floor(i / 3) * 1800 + [451, 901, 1351][i % 3]), i);
        await page.waitForFunction(() => GrammarKartApp.race.question, null, { timeout: 5000 });
        await page.evaluate(() => { const race = GrammarKartApp.race; race.answer(race.question.ans); });
      }
      await page.waitForFunction(() => document.querySelector('#question')?.innerText.includes('이번 판 문제 완료'), null, { timeout: 5000 });
      const ids = await page.evaluate(() => [...testQuestions]);
      assert.equal(ids.length, 15); assert.equal(new Set(ids).size, 15);
      rounds.push(ids);
      await page.locator('#leave').click();
    }
    assert.equal(rounds[1].filter(id => rounds[0].includes(id)).length, 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('grammar-kart-seen-g1-l1')).length), 30);
    await page.evaluate(() => { GrammarKartApp.mount({ mode: 'solo', lesson: 'g2-l1', laps: 5, autoStart: false }); GrammarKartApp.race.start(); GrammarKartApp.race.setProgress(451); });
    await page.waitForFunction(() => GrammarKartApp.race.question);
    await page.locator('#leave').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('grammar-kart-seen-g2-l1')), null);
    await page.evaluate(() => { const ids = GrammarKart.getLessonQuestionIds('g1-l1'); localStorage.setItem('grammar-kart-seen-g1-l1', JSON.stringify(ids.slice(0, -1))); GrammarKartApp.mount({ mode: 'solo', lesson: 'g1-l1', laps: 5, autoStart: false }); GrammarKartApp.race.start(); GrammarKartApp.race.setProgress(451); });
    await page.waitForFunction(() => GrammarKartApp.race.question);
    const last = await page.evaluate(() => GrammarKart.getLessonQuestionIds('g1-l1').at(-1));
    assert.equal(await page.evaluate(() => GrammarKartApp.race.question.id), last);
    await page.evaluate(() => { const race = GrammarKartApp.race; race.answer(race.question.ans); });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('grammar-kart-seen-g1-l1'))), []);
    assert.match(await page.locator('#question-progress').innerText(), /단원 한 바퀴 완료 · 새 순환 0\//);
    await page.waitForTimeout(900);
    assert.match(await page.locator('#question-progress').innerText(), /단원 한 바퀴 완료 · 새 순환 0\//);
    for (const [width, height] of [[390, 667], [390, 844], [844, 390], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await page.goto(url, { waitUntil: 'networkidle' });
      const seeded = await page.evaluate(() => { const id = GrammarKart.getLessonQuestionIds('g1-l1')[0]; localStorage.setItem('grammar-kart-seen-g1-l1', JSON.stringify([id])); GrammarKartApp.mount({ mode: 'solo', lesson: 'g1-l1', map: 'coastal', laps: 7, kartDesign: 'fox', kartColor: 'cyan', autoStart: false }); GrammarKartApp.race.start(); GrammarKartApp.race.setProgress(12599); return id; });
      await page.locator('.kf-again').waitFor({ timeout: 10000 });
      assert.match(await page.locator('.kf-again').innerText(), /힐 코스에서 이어 달리기/);
      assert.match(await page.locator('.kart-finish-progress').innerText(), /단원 \d+\/.*문제 남음/);
      const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, button: document.querySelector('.kf-again').getBoundingClientRect().height }));
      assert.equal(layout.scroll, layout.width); assert.ok(layout.button >= 44);
      await page.locator('.kf-again').click();
      const next = await page.evaluate(() => ({ map: localStorage.getItem('grammar-kart-map'), total: GrammarKartApp.race.getState().total, title: document.querySelector('.race-title').innerText, options: document.querySelector('#lesson-label').innerText }));
      assert.equal(next.map, 'hill'); assert.equal(next.total, 12600); assert.match(next.title, /HILL COURSE/); assert.match(next.options, /중1 L1/);
      await page.evaluate(() => { GrammarKartApp.race.start(); GrammarKartApp.race.setProgress(451); });
      await page.waitForFunction(() => GrammarKartApp.race.question);
      assert.notEqual(await page.evaluate(() => GrammarKartApp.race.question.id), seeded);
    }
    console.log('PASS: lap selection, progress cycles, and next-map continuation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
