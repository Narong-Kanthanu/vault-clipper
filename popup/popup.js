const STORAGE_DEFAULTS = {
  vaults: [],
  selectedVaultId: null,
  defaultFolder: 'raw',
  downloadImages: true
};

const needsSetupEl = document.getElementById('needs-setup');
const mainEl = document.getElementById('main');
const vaultToggleEl = document.getElementById('vault-toggle');
const titleInput = document.getElementById('title-input');
const tagsInput = document.getElementById('tags-input');
const downloadImagesInput = document.getElementById('download-images');
const clipBtn = document.getElementById('clip-btn');
const statusEl = document.getElementById('status');
const openOptionsBtn = document.getElementById('open-options');
const openOptionsCtaBtn = document.getElementById('open-options-cta');

let settings = { ...STORAGE_DEFAULTS };

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
}

openOptionsBtn.addEventListener('click', openOptions);
openOptionsCtaBtn.addEventListener('click', openOptions);

function renderVaultButtons() {
  vaultToggleEl.innerHTML = '';
  settings.vaults.forEach(vault => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vault-btn' + (vault.id === settings.selectedVaultId ? ' active' : '');
    btn.dataset.vaultId = vault.id;
    btn.textContent = vault.label;
    btn.addEventListener('click', () => {
      settings.selectedVaultId = vault.id;
      chrome.storage.local.set({ selectedVaultId: vault.id });
      vaultToggleEl.querySelectorAll('.vault-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.vaultId === vault.id);
      });
    });
    vaultToggleEl.appendChild(btn);
  });
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);
  settings = { ...STORAGE_DEFAULTS, ...stored };

  if (!Array.isArray(settings.vaults) || settings.vaults.length === 0) {
    needsSetupEl.hidden = false;
    mainEl.hidden = true;
    return;
  }

  if (!settings.vaults.some(v => v.id === settings.selectedVaultId)) {
    settings.selectedVaultId = settings.vaults[0].id;
  }

  needsSetupEl.hidden = true;
  mainEl.hidden = false;

  renderVaultButtons();
  downloadImagesInput.checked = settings.downloadImages !== false;

  // Extract page title from active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMeta
      });
      if (results && results[0] && results[0].result) {
        titleInput.value = results[0].result.title || '';
      }
    }
  } catch (e) {
    titleInput.value = '';
  }
}

function extractMeta() {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const title = ogTitle ? ogTitle.content : document.title;
  return { title: title || '' };
}

downloadImagesInput.addEventListener('change', () => {
  chrome.storage.local.set({ downloadImages: downloadImagesInput.checked });
});

clipBtn.addEventListener('click', async () => {
  clipBtn.disabled = true;
  setStatus('Extracting page content...', 'working');

  try {
    const selectedVault = settings.vaults.find(v => v.id === settings.selectedVaultId);
    if (!selectedVault) throw new Error('No vault selected');
    if (!selectedVault.path) throw new Error('Selected vault has no path configured');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract page content');
    }

    const extracted = results[0].result;
    const pageTitle = titleInput.value.trim() || extracted.title || 'untitled';
    const pageUrl = tab.url;

    const tags = tagsInput.value
      .split(',')
      .map(t => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(t => t.length > 0);

    const filename = sanitizeFilename(pageTitle) + '.md';

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*'
    });
    turndownService.remove(['script', 'style', 'nav', 'footer', 'aside', 'noscript']);
    const markdown = turndownService.turndown(extracted.html);

    const now = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
    if (!tags.includes('clippings')) tags.unshift('clippings');

    let frontmatter = '---\n';
    frontmatter += `title: "${escapeYaml(pageTitle)}"\n`;
    frontmatter += `source: "${pageUrl}"\n`;
    if (extracted.author) {
      const authors = extracted.author.split(/,\s*/).map(a => a.trim()).filter(Boolean);
      frontmatter += 'author:\n';
      authors.forEach(a => {
        frontmatter += `  - "[[${escapeYaml(a)}]]"\n`;
      });
    }
    if (extracted.published) {
      frontmatter += `published: ${extracted.published}\n`;
    }
    frontmatter += `created: ${now}\n`;
    if (extracted.description) {
      frontmatter += `description: "${escapeYaml(extracted.description)}"\n`;
    }
    frontmatter += 'tags:\n';
    tags.forEach(t => {
      frontmatter += `  - "${t}"\n`;
    });
    frontmatter += '---\n\n';

    const fullContent = frontmatter + markdown;
    const images = extracted.images || [];

    setStatus('Saving to vault...', 'working');

    const folder = settings.defaultFolder || 'raw';
    const response = await chrome.runtime.sendMessage({
      action: 'save-to-vault',
      vaultPath: selectedVault.path,
      folder,
      filename,
      content: fullContent,
      images,
      downloadImages: downloadImagesInput.checked
    });

    if (response && response.success) {
      const imgMsg = response.images_downloaded > 0
        ? ` | ${response.images_downloaded} images saved`
        : '';
      setStatus(`Clipped to ${selectedVault.label}/${folder}/${filename}${imgMsg}`, 'success');
    } else {
      throw new Error(response ? response.error : 'No response from native host');
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    console.error('Vault Clipper error:', err);
  } finally {
    clipBtn.disabled = false;
  }
});

