const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { inspectRenderedPage } = require('../scripts/render-inspect.cjs');
let chromium;
for (const name of ['playwright', 'playwright-core']) {
  let entry;
  try { entry = require.resolve(name, { paths: [process.cwd(), __dirname] }); }
  catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
  chromium = require(entry).chromium; break;
}

test('render inspection distinguishes image frame, fitted content and candidate visibility', async () => {
  assert.ok(chromium, 'Run from a project with Playwright installed');
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.setContent(`<style>body{margin:16px} #photo{width:200px;height:100px;border:2px solid;padding:4px;box-sizing:content-box;object-fit:contain} #faded{opacity:0} #clipped{width:70px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #covered{position:relative;width:100px;height:40px} #overlay{position:absolute;inset:0} #action{width:100px;height:40px} </style>
      <h1>Choose an item</h1><img id="photo" alt="Portrait" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="160"><rect width="80" height="160" fill="green"/></svg>')}">
      <div id="faded"><strong id="name">Necessary name</strong></div><p id="clipped">A deliberately long item name</p>
      <p hidden id="draft">Draft</p><div id="covered"><button id="action">Choose</button><div id="overlay"></div></div>`);
    await page.locator('#photo').evaluate(e => e.decode());
    const data = await page.evaluate(inspectRenderedPage);
    assert.equal(data.input.hoverNone, true);
    assert.equal(data.input.pointerCoarse, true);
    const photo = data.images.find(x => x.id === 'photo');
    assert.deepEqual(photo.contentBox, { width: 200, height: 100 });
    assert.deepEqual(photo.fittedSize, { width: 50, height: 100 });
    assert.equal(photo.fittedAreaFraction, 0.25);
    assert.equal(photo.width, 212);
    assert.ok(data.candidates.find(x => x.id === 'name').reasons.includes('hidden-content'));
    assert.ok(data.candidates.find(x => x.id === 'clipped').reasons.includes('clipped-or-ellipsized-content'));
    assert.equal(data.candidates.some(x => x.id === 'draft'), false);
    assert.equal(data.actions.find(x => x.id === 'action').centerReceivesPointer, false);
    assert.equal(data.actions.find(x => x.id === 'action').fullyInFirstViewport, true);
    assert.equal('passed' in data, false);
    await page.locator('#overlay').evaluate(e => e.remove());
    assert.equal((await page.evaluate(inspectRenderedPage)).actions.find(x => x.id === 'action').centerReceivesPointer, true);
  } finally { await browser.close(); }
});

test('render-inspect CLI exposes help and rejects invalid dimensions', () => {
  const script = path.resolve(__dirname, '../scripts/render-inspect.cjs');
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /--touch/);
  const invalid = spawnSync(process.execPath, [script, 'http://localhost/', '--viewport', '0x844'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.equal(invalid.stdout, '');
});
