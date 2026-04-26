'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFilename, escapeYaml, buildFrontmatter } = require('../../lib/clip-utils.js');

test('sanitizeFilename strips path and shell-unsafe chars', () => {
  assert.equal(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), 'abcdefghij');
});

test('sanitizeFilename collapses whitespace and trims', () => {
  assert.equal(sanitizeFilename('  hello   world\n\tfoo  '), 'hello world foo');
});

test('sanitizeFilename caps length at 200', () => {
  const long = 'a'.repeat(500);
  assert.equal(sanitizeFilename(long).length, 200);
});

test('sanitizeFilename keeps unicode and dots', () => {
  assert.equal(sanitizeFilename('Über.Cool — Notes.md'), 'Über.Cool — Notes.md');
});

test('escapeYaml escapes quotes and newlines', () => {
  assert.equal(escapeYaml('She said "hi"\nthen left'), 'She said \\"hi\\" then left');
});

test('buildFrontmatter renders required fields and tag list', () => {
  const fm = buildFrontmatter({
    pageTitle: 'Hello',
    pageUrl: 'https://example.com/',
    extracted: {},
    tags: ['clippings', 'notes'],
    now: '2026-04-26T00:00:00+00:00'
  });
  assert.match(fm, /^---\n/);
  assert.match(fm, /title: "Hello"\n/);
  assert.match(fm, /source: "https:\/\/example\.com\/"\n/);
  assert.match(fm, /created: 2026-04-26T00:00:00\+00:00\n/);
  assert.match(fm, /tags:\n  - "clippings"\n  - "notes"\n/);
  assert.match(fm, /---\n\n$/);
});

test('buildFrontmatter splits multi-author strings into wikilinks', () => {
  const fm = buildFrontmatter({
    pageTitle: 'X',
    pageUrl: 'https://example.com/',
    extracted: { author: 'Jane Doe, John Smith' },
    tags: ['clippings'],
    now: '2026-04-26T00:00:00+00:00'
  });
  assert.match(fm, /author:\n  - "\[\[Jane Doe\]\]"\n  - "\[\[John Smith\]\]"\n/);
});

test('buildFrontmatter omits optional fields when missing', () => {
  const fm = buildFrontmatter({
    pageTitle: 'X',
    pageUrl: 'https://example.com/',
    extracted: {},
    tags: ['clippings'],
    now: '2026-04-26T00:00:00+00:00'
  });
  assert.doesNotMatch(fm, /author:/);
  assert.doesNotMatch(fm, /published:/);
  assert.doesNotMatch(fm, /description:/);
});

test('buildFrontmatter escapes quotes in title and description', () => {
  const fm = buildFrontmatter({
    pageTitle: 'A "quoted" title',
    pageUrl: 'https://example.com/',
    extracted: { description: 'Has "quotes" too' },
    tags: ['clippings'],
    now: '2026-04-26T00:00:00+00:00'
  });
  assert.match(fm, /title: "A \\"quoted\\" title"\n/);
  assert.match(fm, /description: "Has \\"quotes\\" too"\n/);
});
