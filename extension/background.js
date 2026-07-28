const DEFAULT_API_BASE = 'http://localhost:8000';
const DEFAULT_APP_BASE = 'http://localhost:3000';
const POLL_MS = 3000;
const activePolls = new Map();

async function getConfig() {
  const stored = await chrome.storage.local.get(['apiBase', 'appBase', 'token', 'allowEeoc']);
  return {
    apiBase: (stored.apiBase || DEFAULT_API_BASE).replace(/\/$/, ''),
    appBase: (stored.appBase || DEFAULT_APP_BASE).replace(/\/$/, ''),
    token: stored.token || '',
    allowEeoc: Boolean(stored.allowEeoc),
  };
}

async function apiFetch(path, options = {}) {
  const { apiBase, token } = await getConfig();
  if (!token) {
    throw new Error('Not connected. Open Twerz and connect the extension.');
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    let message = data.message || res.statusText;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item) => item.msg || item.message || `${item.loc?.join('.')}: ${item.type}`)
        .filter(Boolean)
        .join(' · ');
    } else if (detail && typeof detail === 'object') {
      message = detail.message || detail.msg || message;
    }
    throw new Error(message || 'Request failed');
  }
  return data;
}

function setBadge(data) {
  if (!data) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  if (data.ready_to_apply) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });
    chrome.action.setTitle({ title: 'Ready to apply' });
    return;
  }
  if (data.phase === 'failed') {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    chrome.action.setTitle({ title: 'Generation failed — open dashboard' });
    return;
  }
  chrome.action.setBadgeText({ text: '…' });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  chrome.action.setTitle({ title: 'Generating tailored resume…' });
}

function stopJobPoll(jobId) {
  const timer = activePolls.get(jobId);
  if (timer) {
    clearInterval(timer);
    activePolls.delete(jobId);
  }
}

async function pollJobOnce(jobId) {
  const data = await apiFetch(`/extension/jobs/${jobId}/status`);
  setBadge(data);
  if (data.ready_to_apply || data.phase === 'failed') {
    stopJobPoll(jobId);
  }
  return data;
}

function startJobPoll(jobId) {
  if (!jobId || activePolls.has(jobId)) return;
  pollJobOnce(jobId).catch(() => setBadge(null));
  activePolls.set(
    jobId,
    setInterval(() => {
      pollJobOnce(jobId).catch(() => setBadge(null));
    }, POLL_MS),
  );
}

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'AUTH' && msg.token) {
    const payload = {
      token: msg.token,
      apiBase: (msg.apiBase || DEFAULT_API_BASE).replace(/\/$/, ''),
      appBase: (msg.appBase || DEFAULT_APP_BASE).replace(/\/$/, ''),
    };
    chrome.storage.local.set(payload, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_CONFIG') {
    getConfig().then(sendResponse);
    return true;
  }
  if (msg?.type === 'API_FETCH') {
    apiFetch(msg.path, msg.options || {})
      .then(sendResponse)
      .catch((err) => sendResponse({ error: String(err.message || err) }));
    return true;
  }
  if (msg?.type === 'DISCONNECT') {
    chrome.storage.local.remove(['token'], () => {
      setBadge(null);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg?.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: msg.url }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'START_JOB_POLL') {
    startJobPoll(msg.jobId);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'STOP_JOB_POLL') {
    stopJobPoll(msg.jobId);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
