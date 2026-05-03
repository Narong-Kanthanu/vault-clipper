'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { buildClipPayload, normalizeTags } = require('../../lib/clipper.js');

const turndownSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'turndown.js'),
  'utf8'
);

function makeTurndown() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><script>${turndownSrc}<\/script></head><body></body></html>`,
    { runScripts: 'dangerously' }
  );
  return dom.window.TurndownService;
}

test('normalizeTags lowercases, hyphenates whitespace, trims, prepends "clippings"', () => {
  assert.deepEqual(normalizeTags('  Foo Bar , Baz '), ['clippings', 'foo-bar', 'baz']);
});

test('normalizeTags does not duplicate "clippings" when caller supplies it', () => {
  assert.deepEqual(normalizeTags('clippings, notes'), ['clippings', 'notes']);
});

test('normalizeTags handles empty / nullish input', () => {
  assert.deepEqual(normalizeTags(''), ['clippings']);
  assert.deepEqual(normalizeTags(null), ['clippings']);
  assert.deepEqual(normalizeTags(undefined), ['clippings']);
});

test('buildClipPayload returns filename, content, and images', () => {
  const out = buildClipPayload({
    extracted: {
      title: 'Fallback Title',
      author: 'Jane Doe',
      published: '2026-04-01',
      description: 'Test desc',
      html: '<h1>Hello</h1><p>World</p>',
      images: [{ url: 'https://example.com/i.png', alt: '', index: 0 }]
    },
    pageUrl: 'https://example.com/post',
    pageTitle: 'Override Title',
    rawTags: 'productivity, notes',
    now: '2026-05-01T00:00:00+00:00',
    TurndownService: makeTurndown()
  });

  assert.equal(out.filename, 'Override Title.md');
  assert.match(out.content, /title: "Override Title"/);
  assert.match(out.content, /tags:\n  - "clippings"\n  - "productivity"\n  - "notes"\n/);
  assert.match(out.content, /^# Hello/m);
  assert.deepEqual(out.images, [{ url: 'https://example.com/i.png', alt: '', index: 0 }]);
});

test('buildClipPayload falls back to extracted.title when pageTitle is blank', () => {
  const out = buildClipPayload({
    extracted: { title: 'Extracted', html: '<p>X</p>' },
    pageUrl: 'https://example.com/',
    pageTitle: '   ',
    rawTags: '',
    now: '2026-05-01T00:00:00+00:00',
    TurndownService: makeTurndown()
  });
  assert.equal(out.filename, 'Extracted.md');
  assert.match(out.content, /title: "Extracted"/);
});

test('buildClipPayload uses "untitled" when no title source is available', () => {
  const out = buildClipPayload({
    extracted: { html: '<p>X</p>' },
    pageUrl: '',
    pageTitle: '',
    rawTags: '',
    now: '2026-05-01T00:00:00+00:00',
    TurndownService: makeTurndown()
  });
  assert.equal(out.filename, 'untitled.md');
});

test('buildClipPayload defaults images to empty array when extractor omits them', () => {
  const out = buildClipPayload({
    extracted: { title: 'X', html: '<p>X</p>' },
    pageUrl: 'https://example.com/',
    pageTitle: 'X',
    rawTags: '',
    now: '2026-05-01T00:00:00+00:00',
    TurndownService: makeTurndown()
  });
  assert.deepEqual(out.images, []);
});

test('buildClipPayload throws when TurndownService is unavailable', () => {
  assert.throws(
    () => buildClipPayload({
      extracted: { title: 'X', html: '<p>X</p>' },
      pageUrl: '',
      pageTitle: 'X',
      rawTags: '',
      now: '2026-05-01T00:00:00+00:00'
    }),
    /TurndownService not available/
  );
});
