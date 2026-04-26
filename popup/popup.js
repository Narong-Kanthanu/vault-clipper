const STORAGE_DEFAULTS = {
  vaults: [],
  selectedVaultId: null,
  defaultFolder: 'raw',
  downloadImages: true
};

const { sanitizeFilename, escapeYaml, extractPageContent, buildFrontmatter } = self.VaultClipperUtils;

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

    const frontmatter = buildFrontmatter({ pageTitle, pageUrl, extracted, tags, now });
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

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

init();
