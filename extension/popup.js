const DEFAULT_API_BASE = 'http://localhost:8000';
const DEFAULT_APP_BASE = 'http://localhost:3000';

document.getElementById('brandLogo').src = chrome.runtime.getURL('icons/icon32.png');

function sendBg(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function showPanel(connected) {
  document.getElementById('auth-panel').style.display = connected ? 'none' : 'block';
  document.getElementById('capture-panel').style.display = connected ? 'block' : 'none';
}

function setPageStatus(jd) {
  const pill = document.getElementById('pageStatus');
  const alert = document.getElementById('pageAlert');
  const ctx = document.getElementById('pageContext');

  pill.className = 'status-pill';
  if (jd.ready) {
    pill.classList.add('status-pill--ready');
    pill.textContent = '✓ Ready to capture';
    alert.style.display = 'none';
  } else if (jd.pageType === 'listing') {
    pill.classList.add('status-pill--bad');
    pill.textContent = '⚠ Open a job detail page';
    alert.style.display = 'block';
    alert.className = 'alert alert-warn';
    alert.textContent = jd.message;
  } else {
    pill.classList.add('status-pill--warn');
    pill.textContent = 'Needs manual edit';
    alert.style.display = 'block';
    alert.className = 'alert alert-warn';
    alert.textContent = jd.message;
  }

  ctx.innerHTML = `<strong>${abBoardName()}</strong> · ${jd.source} · confidence: ${jd.confidence || 'none'}`;
}

function updateDescMeta() {
  const description = document.getElementById('description').value.trim();
  const countEl = document.getElementById('descCount');
  const metaEl = document.getElementById('descMeta');
  countEl.textContent = String(description.length);
  metaEl.classList.toggle('field-meta--bad', description.length < AB_MIN_DESC);
  updateCaptureButton();
}

function updateCaptureButton() {
  const btn = document.getElementById('capture');
  const errors = abValidateCaptureFields({
    profileId: Number(document.getElementById('profileId').value),
    company: document.getElementById('company').value.trim(),
    role: document.getElementById('role').value.trim(),
    description: document.getElementById('description').value.trim(),
  });
  btn.disabled = errors.length > 0;
  btn.title = errors.join(' ');
}

function applyJdToForm(jd, { preserveManualEdits = false } = {}) {
  if (!preserveManualEdits || !document.getElementById('company').value) {
    document.getElementById('company').value = jd.company || '';
  }
  if (!preserveManualEdits || !document.getElementById('role').value) {
    document.getElementById('role').value = jd.role || '';
  }
  if (!preserveManualEdits || !document.getElementById('description').value) {
    document.getElementById('description').value = jd.description || '';
  }
  setPageStatus(jd);
  updateDescMeta();
}

async function scanActiveTab({ preserveManualEdits = false } = {}) {
  const status = document.getElementById('status');
  status.textContent = '';
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    applyJdToForm(
      abBuildResult({ pageType: 'unknown', message: 'No active tab found.' }),
      { preserveManualEdits },
    );
    return;
  }

  try {
    const jd = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JD' });
    applyJdToForm(jd, { preserveManualEdits });
  } catch {
    applyJdToForm(
      abBuildResult({
        pageType: 'unknown',
        message: 'Cannot read this page. Open a supported job board or paste the JD manually.',
      }),
      { preserveManualEdits },
    );
  }
}

async function saveBases() {
  const apiBase = document.getElementById('apiBase').value.replace(/\/$/, '');
  const appBase = document.getElementById('appBase').value.replace(/\/$/, '');
  await chrome.storage.local.set({ apiBase, appBase });
  return { apiBase, appBase };
}

async function loadSession() {
  const cfg = await sendBg({ type: 'GET_CONFIG' });
  if (cfg.apiBase) document.getElementById('apiBase').value = cfg.apiBase;
  if (cfg.appBase) document.getElementById('appBase').value = cfg.appBase;
  if (!cfg.token) {
    showPanel(false);
    return;
  }
  try {
    const me = await sendBg({ type: 'API_FETCH', path: '/extension/me' });
    if (me.error) throw new Error(me.error);
    showPanel(true);
    document.getElementById('connected-as').textContent = me.email;
    const select = document.getElementById('profileId');
    select.innerHTML = '';
    for (const profile of me.profiles || []) {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.label;
      select.appendChild(opt);
    }
    if (!me.profiles?.length) {
      document.getElementById('status').textContent = 'Upload a ready profile in Twerz first.';
      document.getElementById('capture').disabled = true;
    } else {
      await scanActiveTab();
    }
  } catch (err) {
    showPanel(false);
    document.getElementById('authStatus').textContent = String(err.message || err);
  }
}

document.getElementById('toggleAdvanced').addEventListener('click', () => {
  const panel = document.getElementById('advancedPanel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('connect').addEventListener('click', async () => {
  const { appBase } = await saveBases();
  chrome.tabs.create({ url: `${appBase}/extension/connect?extension_id=${chrome.runtime.id}` });
});

document.getElementById('disconnect').addEventListener('click', async () => {
  await sendBg({ type: 'DISCONNECT' });
  showPanel(false);
});

document.getElementById('refresh').addEventListener('click', () => scanActiveTab({ preserveManualEdits: false }));

document.getElementById('openDashboard').addEventListener('click', async () => {
  const cfg = await sendBg({ type: 'GET_CONFIG' });
  chrome.tabs.create({ url: `${cfg.appBase}/dashboard/extension` });
});

['company', 'role', 'description'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateDescMeta);
});
document.getElementById('profileId').addEventListener('change', updateCaptureButton);

document.getElementById('capture').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('capture');
  const profileId = Number(document.getElementById('profileId').value);
  const company = document.getElementById('company').value.trim();
  const role = document.getElementById('role').value.trim();
  const description = document.getElementById('description').value.trim();

  const errors = abValidateCaptureFields({ profileId, company, role, description });
  if (errors.length) {
    status.textContent = errors.join(' ');
    return;
  }

  btn.disabled = true;
  status.textContent = 'Creating job…';
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const sourceUrl = tabs[0]?.url || null;
    const resp = await sendBg({
      type: 'API_FETCH',
      path: '/extension/capture-job',
      options: {
        method: 'POST',
        body: JSON.stringify({ profile_id: profileId, company, role, description, source_url: sourceUrl }),
      },
    });
    if (resp.error) throw new Error(resp.error);
    status.textContent = `Job #${resp.job_id} created — opening dashboard…`;
    sendBg({ type: 'START_JOB_POLL', jobId: resp.job_id });
    const cfg = await sendBg({ type: 'GET_CONFIG' });
    chrome.tabs.create({ url: `${cfg.appBase}${resp.open_url}` });
  } catch (err) {
    status.textContent = String(err.message || err);
  } finally {
    updateCaptureButton();
  }
});

loadSession();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'JD_UPDATED' && msg.jd) {
    applyJdToForm(msg.jd);
  }
});
