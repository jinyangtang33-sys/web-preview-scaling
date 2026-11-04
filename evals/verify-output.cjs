// Deterministic outcome checks only. Agent decisions and claims need human review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const [id, projectArg] = process.argv.slice(2);
if (!['01', '02', '03', '04', '05', '07'].includes(id) || !projectArg) {
  console.error('Usage: node evals/verify-output.cjs 01|02|03|04|05|07 <completed-project-dir>');
  process.exit(1);
}
const project = path.resolve(projectArg);
const fixture = path.join(__dirname, 'fixtures', id);
const source = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.1, `${a} != ${b}`);

async function main() {
  if (['01', '03', '05', '07'].includes(id)) {
    for (const name of fs.readdirSync(fixture)) {
      let expected = source(path.join(fixture, name));
      if (id === '07') expected = expected.replace('联系团队', '联系我们');
      assert.equal(source(path.join(project, name)), expected, `Unexpected change in ${name}`);
    }
  }
  if (id === '07') return { case: id, passed: true, check: 'Only requested text changed' };
  let playwright;
  for (const name of ['playwright', 'playwright-core']) {
    try { playwright = require(require.resolve(name, { paths: [process.cwd(), __dirname] })); break; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  if (!playwright) throw new Error('Run from a project with Playwright or playwright-core installed');
  const browser = await playwright.chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const samples = [];
  async function read(target) {
    return target.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(img => img.decode()));
      const el = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect(), css = getComputedStyle(node);
        return { x: r.x, width: r.width, height: r.height, fontSize: parseFloat(css.fontSize),
          columns: css.gridTemplateColumns, overflowX: css.overflowX, objectFit: css.objectFit,
          clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight };
      };
      return { viewport: { width: innerWidth, height: innerHeight },
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        main: el('main'), title: el('h1'), grid: el('.places'), image: el('img'),
        table: el('.table-scroll'), columnCount: document.querySelectorAll('thead th').length };
    });
  }
  try {
    const sizes = { '01': [[1280, 800]], '02': [[1440, 900], [390, 844]],
      '03': [[959, 900], [960, 900]], '04': [[1280, 800], [390, 844]], '05': [[390, 844]] }[id];
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(project, 'page.html')).href);
      const data = await read(page);
      samples.push({ source: 'independent-headless', ...data });
      assert.equal(data.overflowX, 0);
      if (id === '01') {
        near(data.title.fontSize, 48); near(data.main.width, 1000);
        await page.goto(pathToFileURL(path.join(project, 'host.html')).href);
        const frame = page.frames().find(f => f !== page.mainFrame() && f.url().endsWith('/page.html'));
        assert.ok(frame, 'Missing simulated host iframe');
        const embedded = await read(frame);
        assert.deepEqual(embedded, data);
        samples.push({ source: 'simulated-host-iframe', ...embedded });
      } else if (id === '02') {
        if (width === 1440) { near(data.title.fontSize, 48); assert.ok(data.main.width <= 1040.1); }
        else { assert.ok(data.title.fontSize >= 32); assert.ok(data.main.width <= 358.1); }
        assert.ok(data.main.x >= 16 && width - data.main.x - data.main.width >= 15.9);
      } else if (id === '03') {
        assert.equal(data.grid.columns.split(/\s+/).length, width === 959 ? 1 : 3);
      } else if (id === '04') {
        assert.equal(data.image.naturalWidth, 800); assert.equal(data.image.naturalHeight, 400);
        near(data.image.width / data.image.height, 2);
        assert.notEqual(data.image.objectFit, 'cover');
      } else if (id === '05') {
        assert.equal(data.columnCount, 4);
        assert.ok(data.table.scrollWidth > data.table.clientWidth);
        assert.equal(data.table.overflowX, 'auto');
        const scrolled = await page.evaluate(() => {
          const table = document.querySelector('.table-scroll'); table.scrollLeft = 10000;
          return { left: table.scrollLeft,
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        assert.ok(scrolled.left > 0); assert.equal(scrolled.overflowX, 0);
        samples.at(-1).afterScroll = scrolled;
      }
      await page.close();
    }
    return { case: id, passed: true, browser: browser.version(), samples };
  } finally { await browser.close(); }
}
main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
