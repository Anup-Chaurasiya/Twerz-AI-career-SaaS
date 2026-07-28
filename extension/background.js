const DEFAULT_API_BASE = 'http://localhost:8000';
const DEFAULT_APP_BASE = 'http://localhost:3000';
const POLL_ALARM = 'jobPoll';
const POLL_INTERVAL_MS = 3000;
const POLL_JOB_KEY = 'pollActiveJobId';
const LAST_JOB_KEY = 'pollLastActiveJobId';

importScripts('badge-utils.js');

const HAS_ALARMS = Boolean(chrome.alarms?.create && chrome.alarms?.onAlarm?.addListener);

let memActiveJobId = null;
let pollTimerId = null;

function storageGet(keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  return chrome.storage.local
    .get(keyList.length === 1 ? keyList[0] : keyList)
    .catch((err) => {
      console.warn('[Twerz] storage get failed:', err);
      return {};
    });
}

function storageSet(items) {
  return chrome.storage.local.set(items).catch((err) => {
    console.warn('[Twerz] storage set failed:', err);
  });
}

function storageRemove(keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  return chrome.storage.local.remove(keyList).catch((err) => {
    console.warn('[Twerz] storage remove failed:', err);
  });
}

function cancelScheduledPoll() {
  if (pollTimerId != null) {
    clearTimeout(pollTimerId);
    pollTimerId = null;
  }
  if (HAS_ALARMS) {
    chrome.alarms.clear(POLL_ALARM).catch(() => {});
  }
}

async function scheduleNextPoll() {
  if (HAS_ALARMS) {
    try {
      await chrome.alarms.create(POLL_ALARM, { when: Date.now() + POLL_INTERVAL_MS });
    } catch (err) {
      console.warn('[Twerz] alarm create failed, falling back to timer:', err);
      scheduleTimerPoll();
    }
    return;
  }
  scheduleTimerPoll();
}

function scheduleTimerPoll() {
  if (pollTimerId != null) return;
  pollTimerId = setTimeout(async () => {
    pollTimerId = null;
    try {
      const jobId = await getActivePollJobId();
      if (!jobId) return;
      await pollJobOnce(jobId);
    } catch (err) {
      console.error('[Twerz] poll timer failed:', err);
    }
  }, POLL_INTERVAL_MS);
}

async function getConfig() {
  const stored = await storageGet(['apiBase', 'appBase', 'token', 'allowEeoc']);
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
    return { error: 'Not connected. Open Twerz and connect the extension.', status: 401 };
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  try {
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
      if (res.status === 401) {
        await chrome.storage.local.remove(['token']);
      }
      console.warn('[Twerz] apiFetch HTTP', res.status, path, message);
      return { error: message || 'Request failed', status: res.status, paywall: data.paywall || null };
    }
    return data;
  } catch (err) {
    console.warn('[Twerz] apiFetch network error:', apiBase, path, err);
    return { error: String(err.message || err), status: 0 };
  }
}

function setBadge(data) {
  try {
    const badge = abMapBadgeFromStatus(data);
    chrome.action.setBadgeText({ text: badge.text });
    chrome.action.setBadgeBackgroundColor({ color: badge.color });
    chrome.action.setTitle({ title: badge.title });
  } catch (err) {
    console.warn('[Twerz] setBadge failed:', err);
  }
}

async function storeLastJobStatus(jobId, status) {
  memActiveJobId = jobId;
  await storageSet({
    [`pollLastStatus:${jobId}`]: status,
    [LAST_JOB_KEY]: jobId,
  });
}

async function getActivePollJobId() {
  if (memActiveJobId) return memActiveJobId;
  const stored = await storageGet(POLL_JOB_KEY);
  memActiveJobId = stored[POLL_JOB_KEY] || null;
  return memActiveJobId;
}

async function setActivePollJobId(jobId) {
  memActiveJobId = jobId || null;
  if (jobId) {
    await storageSet({ [POLL_JOB_KEY]: jobId });
  } else {
    await storageRemove(POLL_JOB_KEY);
  }
}

async function clearPollState() {
  memActiveJobId = null;
  cancelScheduledPoll();
  await storageRemove(POLL_JOB_KEY);
}

