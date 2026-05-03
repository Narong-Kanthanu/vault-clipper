(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./clip-utils.js'));
  } else {
    root.VaultClipperClipper = factory(root.VaultClipperUtils);
  }
}(typeof self !== 'undefined' ? self : this, function (utils) {
  'use strict';

  var TURNDOWN_OPTIONS = {
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  };
  var TURNDOWN_REMOVE = ['script', 'style', 'nav', 'footer', 'aside', 'noscript'];

  function nowIsoString() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }

  function normalizeTags(rawTags) {
    var input = typeof rawTags === 'string' ? rawTags : '';
    var tags = input
      .split(',')
      .map(function (t) { return t.trim().toLowerCase().replace(/\s+/g, '-'); })
      .filter(Boolean);
    if (tags.indexOf('clippings') === -1) tags.unshift('clippings');
    return tags;
  }

  function resolveTitle(pageTitle, extracted) {
    var raw = (pageTitle == null ? '' : String(pageTitle)).trim();
    return raw || (extracted && extracted.title) || 'untitled';
  }

  // Pure: takes already-extracted page content and returns the payload the
  // service worker forwards to the native host. Browser callers omit
  // TurndownService and we read it from globals; node tests inject one.
  function buildClipPayload(opts) {
    opts = opts || {};
    var Turndown = opts.TurndownService
      || (typeof self !== 'undefined' ? self.TurndownService : null);
    if (!Turndown) throw new Error('TurndownService not available');

    var extracted = opts.extracted || {};
    var title = resolveTitle(opts.pageTitle, extracted);
    var tags = normalizeTags(opts.rawTags);
    var now = opts.now || nowIsoString();

    var turndown = new Turndown(TURNDOWN_OPTIONS);
    turndown.remove(TURNDOWN_REMOVE);

    var markdown = turndown.turndown(extracted.html || '');
    var frontmatter = utils.buildFrontmatter({
      pageTitle: title,
      pageUrl: opts.pageUrl || '',
      extracted: extracted,
      tags: tags,
      now: now
    });

    return {
      filename: utils.sanitizeFilename(title) + '.md',
      content: frontmatter + markdown,
      images: extracted.images || []
    };
  }

  return {
    buildClipPayload: buildClipPayload,
    normalizeTags: normalizeTags
  };
}));
