document.querySelectorAll('[data-brand-logo]').forEach((img) => {
  const size = img.getAttribute('data-brand-logo') || '32';
  img.src = chrome.runtime.getURL(`icons/icon${size}.png`);
});

document.getElementById('save').addEventListener('click', () => {
  const allowEeoc = document.getElementById('allowEeoc').checked;
  chrome.storage.local.set({ allowEeoc }, () => {
    document.getElementById('status').textContent = 'Settings saved.';
  });
});

chrome.storage.local.get(['allowEeoc'], (stored) => {
  document.getElementById('allowEeoc').checked = Boolean(stored.allowEeoc);
});
