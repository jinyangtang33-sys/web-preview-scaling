// Diagnostic observations, not a visual-quality score. May also be used as
// page.evaluate(inspectRenderedPage) inside an existing authenticated test flow.
function inspectRenderedPage() {
  const root = document.documentElement;
  const box = element => {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const label = element => (element.getAttribute('aria-label') || element.innerText ||
    element.getAttribute('alt') || element.getAttribute('placeholder') || '').trim().slice(0, 100);
  const identity = element => ({ tag: element.tagName.toLowerCase(), id: element.id || null,
    classes: typeof element.className === 'string' ? element.className : '', label: label(element) });
  const opacity = element => {
    let result = 1;
    for (let e = element; e; e = e.parentElement) result *= Number(getComputedStyle(e).opacity);
    return result;
  };
  const rendered = element => { const r = box(element); return r.width > 0 && r.height > 0; };
  const candidates = [];
  const targets = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],h1,h2,h3,p,li,dt,dd,label,figcaption,strong')].filter(rendered);
  for (const element of targets) {
    const style = getComputedStyle(element), r = box(element), alpha = opacity(element);
    const reasons = [];
    if (label(element) && (alpha === 0 || style.visibility !== 'visible')) reasons.push('hidden-content');
    if (element.scrollWidth > element.clientWidth + 1 && ['hidden', 'clip'].includes(style.overflowX)) reasons.push('clipped-or-ellipsized-content');
    if (r.right > root.clientWidth + 1 || r.x < -1) reasons.push('outside-root-width');
    if (reasons.length) candidates.push({ ...identity(element), ...r, reasons, effectiveOpacity: alpha,
      visibility: style.visibility, overflowX: style.overflowX, textOverflow: style.textOverflow, fontSize: style.fontSize });
  }
  const actions = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"]')]
    .filter(rendered).slice(0, 100).map(element => {
      const r = box(element), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const inViewport = x >= 0 && x < root.clientWidth && y >= 0 && y < innerHeight;
      const hit = inViewport ? document.elementFromPoint(x, y) : null;
      return { ...identity(element), ...r, effectiveOpacity: opacity(element), visibility: getComputedStyle(element).visibility,
        fullyInFirstViewport: r.x >= 0 && r.right <= root.clientWidth && r.y >= 0 && r.bottom <= innerHeight,
        centerReceivesPointer: inViewport ? Boolean(hit && (hit === element || element.contains(hit))) : null,
        disabled: Boolean(element.disabled) };
    });
  const images = [...document.images].filter(rendered).slice(0, 60).map(element => {
    const style = getComputedStyle(element), r = box(element), px = value => parseFloat(value) || 0;
    const width = Math.max(0, r.width - px(style.borderLeftWidth) - px(style.borderRightWidth) - px(style.paddingLeft) - px(style.paddingRight));
    const height = Math.max(0, r.height - px(style.borderTopWidth) - px(style.borderBottomWidth) - px(style.paddingTop) - px(style.paddingBottom));
    const naturalWidth = element.naturalWidth, naturalHeight = element.naturalHeight;
    let fittedSize = null;
    if (naturalWidth && naturalHeight) {
      let scale;
      if (style.objectFit === 'contain') scale = Math.min(width / naturalWidth, height / naturalHeight);
      if (style.objectFit === 'cover') scale = Math.max(width / naturalWidth, height / naturalHeight);
      if (style.objectFit === 'scale-down') scale = Math.min(1, width / naturalWidth, height / naturalHeight);
      if (style.objectFit === 'none') scale = 1;
      fittedSize = scale === undefined ? { width, height } : { width: naturalWidth * scale, height: naturalHeight * scale };
    }
    return { ...identity(element), ...r, complete: element.complete, naturalWidth, naturalHeight,
      objectFit: style.objectFit, objectPosition: style.objectPosition, contentBox: { width, height }, fittedSize,
      fittedAreaFraction: fittedSize && width && height ? fittedSize.width * fittedSize.height / (width * height) : null };
  });
  return { viewport: { width: innerWidth, height: innerHeight }, clientWidth: root.clientWidth,
    overflowX: root.scrollWidth - root.clientWidth,
    input: { hoverNone: matchMedia('(hover:none)').matches, pointerCoarse: matchMedia('(pointer:coarse)').matches, maxTouchPoints: navigator.maxTouchPoints },
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(rendered).map(e => ({ ...identity(e), ...box(e), fontSize: getComputedStyle(e).fontSize, lineHeight: getComputedStyle(e).lineHeight })),
    candidateCount: candidates.length, candidates: candidates.slice(0, 60), actions, images,
    limits: 'Candidates include intentional hiding, truncation and internal scrolling. Fitted image sizes ignore transforms, object-position, clipping, transparency and occlusion. Pointer center is a point sample. Judge actual screenshots and task context.' };
}

async function main() {
  const { parseArgs } = require('node:util');
  const path = require('node:path');
  const fs = require('node:fs/promises');
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    viewport: { type: 'string', multiple: true, default: [] }, channel: { type: 'string' },
    touch: { type: 'boolean', default: false }, ready: { type: 'string' }, screenshots: { type: 'string' }, help: { type: 'boolean' },
  } });
  const usage = 'node render-inspect.cjs URL --viewport 1440x900 [--viewport 390x844] [--touch] [--ready CSS] [--channel chrome] [--screenshots DIR]';
  if (values.help) return console.log(usage);
  if (positionals.length !== 1 || !values.viewport.length) throw new Error(usage);
  const url = new URL(positionals[0]);
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Expected HTTP(S) or file URL');
  const viewports = values.viewport.map(value => {
    const match = /^(\d{1,5})x(\d{1,5})$/.exec(value);
    if (!match || +match[1] < 1 || +match[2] < 1) throw new Error('Expected positive WIDTHxHEIGHT');
    return { width: +match[1], height: +match[2] };
  });
  let chromium;
  for (const name of ['playwright', 'playwright-core']) {
    let entry;
    try { entry = require.resolve(name, { paths: [process.cwd(), __dirname] }); }
    catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
    chromium = require(entry).chromium; break;
  }
  if (!chromium) throw new Error('Run from a project with Playwright or playwright-core installed');
  const browser = await chromium.launch({ headless: true, channel: values.channel });
  try {
    let output;
    if (values.screenshots) { const directory = path.resolve(values.screenshots); await fs.mkdir(directory, { recursive: true }); output = await fs.mkdtemp(path.join(directory, 'render-')); }
    const samples = [];
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: values.touch });
      const response = await page.goto(url.href, { waitUntil: 'load' });
      if (response && !response.ok()) throw new Error('Navigation returned HTTP ' + response.status());
      if (values.ready) await page.locator(values.ready).waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      const sample = await page.evaluate(inspectRenderedPage);
      if (output) {
        sample.screenshot = path.join(output, `${samples.length + 1}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: sample.screenshot });
        sample.inputAfterScreenshot = await page.evaluate(() => ({ hoverNone: matchMedia('(hover:none)').matches, pointerCoarse: matchMedia('(pointer:coarse)').matches, maxTouchPoints: navigator.maxTouchPoints }));
      }
      samples.push({ page: page.url(), ...sample }); await page.close();
    }
    console.log(JSON.stringify({ source: 'standalone-headless', browser: browser.version(), samples }, null, 2));
  } finally { await browser.close(); }
}

module.exports = { inspectRenderedPage };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
