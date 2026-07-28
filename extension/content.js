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
      <label class="ab-field-label" id="ab-cap-profile-wrap" style="display:none;">Profile<select id="ab-cap-profile"></select></label>
      <label class="ab-field-label">Company<input id="ab-cap-company" value="${escapeAttr(jd.company || '')}" /></label>
      <label class="ab-field-label">Role<input id="ab-cap-role" value="${escapeAttr(jd.role || '')}" /></label>
      <label class="ab-field-label">Description<textarea id="ab-cap-desc" rows="5">${escapeHtml(jd.description || '')}</textarea></label>
      <button class="ab-btn ab-btn-primary" id="ab-cap-submit" disabled>Capture &amp; analyze</button>
      <div id="ab-cap-results" style="display:none;"></div>
      <div class="ab-status"></div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.ab-close').addEventListener('click', () => panel.remove());

  const submitBtn = panel.querySelector('#ab-cap-submit');
  const resultsHost = panel.querySelector('#ab-cap-results');
  const statusEl = panel.querySelector('.ab-status');
  let resultsController = null;
  const defaultSubmitLabel = 'Capture & analyze';

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
    if (errors.length && panel.dataset.profileId) {
      statusEl.textContent = errors.join(' ');
    } else if (panel.dataset.profileId) {
      statusEl.textContent = '';
    }
    return errors;
  };

  async function loadProfiles() {
    statusEl.textContent = 'Loading profile…';
    const me = await sendBg({ type: 'API_FETCH', path: '/extension/me' });
    if (me.error) {
      statusEl.textContent =
        me.status === 401
          ? 'Connect your Twerz account in the extension popup first.'
          : me.error;
      submitBtn.disabled = true;
      return;
    }
    if (!me.profiles?.length) {
      statusEl.textContent = 'Upload a ready profile in Twerz first.';
      submitBtn.disabled = true;
      return;
    }

    const profileWrap = panel.querySelector('#ab-cap-profile-wrap');
    const profileSelect = panel.querySelector('#ab-cap-profile');
    profileSelect.innerHTML = '';
    for (const profile of me.profiles) {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.label;
      profileSelect.appendChild(opt);
    }
    if (me.profiles.length > 1) {
      profileWrap.style.display = '';
    }
    panel.dataset.profileId = String(me.profiles[0].id);
    profileSelect.addEventListener('change', () => {
      panel.dataset.profileId = profileSelect.value;
      validate();
    });
    statusEl.textContent = '';
    validate();
  }

  panel.querySelectorAll('input, textarea').forEach((el) => el.addEventListener('input', validate));
  loadProfiles();

  submitBtn.addEventListener('click', async () => {
    const errors = validate();
    if (errors.length) {
      statusEl.textContent = errors.join(' ');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.classList.add('ab-btn--loading');
    submitBtn.textContent = 'Capturing…';
    statusEl.textContent = 'Creating job…';
    try {
      const result = await abRunCaptureFlow({
        profileId: Number(panel.dataset.profileId),
        company: panel.querySelector('#ab-cap-company').value.trim(),
        role: panel.querySelector('#ab-cap-role').value.trim(),
        description: panel.querySelector('#ab-cap-desc').value.trim(),
        sourceUrl: location.href,
        onStatus: (text) => {
          if (text) statusEl.textContent = text;
        },
      });
      if (!result.ok) {
        statusEl.textContent = result.error?.error || 'Capture failed';
        submitBtn.textContent = defaultSubmitLabel;
        submitBtn.classList.remove('ab-btn--loading');
        validate();
        return;
      }
      panel.querySelector('#ab-cap-profile-wrap')?.style.setProperty('display', 'none');
      panel.querySelectorAll('#ab-cap-company, #ab-cap-role, #ab-cap-desc').forEach((el) => {
        el.closest('label')?.style.setProperty('display', 'none');
      });
      submitBtn.style.display = 'none';
      resultsHost.style.display = 'block';
      resultsHost.innerHTML = abRenderResultsHtml(result.status, { showDashboardLink: true });
      resultsController?.destroy?.();
      resultsController = abBindResultsPanel(resultsHost, { jobId: result.jobId, status: result.status });
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = String(err.message || err);
      submitBtn.textContent = defaultSubmitLabel;
      submitBtn.classList.remove('ab-btn--loading');
      validate();
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
