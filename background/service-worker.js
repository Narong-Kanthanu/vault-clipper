const NATIVE_HOST = 'com.vaultclipper.host';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save-to-vault') {
    handleSaveToVault(message)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleSaveToVault(message) {
  const payload = {
    action: 'clip',
    vault_path: message.vaultPath,
    folder: message.folder,
    filename: message.filename,
    content: message.content,
    images: message.images || [],
    download_images: message.downloadImages || false
  };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from native host'));
        return;
      }
      resolve(response);
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
