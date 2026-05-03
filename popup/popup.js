'use strict';

const STORAGE_DEFAULTS = {
  vaults: [],
  selectedVaultId: null,
  defaultFolder: 'raw',
  downloadImages: true
};

// --- Storage ---------------------------------------------------------------

async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);
  return { ...STORAGE_DEFAULTS, ...stored };
}

function saveSetting(partial) {
  return chrome.storage.local.set(partial);
}

// --- Active tab ------------------------------------------------------------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function runInTab(tab, func) {
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
  return results && results[0] ? results[0].result : null;
}

// Runs in the target page; must be self-contained (chrome.scripting serializes it).
function readTitleMetaInPage() {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  return { title: (ogTitle ? ogTitle.content : document.title) || '' };
}

// --- DOM handles -----------------------------------------------------------

const els = {
  needsSetup: document.getElementById('needs-setup'),
  main: document.getElementById('main'),
  vaultToggle: document.getElementById('vault-toggle'),
  titleInput: document.getElementById('title-input'),
  tagsInput: document.getElementById('tags-input'),
  downloadImages: document.getElementById('download-images'),
  clipBtn: document.getElementById('clip-btn'),
  status: document.getElementById('status'),
  openOptionsBtn: document.getElementById('open-options'),
  openOptionsCtaBtn: document.getElementById('open-options-cta')
};

// --- UI --------------------------------------------------------------------

function renderVaultButtons(vaults, selectedId, onSelect) {
  els.vaultToggle.replaceChildren();
  vaults.forEach(vault => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vault-btn' + (vault.id === selectedId ? ' active' : '');
    btn.dataset.vaultId = vault.id;
    btn.textContent = vault.label;
    btn.addEventListener('click', () => onSelect(vault.id));
    els.vaultToggle.appendChild(btn);
  });
}

function highlightSelectedVault(vaultId) {
  els.vaultToggle.querySelectorAll('.vault-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.vaultId === vaultId);
  });
}

function setStatus(msg, type) {
  els.status.textContent = msg;
  els.status.className = 'status' + (type ? ' ' + type : '');
}

function showSetupPrompt() {
  els.needsSetup.hidden = false;
  els.main.hidden = true;
}

function showMain() {
  els.needsSetup.hidden = true;
  els.main.hidden = false;
}

// --- Open options ----------------------------------------------------------

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
}

// --- Clip orchestrator -----------------------------------------------------

let settings = { ...STORAGE_DEFAULTS };

async function clipActiveTab() {
  els.clipBtn.disabled = true;
  setStatus('Extracting page content...', 'working');

  try {
    const vault = settings.vaults.find(v => v.id === settings.selectedVaultId);
    if (!vault) throw new Error('No vault selected');
    if (!vault.path) throw new Error('Selected vault has no path configured');

    const tab = await getActiveTab();
    if (!tab) throw new Error('No active tab found');

    const extracted = await runInTab(tab, self.VaultClipperUtils.extractPageContent);
    if (!extracted) throw new Error('Failed to extract page content');

    const payload = self.VaultClipperClipper.buildClipPayload({
      extracted,
      pageUrl: tab.url,
      pageTitle: els.titleInput.value,
      rawTags: els.tagsInput.value
    });

    setStatus('Saving to vault...', 'working');

    const folder = settings.defaultFolder || 'raw';
    const response = await chrome.runtime.sendMessage({
      action: 'save-to-vault',
      vaultPath: vault.path,
      folder,
      filename: payload.filename,
      content: payload.content,
      images: payload.images,
      downloadImages: els.downloadImages.checked
    });

    if (!response || !response.success) {
      throw new Error(response ? response.error : 'No response from native host');
    }

    const imgMsg = response.images_downloaded > 0
      ? ` | ${response.images_downloaded} images saved`
      : '';
    setStatus(`Clipped to ${vault.label}/${folder}/${payload.filename}${imgMsg}`, 'success');
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    console.error('Vault Clipper error:', err);
  } finally {
    els.clipBtn.disabled = false;
  }
}

// --- Bootstrap -------------------------------------------------------------

async function init() {
  els.openOptionsBtn.addEventListener('click', openOptions);
  els.openOptionsCtaBtn.addEventListener('click', openOptions);
  els.clipBtn.addEventListener('click', clipActiveTab);
  els.downloadImages.addEventListener('change', () => {
    saveSetting({ downloadImages: els.downloadImages.checked });
  });

  settings = await loadSettings();

  if (!Array.isArray(settings.vaults) || settings.vaults.length === 0) {
    showSetupPrompt();
    return;
  }

  if (!settings.vaults.some(v => v.id === settings.selectedVaultId)) {
    settings.selectedVaultId = settings.vaults[0].id;
  }

  showMain();
  renderVaultButtons(settings.vaults, settings.selectedVaultId, vaultId => {
    settings.selectedVaultId = vaultId;
    saveSetting({ selectedVaultId: vaultId });
    highlightSelectedVault(vaultId);
  });
  els.downloadImages.checked = settings.downloadImages !== false;

  try {
    const tab = await getActiveTab();
    if (tab) {
      const meta = await runInTab(tab, readTitleMetaInPage);
      els.titleInput.value = (meta && meta.title) || '';
    }
  } catch (e) {
    els.titleInput.value = '';
  }
}

init();
