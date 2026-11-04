const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

function verify(id) {
  return spawnSync(process.execPath, [path.resolve(__dirname, '../evals/verify-output.cjs'),
    id, path.resolve(__dirname, '../evals/fixtures', id)], { encoding: 'utf8' });
}

test('outcome checker accepts correct host scaling, breakpoint and table fixtures', () => {
  for (const id of ['01', '03', '05']) {
    const result = verify(id);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, true);
  }
});

test('outcome checker rejects unfixed typography, image and copy tasks', () => {
  for (const id of ['02', '04', '07']) {
    const result = verify(id);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
});
