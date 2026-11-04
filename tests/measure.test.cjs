const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const script = path.resolve(__dirname, '../scripts/measure.cjs');
const example = pathToFileURL(path.resolve(__dirname, '../example/index.html')).href;

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('help is available without launching a browser', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--viewport/);
  assert.equal(result.stderr, '');
});

test('invalid inputs fail before producing a measurement', () => {
  for (const args of [
    [],
    [example],
    [example, '--viewport', '0x900'],
    [example, '--viewport', '-10x900'],
    [example, '--viewport', '1440'],
    ['ftp://example.com', '--viewport', '1440x900'],
    [example, '--unknown'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim(), JSON.stringify(args));
  }
});

test('touch samples expose input media and hidden ancestors without declaring visual success', () => {
  const fixture = pathToFileURL(path.resolve(__dirname, '../evals/fixtures/08/page.html')).href;
  for (const touch of [false, true]) {
    const args = [fixture, '--viewport', '390x844', '--selector', '#course-title',
      '--selector', '#featured-title', '--selector', '#desktop-label'];
    if (touch) args.push('--touch');
    if (process.env.PLAYWRIGHT_CHANNEL) args.push('--channel', process.env.PLAYWRIGHT_CHANNEL);
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const sample = JSON.parse(result.stdout).samples[0];
    if (touch) {
      assert.equal(sample.input.hoverNone, true);
      assert.equal(sample.input.pointerCoarse, true);
      assert.ok(sample.input.maxTouchPoints > 0);
    }
    assert.ok(Number.isInteger(sample.input.maxTouchPoints) && sample.input.maxTouchPoints >= 0);
    const [course, featured, desktop] = sample.elements;
    assert.ok(course.width > 0 && course.height > 0);
    assert.equal(course.visibility, 'visible');
    assert.equal(course.opacity, 1);
    assert.equal(course.effectiveOpacity, 0);
    assert.equal(featured.effectiveOpacity, sample.input.hoverNone ? 1 : 0);
    assert.equal(desktop.ancestorDisplayNone, true);
    assert.equal(desktop.width, 0);
    assert.equal(sample.overflowX, 0);
  }
});

test('measurements report selector ambiguity and save separate viewport screenshots', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'measure-contract-'));
  try {
    const args = [
      example, '--viewport', '390x844', '--viewport', '1440x900',
      '--selector', 'h1', '--selector', '.missing-element', '--selector', 'li',
      '--ready', 'h1', '--screenshots', output,
    ];
    if (process.env.PLAYWRIGHT_CHANNEL) args.push('--channel', process.env.PLAYWRIGHT_CHANNEL);
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.source, 'standalone-headless');
    assert.ok(report.browser);
    assert.deepEqual(report.samples.map(sample => sample.viewport), [
      { width: 390, height: 844 }, { width: 1440, height: 900 },
    ]);
    const screenshotPaths = report.samples.map(sample => sample.screenshot);
    assert.equal(new Set(screenshotPaths).size, 2);
    for (const sample of report.samples) {
      assert.equal(sample.elements[0].matches, 1);
      assert.ok(sample.elements[0].width > 0);
      assert.deepEqual(sample.elements[1], { selector: '.missing-element', matches: 0 });
      assert.deepEqual(sample.elements[2], { selector: 'li', matches: 3 });
      assert.ok(Number.isFinite(sample.clientWidth));
      assert.ok(Number.isFinite(sample.overflowX));
      assert.equal(path.dirname(path.dirname(sample.screenshot)), output);
      assert.deepEqual(readFileSync(sample.screenshot).subarray(0, 8),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
  } finally {
    assert.equal(path.dirname(output), path.resolve(tmpdir()));
    rmSync(output, { recursive: true, force: true });
  }
});
