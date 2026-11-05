const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkResponsiveReturn } = require('../evals/check-responsive-return.cjs');
let chromium;
for (const id of ['playwright', 'playwright-core']) {
  try { chromium = require(require.resolve(id, { paths: [process.cwd(), __dirname] })).chromium; break; }
  catch (err) { if (err.code !== 'MODULE_NOT_FOUND') throw err; }
}

// Reduced reproduction: the mobile disclosure has no button on desktop.
// Replaying the old closed state there strands the filter after navigation.
const fixture = `<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media(min-width:700px){summary{display:none}}</style>
<main></main><script>
let saved = null;
function render() {
  const list = location.hash !== '#detail';
  const m = document.querySelector('main');
  m.innerHTML = list ? '<details><summary>Filters</summary><label>Type <select><option>All</option><option>Photo</option></select></label></details><output>All</output><a href="#detail">View item</a>' : '<a href="#list">Back to list</a>';
  if (!list) return;
  const d = m.querySelector('details');
  const wide = matchMedia('(min-width:700px)').matches;
  d.open = saved === null ? wide : (location.search === '?stale' ? saved : wide);
  m.querySelector('a').onclick = () => {saved = d.open};
  m.querySelector('select').onchange = e => {m.querySelector('output').textContent = e.target.value};
}
addEventListener('hashchange',render);render();
</script>`;

test('cross-width return rejects stranded controls and exercises accessible filters in both directions', async () => {
  assert.ok(chromium, 'Playwright is required');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  const narrow = { width: 390, height: 844 }, wide = { width: 844, height: 390 };
  try {
    for (const [mode, from, to] of [['stale', narrow, wide], ['fixed', narrow, wide], ['fixed', wide, narrow]]) {
      const page = await browser.newPage({ hasTouch: true });
      try {
        await page.route('http://fixture.test/**', r => r.fulfill({ contentType: 'text/html', body: fixture }));
        const check = checkResponsiveReturn(page, { from, to, touch: true,
          openList: p => p.goto('http://fixture.test/?' + mode),
          enterDetail: async p => { await p.getByText('View item').tap(); await p.getByText('Back to list').waitFor(); },
          returnToList: async p => { await p.getByText('Back to list').tap(); await p.getByText('View item').waitFor(); },
          control: p => p.getByRole('combobox', { includeHidden: true }),
          disclosure: p => p.locator('summary'),
          exercise: async (p, el) => { await el.selectOption({label:'Photo'}); assert.equal(await p.locator('output').textContent(), 'Photo'); },
        });
        if (mode === 'stale') await assert.rejects(check, /no visible disclosure/);
        else assert.equal((await check).openedDisclosure, to === narrow);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
