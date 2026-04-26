'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { extractPageContent } = require('../../lib/clip-utils.js');

function loadFixtureWindow(name) {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.com/posts/' });
  return dom.window;
}

function runExtract(window) {
  // extractPageContent only reads `document` and `URL` — bind them for the call.
  const prev = { document: global.document, URL: global.URL };
  global.document = window.document;
  global.URL = window.URL;
  try {
    return extractPageContent();
  } finally {
    global.document = prev.document;
    global.URL = prev.URL;
  }
}

test('extracts metadata and article body when <article> is present', () => {
  const window = loadFixtureWindow('article-tag.html');
  const result = runExtract(window);

  assert.equal(result.title, 'The Quiet Power of Plain Text', 'prefers og:title over <title>');
  assert.equal(result.author, 'Jane Doe, John Smith');
  assert.equal(result.published, '2026-01-15');
  assert.match(result.description, /plain text outlives/);
  assert.match(result.html, /<h1>The Quiet Power of Plain Text<\/h1>/);
  assert.match(result.html, /<strong>boring<\/strong>/);
  assert.doesNotMatch(result.html, /BUY MORE STUFF/, 'ads must be stripped');
  assert.doesNotMatch(result.html, /drive-by comment/, 'comments must be stripped');
  assert.doesNotMatch(result.html, /should not appear/, 'scripts must be stripped');
});

test('collects images, resolves relative URLs, and skips data: URIs', () => {
  const window = loadFixtureWindow('article-tag.html');
  const result = runExtract(window);

  const urls = result.images.map(i => i.url).sort();
  assert.deepEqual(urls, [
    'https://cdn.example.com/photo.jpg',
    'https://example.com/posts/diagram.png'
  ]);
  assert.equal(result.images.find(i => i.url.endsWith('photo.jpg')).alt, 'A photo');
  for (const img of result.images) {
    assert.ok(!img.url.startsWith('data:'), 'data: URIs must be filtered out');
  }
});

test('falls back to longest-text container when no <article>', () => {
  const window = loadFixtureWindow('article-fallback.html');
  const result = runExtract(window);

  assert.match(result.html, /Heuristic Test Page/);
  assert.match(result.html, /A second paragraph/);
  // The link-farm sidebar should NOT have been picked.
  assert.doesNotMatch(result.html, /<a href="\/d">link<\/a>/);
});