function extractPageContent() {
  let container = document.querySelector('article');
  if (!container) container = document.querySelector('[role="main"]');
  if (!container) container = document.querySelector('main');

  if (!container) {
    const candidates = document.querySelectorAll('div, section');
    let bestScore = 0;
    candidates.forEach(el => {
      const text = el.textContent || '';
      const links = el.querySelectorAll('a');
      const textLen = text.trim().length;
      const linkTextLen = Array.from(links).reduce((sum, a) => sum + (a.textContent || '').length, 0);
      const score = textLen - (linkTextLen * 2);
      if (score > bestScore && textLen > 200) {
        bestScore = score;
        container = el;
      }
    });
  }

  if (!container) container = document.body;

  const clone = container.cloneNode(true);
  const removeSelectors = 'script, style, nav, footer, aside, noscript, iframe, .ad, .ads, .advertisement, .social-share, .share-buttons, .comments, .comment-section, [aria-hidden="true"]';
  clone.querySelectorAll(removeSelectors).forEach(el => el.remove());

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const title = ogTitle ? ogTitle.content : document.title;

  let author = '';
  const authorMeta = document.querySelector('meta[name="author"]') ||
                     document.querySelector('meta[property="article:author"]');
  if (authorMeta) {
    author = authorMeta.content;
  } else {
    const authorEl = document.querySelector('[rel="author"], .author, .byline, [class*="author"]');
    if (authorEl) author = authorEl.textContent.trim();
  }

  let published = '';
  const publishedMeta = document.querySelector('meta[property="article:published_time"]') ||
                        document.querySelector('meta[name="date"]') ||
                        document.querySelector('meta[name="publication_date"]');
  if (publishedMeta) {
    const parsed = new Date(publishedMeta.content);
    if (!isNaN(parsed)) published = parsed.toISOString().split('T')[0];
  } else {
    const timeEl = document.querySelector('time[datetime]');
    if (timeEl) {
      const parsed = new Date(timeEl.getAttribute('datetime'));
      if (!isNaN(parsed)) published = parsed.toISOString().split('T')[0];
    }
  }

  let description = '';
  const descMeta = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]');
  if (descMeta) description = descMeta.content || '';

  const images = [];
  clone.querySelectorAll('img').forEach((img, i) => {
    const src = img.src || img.dataset.src || '';
    if (src && !src.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(src, document.baseURI).href;
        images.push({ url: absoluteUrl, alt: img.alt || '', index: i });
      } catch (e) {}
    }
  });

  return {
    title: title || '',
    author: author || '',
    published,
    description,
    html: clone.innerHTML,
    images
  };
}

function sanitizeFilename(str) {
  return str
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function escapeYaml(str) {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

init();
