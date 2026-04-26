'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'manifest.json'), 'utf8')
);

test('manifest declares options_ui so openOptionsPage works', () => {
  assert.ok(manifest.options_ui, 'options_ui must be declared');
  assert.equal(manifest.options_ui.page, 'options/options.html');
});

test('every file referenced by manifest exists on disk', () => {
  const repoRoot = path.join(__dirname, '..', '..');
  const refs = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    manifest.options_ui.page,
    ...Object.values(manifest.action.default_icon),
    ...Object.values(manifest.icons)
  ];
  for (const rel of refs) {
    assert.ok(fs.existsSync(path.join(repoRoot, rel)), `missing: ${rel}`);
  }
});
