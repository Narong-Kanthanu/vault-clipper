const DEFAULTS = {
  vaults: [],
  defaultFolder: 'raw',
  downloadImages: true
};

const vaultsList = document.getElementById('vaults-list');
const addVaultBtn = document.getElementById('add-vault');
const defaultFolderInput = document.getElementById('default-folder');
const downloadImagesInput = document.getElementById('download-images-default');
const saveBtn = document.getElementById('save');
const saveStatus = document.getElementById('save-status');
const rowTemplate = document.getElementById('vault-row-template');

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function addVaultRow(vault = { id: makeId(), label: '', path: '' }) {
  const node = rowTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = vault.id;
  node.querySelector('.vault-label').value = vault.label || '';
  node.querySelector('.vault-path').value = vault.path || '';
  node.querySelector('.vault-remove').addEventListener('click', () => node.remove());
  vaultsList.appendChild(node);
}

function readVaultsFromForm() {
  const rows = vaultsList.querySelectorAll('.vault-row');
  const vaults = [];
  rows.forEach(row => {
    const label = row.querySelector('.vault-label').value.trim();
    const path = row.querySelector('.vault-path').value.trim();
    const id = row.dataset.id || makeId();
    if (label && path) {
      vaults.push({ id, label, path });
    }
  });
  return vaults;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  vaultsList.innerHTML = '';
  const vaults = Array.isArray(stored.vaults) && stored.vaults.length > 0
    ? stored.vaults
    : [{ id: makeId(), label: 'Personal', path: '' }];
  vaults.forEach(addVaultRow);

  defaultFolderInput.value = stored.defaultFolder || DEFAULTS.defaultFolder;
  downloadImagesInput.checked = stored.downloadImages !== false;
}

function showStatus(message, kind = '') {
  saveStatus.textContent = message;
  saveStatus.className = 'save-status' + (kind ? ' ' + kind : '');
  if (message) {
    setTimeout(() => {
      saveStatus.textContent = '';
      saveStatus.className = 'save-status';
    }, 2500);
  }
}

async function saveSettings() {
  const vaults = readVaultsFromForm();
  const defaultFolder = defaultFolderInput.value.trim() || DEFAULTS.defaultFolder;
  const downloadImages = downloadImagesInput.checked;

  if (vaults.length === 0) {
    showStatus('Add at least one vault with a label and path.', 'error');
    return;
  }

  const stored = await chrome.storage.local.get(['selectedVaultId']);
  const selectedId = stored.selectedVaultId;
  const selectedVaultId = vaults.some(v => v.id === selectedId) ? selectedId : vaults[0].id;

  await chrome.storage.local.set({
    vaults,
    defaultFolder,
    downloadImages,
    selectedVaultId
  });
  showStatus('Saved.', 'success');
  setTimeout(closeOptionsTab, 600);
}

async function closeOptionsTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab && tab.id != null) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch {
    // fall through to window.close()
  }
  window.close();
}

addVaultBtn.addEventListener('click', () => addVaultRow());
saveBtn.addEventListener('click', saveSettings);

loadSettings();