function shouldStopPolling(data) {
  return Boolean(data?.ready_to_apply || data?.phase === 'failed');
}

function shouldRetryPolling(data) {
  if (!data?.error) return true;
  return data.status !== 401 && data.status !== 402;
}

async function pollJobOnce(jobId) {
  const data = await apiFetch(`/extension/jobs/${jobId}/status`);
  if (data.error) {
    if (data.status === 401 || data.status === 402) {
      await clearPollState();
    } else {
      await scheduleNextPoll();
    }
    return data;
  }
  setBadge(data);
  await storeLastJobStatus(jobId, data);
  try {
    chrome.runtime.sendMessage({ type: 'JOB_STATUS', jobId, status: data });
  } catch {
    /* no listeners */
  }
  if (shouldStopPolling(data)) {
    await clearPollState();
  } else if (shouldRetryPolling(data)) {
    await scheduleNextPoll();
  }
  return data;
}

async function startJobPoll(jobId) {
  if (!jobId) return;
  cancelScheduledPoll();
  await setActivePollJobId(jobId);
  await pollJobOnce(jobId);
}

async function resumePollIfNeeded() {
  const jobId = await getActivePollJobId();
  if (!jobId) return;
  if (HAS_ALARMS) {
    try {
      const alarms = await chrome.alarms.getAll();
      if (!alarms.some((a) => a.name === POLL_ALARM)) {
        await scheduleNextPoll();
      }
    } catch {
      await scheduleNextPoll();
    }
  } else if (pollTimerId == null) {
    await scheduleNextPoll();
  }
}

if (HAS_ALARMS) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== POLL_ALARM) return;
    (async () => {
      try {
        const jobId = await getActivePollJobId();
        if (!jobId) {
          await clearPollState();
          return;
        }
        await pollJobOnce(jobId);
      } catch (err) {
        console.error('[Twerz] poll alarm failed:', err);
      }
    })();
  });
} else {
  console.warn('[Twerz] chrome.alarms unavailable — using timer polling. Reload extension to enable alarms.');
}

chrome.runtime.onStartup.addListener(() => {
  resumePollIfNeeded();
});

chrome.runtime.onInstalled.addListener(() => {
  resumePollIfNeeded();
});

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'AUTH' && msg.token) {
    chrome.storage.local.set(
      {
        token: msg.token,
        apiBase: (msg.apiBase || DEFAULT_API_BASE).replace(/\/$/, ''),
        appBase: (msg.appBase || DEFAULT_APP_BASE).replace(/\/$/, ''),
      },
      () => sendResponse({ ok: true }),
    );
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
    apiFetch(msg.path, msg.options || {}).then(sendResponse);
    return true;
  }
  if (msg?.type === 'DISCONNECT') {
    chrome.storage.local.remove(['token'], () => {
      setBadge(null);
      clearPollState().then(() => sendResponse({ ok: true }));
    });
    return true;
  }
  if (msg?.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: msg.url }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'START_JOB_POLL') {
    startJobPoll(msg.jobId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[Twerz] startJobPoll failed:', err);
        sendResponse({ ok: false, error: String(err.message || err) });
      });
    return true;
  }
  if (msg?.type === 'UPDATE_BADGE') {
    setBadge(msg.status || null);
    if (msg.jobId && msg.status) {
      storeLastJobStatus(msg.jobId, msg.status).then(() => sendResponse({ ok: true }));
    } else {
      sendResponse({ ok: true });
    }
    return true;
  }
  if (msg?.type === 'STOP_JOB_POLL') {
    clearPollState().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'GET_LAST_JOB_STATUS') {
    storageGet([`pollLastStatus:${msg.jobId}`, LAST_JOB_KEY]).then((data) =>
      sendResponse(data[`pollLastStatus:${msg.jobId}`] || null),
    );
    return true;
  }
  if (msg?.type === 'GET_LAST_ACTIVE_JOB') {
    storageGet(LAST_JOB_KEY).then((data) => sendResponse(data[LAST_JOB_KEY] || null));
    return true;
  }
  return false;
});

resumePollIfNeeded();
