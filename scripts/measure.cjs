// Run from the target project so its existing Playwright installation is used.
const { mkdir, mkdtemp } = require('node:fs/promises');
const path = require('node:path');
const { parseArgs } = require('node:util');

const usage = `node measure.cjs URL --viewport 1440x900 [--viewport 390x844]
    [--selector "main"] [--selector "h1"] [--ready CSS] [--channel chrome] [--screenshots DIR] [--touch]
Requires Node 18+ and playwright or playwright-core. Sizes are CSS pixels.`;

function loadChromium() {
  for (const name of ['playwright', 'playwright-core']) {
    let entry;
    try {
      entry = require.resolve(name, { paths: [process.cwd(), __dirname] });
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') continue;
      throw error;
    }
    return require(entry).chromium;
  }
  throw new Error('Run from a project with playwright or playwright-core installed, or use its existing browser tool to measure manually.');
}

function parseViewport(value) {
  const dimensions = /^(\d{1,5})x(\d{1,5})$/.exec(value);
  if (!dimensions || +dimensions[1] < 1 || +dimensions[2] < 1) {
    throw new Error('Expected a positive WIDTHxHEIGHT in CSS pixels, got ' + value);
  }
  return { width: Number(dimensions[1]), height: Number(dimensions[2]) };
}

// This callback reads the page after navigation. It does not inject an overlay.
function measure(selectors) {
  const root = document.documentElement;
  const elements = selectors.map(selector => {
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) return { selector, matches: matches.length };
    const element = matches[0];
    const box = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    let effectiveOpacity = 1;
    let ancestorDisplayNone = false;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      effectiveOpacity *= Number(style.opacity);
      if (ancestor !== element && style.display === 'none') ancestorDisplayNone = true;
    }
    return {
      selector, matches: 1, width: box.width, height: box.height,
      fontSize: css.fontSize, display: css.display, gridTemplateColumns: css.gridTemplateColumns,
      visibility: css.visibility, opacity: Number(css.opacity), effectiveOpacity, ancestorDisplayNone,
    };
  });
  return {
    viewport: { width: innerWidth, height: innerHeight },
    devicePixelRatio, clientWidth: root.clientWidth,
    input: { hoverNone: matchMedia('(hover: none)').matches,
      pointerCoarse: matchMedia('(pointer: coarse)').matches, maxTouchPoints: navigator.maxTouchPoints },
    overflowX: root.scrollWidth - root.clientWidth, elements,
  };
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    viewport: { type: 'string', multiple: true, default: [] },
    selector: { type: 'string', multiple: true, default: [] },
    ready: { type: 'string' },
    channel: { type: 'string' },
    screenshots: { type: 'string' },
    touch: { type: 'boolean', default: false },
    help: { type: 'boolean' },
  } });
  if (values.help) return console.log(usage);
  if (positionals.length !== 1 || !values.viewport.length) throw new Error(usage);
  const url = new URL(positionals[0]);
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Expected an HTTP(S) or file URL.');
  const viewports = values.viewport.map(parseViewport);
  const browser = await loadChromium().launch({ channel: values.channel, headless: true });
  try {
    let output;
    if (values.screenshots) {
      const directory = path.resolve(values.screenshots);
      await mkdir(directory, { recursive: true });
      output = await mkdtemp(path.join(directory, 'viewport-'));
    }
    const samples = [];
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: values.touch });
      const response = await page.goto(url.href, { waitUntil: 'load' });
      if (response && !response.ok()) throw new Error('Navigation returned HTTP ' + response.status());
      if (values.ready) await page.locator(values.ready).waitFor({ state: 'visible', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const sample = await page.evaluate(measure, values.selector);
      if (output) {
        sample.screenshot = path.join(output, `${samples.length + 1}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: sample.screenshot });
      }
      samples.push({ page: page.url(), ...sample });
      await page.close();
    }
    console.log(JSON.stringify({ source: 'standalone-headless', browser: browser.version(), samples }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
