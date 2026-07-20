document.getElementById('capture').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const apiBase = document.getElementById('apiBase').value.replace(/\/$/, '');
  const token = document.getElementById('token').value.trim();
  const profileId = Number(document.getElementById('profileId').value);
  const company = document.getElementById('company').value.trim();
  const role = document.getElementById('role').value.trim();
  const description = document.getElementById('description').value.trim();

  status.textContent = 'Creating…';
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = tabs[0];
    const sourceUrl = page?.url || null;
    const res = await fetch(`${apiBase}/extension/capture-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profile_id: profileId, company, role, description, source_url: sourceUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || res.statusText);
    status.textContent = `Created job #${data.job_id}. Opening…`;
    const appBase = apiBase.includes('8000') ? 'http://localhost:3000' : apiBase;
    chrome.tabs.create({ url: `${appBase}${data.open_url}` });
  } catch (err) {
    status.textContent = String(err.message || err);
  }
});

function showWarn(msg) {
  const el = document.getElementById('warn');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// Prefill from content script (LinkedIn / Naukri / Indeed)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0]?.id;
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: 'GET_JD' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      showWarn('Could not read this page. Paste the JD manually.');
      return;
    }
    if (resp.company) document.getElementById('company').value = resp.company;
    if (resp.role) document.getElementById('role').value = resp.role;
    if (resp.description) document.getElementById('description').value = resp.description;
    if (resp.warning || !resp.description) {
      showWarn(
        'Could not find a clean job description on this page. Paste the JD manually to avoid capturing nav/ads.'
      );
    } else {
      showWarn('');
    }
  });
});
