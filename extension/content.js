/** Content script: JD capture FAB + message bridge to popup. */

let abLastJd = null;
let abJdRefreshTimer = null;

function abReadCurrentJd() {
  return typeof abExtractJobPage === 'function'
    ? abExtractJobPage()
    : { ready: false, message: 'Extractor not loaded.' };
}

function abJdSignature(jd) {
  return `${jd?.pageType || ''}|${jd?.role || ''}|${jd?.company || ''}|${(jd?.description || '').length}`;
}

function abRefreshCachedJd() {
  const jd = abReadCurrentJd();
  const changed = abJdSignature(jd) !== abJdSignature(abLastJd);
  abLastJd = jd;
  if (changed) {
    try {
      chrome.runtime.sendMessage({ type: 'JD_UPDATED', jd });
    } catch {
      /* popup may be closed */
    }
  }
  return jd;
}

function abScheduleJdRefresh() {
  clearTimeout(abJdRefreshTimer);
  abJdRefreshTimer = setTimeout(() => abRefreshCachedJd(), 300);
}

function abIsSpaBoard() {
  const host = (location.hostname || '').toLowerCase();
  return host.includes('wellfound.com') || host.includes('angel.co') || host.includes('linkedin.com');
}

function abInstallSpaWatchers() {
  if (!abIsSpaBoard()) return;

  window.addEventListener('popstate', abScheduleJdRefresh);

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function patchedHistoryState(...args) {
      const result = original.apply(this, args);
      abScheduleJdRefresh();
      return result;
    };
  }

  const observer = new MutationObserver(abScheduleJdRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  abRefreshCachedJd();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_JD') {
    sendResponse(abRefreshCachedJd());
  }
  return true;
});

function mountCaptureFab() {
  if (document.querySelector('.ab-fab-capture')) return;
  const btn = document.createElement('button');
  btn.className = 'ab-fab ab-fab-capture';
  btn.innerHTML = typeof abFabLabel === 'function' ? abFabLabel('Capture JD') : 'Capture JD';
  btn.title = 'Capture this job in Twerz';
  btn.addEventListener('click', () => openCapturePanel());
  document.body.appendChild(btn);
}

async function sendBg(message) {
  return typeof abSendBg === 'function'
    ? abSendBg(message)
    : new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function openCapturePanel() {
  if (document.querySelector('.ab-capture-panel')) return;
  const jd = abRefreshCachedJd();

  const panel = document.createElement('div');
  panel.className = 'ab-sidebar ab-capture-panel';
  panel.innerHTML = `
    <div class="ab-sidebar-header">
      ${typeof abBrandHeader === 'function' ? abBrandHeader('Twerz', 'Capture job') : '<strong>Capture job</strong>'}
      <button class="ab-close" aria-label="Close">×</button>
    </div>
    <div class="ab-body">
      <div class="ab-warn" id="ab-cap-warn" style="${jd.ready ? 'display:none' : ''}">${jd.message || 'Edit fields if needed.'}</div>
      <label class="ab-field-label">Company<input id="ab-cap-company" value="${escapeAttr(jd.company || '')}" /></label>
      <label class="ab-field-label">Role<input id="ab-cap-role" value="${escapeAttr(jd.role || '')}" /></label>
      <label class="ab-field-label">Description<textarea id="ab-cap-desc" rows="5">${escapeHtml(jd.description || '')}</textarea></label>
      <button class="ab-btn ab-btn-primary" id="ab-cap-submit" ${jd.ready ? '' : ''}>Capture &amp; analyze</button>
      <div class="ab-status"></div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.ab-close').addEventListener('click', () => panel.remove());

  sendBg({ type: 'API_FETCH', path: '/extension/me' }).then((me) => {
    if (me.error || !me.profiles?.length) return;
    panel.dataset.profileId = String(me.profiles[0].id);
  });

  const submitBtn = panel.querySelector('#ab-cap-submit');
  const validate = () => {
    const errors = typeof abValidateCaptureFields === 'function'
      ? abValidateCaptureFields({
          profileId: Number(panel.dataset.profileId),
          company: panel.querySelector('#ab-cap-company').value.trim(),
          role: panel.querySelector('#ab-cap-role').value.trim(),
          description: panel.querySelector('#ab-cap-desc').value.trim(),
        })
      : [];
    submitBtn.disabled = errors.length > 0;
    return errors;
  };

  panel.querySelectorAll('input, textarea').forEach((el) => el.addEventListener('input', validate));
  validate();

  submitBtn.addEventListener('click', async () => {
    const status = panel.querySelector('.ab-status');
    const errors = validate();
    if (errors.length) {
      status.textContent = errors.join(' ');
      return;
    }
    status.textContent = 'Creating job…';
    try {
      const resp = await sendBg({
        type: 'API_FETCH',
        path: '/extension/capture-job',
        options: {
          method: 'POST',
          body: JSON.stringify({
            profile_id: Number(panel.dataset.profileId),
            company: panel.querySelector('#ab-cap-company').value.trim(),
            role: panel.querySelector('#ab-cap-role').value.trim(),
            description: panel.querySelector('#ab-cap-desc').value.trim(),
            source_url: location.href,
          }),
        },
      });
      if (resp.error) throw new Error(resp.error);
      const cfg = await sendBg({ type: 'GET_CONFIG' });
      status.textContent = `Job #${resp.job_id} created.`;
      sendBg({ type: 'START_JOB_POLL', jobId: resp.job_id });
      chrome.runtime.sendMessage({ type: 'OPEN_TAB', url: `${cfg.appBase}${resp.open_url}` });
    } catch (err) {
      status.textContent = String(err.message || err);
    }
  });
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (
  typeof abIsApplyFormPage !== 'function' ||
  (!abIsApplyFormPage() &&
    !location.pathname.toLowerCase().includes('/apply') &&
    !location.pathname.toLowerCase().includes('/applications'))
) {
  mountCaptureFab();
  abInstallSpaWatchers();
}
