'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { extractPageContent } = require('../../lib/clip-utils.js');

const turndownSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'turndown.js'),
  'utf8'
);

function makeWindow(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  // Evaluate the vendored Turndown bundle inside the jsdom window so it has
  // access to the same DOM globals it would in the browser.
  dom.window.eval(turndownSrc);
  return dom.window;
}

function withGlobals(window, fn) {
  const prev = { document: global.document, URL: global.URL };
  global.document = window.document;
  global.URL = window.URL;
  try {
    return fn();
  } finally {
    global.document = prev.document;
    global.URL = prev.URL;
  }
}

test('vendored Turndown converts headings, lists, code, and links as configured', () => {
  const html = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'article-tag.html'),
    'utf8'
  );
  const window = makeWindow(html, 'https://example.com/posts/');
  const extracted = withGlobals(window, extractPageContent);

  const ts = new window.TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  });
  ts.remove(['script', 'style', 'nav', 'footer', 'aside', 'noscript']);
  const md = ts.turndown(extracted.html);

  assert.match(md, /^# The Quiet Power of Plain Text/m, 'atx heading style');
  assert.match(md, /^## Why it lasts/m, 'h2 atx heading');
  assert.match(md, /^-\s+No vendor lock-in/m, 'bullet list marker is "-"');
  assert.match(md, /\*superpower\*/, 'em uses single asterisk');
  assert.match(md, /\*\*boring\*\*/, 'strong renders');
  assert.match(md, /```[a-z]*\nconst x = 1;/, 'fenced code block (with optional lang hint)');
  assert.doesNotMatch(md, /BUY MORE STUFF/, 'ad text must not survive');
  assert.doesNotMatch(md, /drive-by comment/, 'comments must not survive');
});
