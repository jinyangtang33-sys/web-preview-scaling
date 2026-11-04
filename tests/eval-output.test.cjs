const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

function verify(id, project = path.resolve(__dirname, '../evals/fixtures', id)) {
  return spawnSync(process.execPath, [path.resolve(__dirname, '../evals/verify-output.cjs'),
    id, project], { encoding: 'utf8' });
}

test('outcome checker accepts correct host scaling, breakpoint and table fixtures', () => {
  for (const id of ['01', '03', '05']) {
    const result = verify(id);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, true);
  }
});

test('outcome checker rejects unfixed typography, image, copy and touch tasks', () => {
  for (const id of ['02', '04', '07', '08']) {
    const result = verify(id);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
});

test('touch outcome checker rejects changes to intentional hiding and scrolling', () => {
  const project = mkdtempSync(path.join(tmpdir(), 'touch-overreach-'));
  try {
    const original = readFileSync(path.resolve(__dirname, '../evals/fixtures/08/page.html'), 'utf8');
    const fixed = original.replace('</style>',
      '@media (hover:none) { #catalog .course-meta { opacity: 1; } }\n</style>');
    for (const regression of [
      '#future-note { display: block !important; }',
      '.desktop-nav { display: block !important; }',
      '.rail { overflow-x: hidden !important; }',
    ]) {
      writeFileSync(path.join(project, 'page.html'), fixed.replace('</style>', regression + '\n</style>'));
      const result = verify('08', project);
      assert.equal(result.status, 1, regression);
      assert.equal(result.stdout, '');
      assert.ok(result.stderr.trim());
    }
  } finally {
    assert.equal(path.dirname(project), path.resolve(tmpdir()));
    rmSync(project, { recursive: true, force: true });
  }
});

test('touch outcome checker accepts scoped content visibility while retaining intentional hiding', () => {
  const project = mkdtempSync(path.join(tmpdir(), 'touch-outcome-'));
  try {
    const original = readFileSync(path.resolve(__dirname, '../evals/fixtures/08/page.html'), 'utf8');
    writeFileSync(path.join(project, 'page.html'), original.replace('</style>',
      '@media (hover:none) { #catalog .course-meta { opacity: 1; } }\n</style>'));
    const result = verify('08', project);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, true);
  } finally {
    assert.equal(path.dirname(project), path.resolve(tmpdir()));
    rmSync(project, { recursive: true, force: true });
  }
});
