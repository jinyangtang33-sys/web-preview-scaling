const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const measureScript = path.resolve(__dirname, '../scripts/measure.cjs');
const example = pathToFileURL(path.resolve(__dirname, '../example/index.html'));

for (const [mode, expectedFontSize] of [['before', '100.8px'], ['after', '52px']]) {
  test(`#${mode} desktop title and 760px grid breakpoint`, () => {
    const args = [
      measureScript, `${example.href}#${mode}`,
      '--viewport', '1440x900', '--viewport', '759x900', '--viewport', '760x900',
      '--selector', 'h1', '--selector', '.stops',
    ];
    if (process.env.PLAYWRIGHT_CHANNEL) args.push('--channel', process.env.PLAYWRIGHT_CHANNEL);
    const { samples } = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
    assert.deepEqual(samples.map(sample => sample.viewport.width), [1440, 759, 760]);

    const title = samples[0].elements.find(element => element.selector === 'h1');
    assert.equal(title.fontSize, expectedFontSize, `#${mode} h1 at 1440px`);

    for (const [sample, columns] of [[samples[1], 1], [samples[2], 3]]) {
      const label = `#${mode} .stops at ${sample.viewport.width}px`;
      const grid = sample.elements.find(element => element.selector === '.stops');
      assert.equal(grid.display, 'grid', label);
      const tracks = grid.gridTemplateColumns.split(/\s+/);
      assert.equal(tracks.length, columns, `${label} column count (${grid.gridTemplateColumns})`);
      assert.ok(tracks.every(track => parseFloat(track) > 0), `${label} columns must have a width`);
    }
  });
}
