(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VaultClipperUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function sanitizeFilename(str) {
    return String(str)
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  function escapeYaml(str) {
    return String(str).replace(/"/g, '\\"').replace(/\n/g, ' ');
  }

  function buildFrontmatter(opts) {
    var pageTitle = opts.pageTitle;
    var pageUrl = opts.pageUrl;
    var extracted = opts.extracted || {};
    var tags = opts.tags || [];
    var now = opts.now;

    var fm = '---\n';
    fm += 'title: "' + escapeYaml(pageTitle) + '"\n';
    fm += 'source: "' + pageUrl + '"\n';
    if (extracted.author) {
      var authors = extracted.author.split(/,\s*/).map(function (a) { return a.trim(); }).filter(Boolean);
      fm += 'author:\n';
      authors.forEach(function (a) {
        fm += '  - "[[' + escapeYaml(a) + ']]"\n';
      });
    }
    if (extracted.published) {
      fm += 'published: ' + extracted.published + '\n';
    }
    fm += 'created: ' + now + '\n';
    if (extracted.description) {
      fm += 'description: "' + escapeYaml(extracted.description) + '"\n';
    }
    fm += 'tags:\n';
    tags.forEach(function (t) {
      fm += '  - "' + t + '"\n';
    });
    fm += '---\n\n';
    return fm;
  }

  // Runs in the target page's isolated world via chrome.scripting.executeScript,
  // so it must not reference any closure values — only `document` / `window`.
  function extractPageContent() {
    var container = document.querySelector('article');
    if (!container) container = document.querySelector('[role="main"]');
    if (!container) container = document.querySelector('main');

    if (!container) {
      var candidates = document.querySelectorAll('div, section');
      var bestScore = 0;
      candidates.forEach(function (el) {
        var text = el.textContent || '';
        var links = el.querySelectorAll('a');
        var textLen = text.trim().length;
        var linkTextLen = Array.from(links).reduce(function (sum, a) { return sum + (a.textContent || '').length; }, 0);
        var score = textLen - (linkTextLen * 2);
        if (score > bestScore && textLen > 200) {
          bestScore = score;
          container = el;
        }
      });
    }

    if (!container) container = document.body;

    var clone = container.cloneNode(true);
    var removeSelectors = 'script, style, nav, footer, aside, noscript, iframe, .ad, .ads, .advertisement, .social-share, .share-buttons, .comments, .comment-section, [aria-hidden="true"]';
    clone.querySelectorAll(removeSelectors).forEach(function (el) { el.remove(); });

    var ogTitle = document.querySelector('meta[property="og:title"]');
    var title = ogTitle ? ogTitle.content : document.title;

    var author = '';
    var authorMeta = document.querySelector('meta[name="author"]') ||
                     document.querySelector('meta[property="article:author"]');
    if (authorMeta) {
      author = authorMeta.content;
    } else {
      var authorEl = document.querySelector('[rel="author"], .author, .byline, [class*="author"]');
      if (authorEl) author = authorEl.textContent.trim();
    }

    var published = '';
    var publishedMeta = document.querySelector('meta[property="article:published_time"]') ||
                        document.querySelector('meta[name="date"]') ||
                        document.querySelector('meta[name="publication_date"]');
    if (publishedMeta) {
      var parsed = new Date(publishedMeta.content);
      if (!isNaN(parsed)) published = parsed.toISOString().split('T')[0];
    } else {
      var timeEl = document.querySelector('time[datetime]');
      if (timeEl) {
        var parsed2 = new Date(timeEl.getAttribute('datetime'));
        if (!isNaN(parsed2)) published = parsed2.toISOString().split('T')[0];
      }
    }

    var description = '';
    var descMeta = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]');
    if (descMeta) description = descMeta.content || '';

    var images = [];
    clone.querySelectorAll('img').forEach(function (img, i) {
      var src = img.src || img.dataset.src || '';
      if (src && !src.startsWith('data:')) {
        try {
          var absoluteUrl = new URL(src, document.baseURI).href;
          images.push({ url: absoluteUrl, alt: img.alt || '', index: i });
        } catch (e) {}
      }
    });

    return {
      title: title || '',
      author: author || '',
      published: published,
      description: description,
      html: clone.innerHTML,
      images: images
    };
  }

  return {
    sanitizeFilename: sanitizeFilename,
    escapeYaml: escapeYaml,
    buildFrontmatter: buildFrontmatter,
    extractPageContent: extractPageContent
  };
}));
