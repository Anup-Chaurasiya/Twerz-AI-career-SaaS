/**
 * Shared capture → analyze → results → generate orchestration for popup and content sidebar.
 * Depends on: abSendBg (form-utils), abTrackEvent/abDefensiveStatus (telemetry.js)
 */

async function abRunCaptureFlow({
  profileId,
  company,
  role,
  description,
  sourceUrl,
  onPhase,
  onStatus,
}) {
  const emit = (phase, extra = {}) => {
    onPhase?.(phase, extra);
  };
  const setStatus = (text) => onStatus?.(text);

  abTrackEvent('capture_started');
  emit('capturing');
  setStatus('Creating job…');

  const captureResp = await abSendBg({
    type: 'API_FETCH',
    path: '/extension/capture-job',
    options: {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        company,
        role,
        description,
        source_url: sourceUrl,
      }),
    },
  });

  if (captureResp.error) {
    abTrackEvent('capture_done', null, { ok: false });
    emit('error', { step: 'capture', error: captureResp, message: captureResp.error });
    return { ok: false, step: 'capture', error: captureResp };
  }

  const jobId = captureResp.job_id;
  abTrackEvent('capture_done', jobId, { ok: true });

  abTrackEvent('analyze_started', jobId);
  emit('analyzing', { jobId });
  setStatus('Analyzing fit…');

  const analyzeResp = await abSendBg({
    type: 'API_FETCH',
    path: `/extension/jobs/${jobId}/analyze-fit`,
    options: { method: 'POST' },
  });

  if (analyzeResp.error) {
    abTrackEvent('analyze_failed', jobId);
    emit('error', { step: 'analyze', jobId, error: analyzeResp, message: analyzeResp.error });
    return { ok: false, step: 'analyze', jobId, error: analyzeResp };
  }

  abTrackEvent('analyze_done', jobId);
  const status = abDefensiveStatus(analyzeResp);
  abSendBg({ type: 'UPDATE_BADGE', jobId, status });
  emit('results', { jobId, status });
  setStatus('');
  return { ok: true, jobId, status };
}

async function abRunGenerateFlow({ jobId, confirmLowFit = false, onPhase, onStatus }) {
  const emit = (phase, extra = {}) => onPhase?.(phase, extra);
  const setStatus = (text) => onStatus?.(text);

  abTrackEvent('generate_clicked', jobId);
  emit('generating', { jobId });
  setStatus('Starting generation…');

  const genResp = await abSendBg({
    type: 'API_FETCH',
    path: `/extension/jobs/${jobId}/generate-resume`,
    options: {
      method: 'POST',
      body: JSON.stringify({ confirm_low_fit: confirmLowFit }),
    },
  });

  if (genResp.error) {
    abTrackEvent('generate_failed', jobId);
    emit('error', { step: 'generate', jobId, error: genResp, message: genResp.error });
    return { ok: false, step: 'generate', jobId, error: genResp };
  }

  abTrackEvent('generate_done', jobId);
  abSendBg({ type: 'START_JOB_POLL', jobId });
  const status = abDefensiveStatus(genResp);
  emit('generating', { jobId, status });
  setStatus('Generating tailored resume…');
  return { ok: true, jobId, status };
}

async function abConfirmLowFit(jobId) {
  return abSendBg({
    type: 'API_FETCH',
    path: `/extension/jobs/${jobId}/confirm-low-fit`,
    options: { method: 'PATCH' },
  });
}

function abRenderResultsHtml(status, { showDashboardLink = true } = {}) {
  const s = abDefensiveStatus(status);
  const fitClass = typeof abFitClass === 'function' ? abFitClass(s.fit_label) : '';
  const gaps = (s.gap_list || []).slice(0, 3);
  const gapHtml = gaps.length
    ? `<p class="ab-results-gaps"><strong>Gaps:</strong> ${gaps.map((g) => `<span class="ab-gap-chip">${escapeHtmlFlow(String(g))}</span>`).join(' ')}</p>`
    : '';
  const overrideGate = s.requires_override
    ? `<label class="ab-checkbox ab-results-override"><input type="checkbox" id="ab-results-override" ${s.low_fit_confirmed ? 'checked' : ''} /> I understand this is a ${s.fit_label} fit and want to generate anyway.</label>`
    : '';
  const blockReason = !s.can_generate && s.generation_block_reason
    ? `<p class="ab-results-block">${escapeHtmlFlow(abBlockReasonLabel(s.generation_block_reason))}</p>`
    : '';
  const genLabel = abGenerationButtonLabel(s);
  const dashLink = showDashboardLink
    ? `<button type="button" class="ab-btn ab-btn-secondary ab-results-dashboard">Open dashboard</button>`
    : '';

  return `
    <div class="ab-results-header">
      <p class="ab-meta"><strong>${escapeHtmlFlow(s.role || 'Role')}</strong> @ ${escapeHtmlFlow(s.company || 'Company')}</p>
      <div class="ab-fit">
        <span class="ab-fit-badge ${fitClass}">${escapeHtmlFlow(s.fit_label || '—')}</span>
        <span>Fit ${s.fit_score ?? '—'}/100</span>
      </div>
      ${s.fit_rationale ? `<p class="ab-results-rationale">${escapeHtmlFlow(s.fit_rationale)}</p>` : ''}
      ${gapHtml}
      ${overrideGate}
      ${blockReason}
      <button type="button" class="ab-btn ab-btn-primary ab-results-generate" ${s.can_generate ? '' : 'disabled'}>${escapeHtmlFlow(genLabel)}</button>
      ${dashLink}
      <div class="ab-results-progress"></div>
      <div class="ab-results-error" style="display:none;"></div>
      <button type="button" class="ab-btn ab-btn-secondary ab-results-retry" style="display:none;">Retry</button>
    </div>
  `;
}

function escapeHtmlFlow(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function abBindResultsPanel(container, { jobId, status, onRefresh }) {
  const s = abDefensiveStatus(status);
  let currentStatus = s;
  let lastFailedStep = null;
  let generatingLocally = false;

  const progressEl = container.querySelector('.ab-results-progress');
  const errorEl = container.querySelector('.ab-results-error');
  const retryBtn = container.querySelector('.ab-results-retry');
  const generateBtn = container.querySelector('.ab-results-generate');
  const overrideCb = container.querySelector('#ab-results-override');
  const blockEl = container.querySelector('.ab-results-block');

  function showError(message, step) {
    lastFailedStep = step;
    generatingLocally = false;
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = message;
    }
    if (retryBtn) retryBtn.style.display = 'inline-flex';
    refreshActionUi();
  }

  function clearError() {
    lastFailedStep = null;
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    if (retryBtn) retryBtn.style.display = 'none';
  }

  function refreshActionUi() {
    const busy = generatingLocally || abIsGeneratingPhase(currentStatus.phase);
    const overrideChecked = Boolean(overrideCb?.checked);
    const canGenerate = abEffectiveCanGenerate(currentStatus, overrideChecked);

    if (generateBtn) {
      if (busy) {
        generateBtn.disabled = true;
        generateBtn.classList.add('ab-btn--loading');
        generateBtn.textContent = 'Generating tailored resume…';
      } else {
        generateBtn.classList.remove('ab-btn--loading');
        generateBtn.textContent = abGenerationButtonLabel(currentStatus);
        generateBtn.disabled = !canGenerate;
      }
    }

    if (blockEl) {
      if (busy || canGenerate) {
        blockEl.style.display = 'none';
      } else if (currentStatus.generation_block_reason) {
        blockEl.style.display = 'block';
        blockEl.textContent = abBlockReasonLabel(currentStatus.generation_block_reason);
      } else {
        blockEl.style.display = 'none';
      }
    }
  }

  function updateFromStatus(next) {
    currentStatus = abDefensiveStatus(next);
    if (currentStatus.phase !== 'generating' && currentStatus.ready_to_apply) {
      generatingLocally = false;
    }
    if (overrideCb) overrideCb.checked = currentStatus.low_fit_confirmed;
    if (progressEl) {
      if (currentStatus.ready_to_apply) {
        progressEl.textContent = 'Ready to apply ✓';
        progressEl.className = 'ab-results-progress ab-results-progress--ready';
        generatingLocally = false;
      } else if (generatingLocally || abIsGeneratingPhase(currentStatus.phase)) {
        progressEl.textContent = 'Generating tailored resume…';
        progressEl.className = 'ab-results-progress ab-results-progress--busy';
      } else if (currentStatus.phase === 'failed') {
        progressEl.textContent = 'Generation failed.';
        progressEl.className = 'ab-results-progress ab-results-progress--error';
        generatingLocally = false;
      } else {
        progressEl.textContent = '';
        progressEl.className = 'ab-results-progress';
      }
    }
    refreshActionUi();
    onRefresh?.(currentStatus);
  }

  overrideCb?.addEventListener('change', async (e) => {
    refreshActionUi();
    if (!e.target.checked) return;
    const resp = await abConfirmLowFit(jobId);
    if (resp.error) {
      e.target.checked = false;
      showError(resp.error, 'override');
      refreshActionUi();
      return;
    }
    clearError();
    updateFromStatus(resp);
  });

  generateBtn?.addEventListener('click', async () => {
    if (generatingLocally || abIsGeneratingPhase(currentStatus.phase)) return;
    clearError();
    generatingLocally = true;
    refreshActionUi();
    if (progressEl) {
      progressEl.textContent = 'Starting generation…';
      progressEl.className = 'ab-results-progress ab-results-progress--busy';
    }

    const result = await abRunGenerateFlow({
      jobId,
      confirmLowFit: currentStatus.low_fit_confirmed || overrideCb?.checked,
      onStatus: (text) => {
        if (progressEl && text) {
          progressEl.textContent = text;
          progressEl.className = 'ab-results-progress ab-results-progress--busy';
        }
      },
    });
    if (!result.ok) {
      generatingLocally = false;
      showError(result.error?.error || 'Generation failed', 'generate');
      return;
    }
    updateFromStatus(result.status);
  });

  retryBtn?.addEventListener('click', async () => {
    clearError();
    if (lastFailedStep === 'generate') {
      generateBtn?.click();
    } else if (lastFailedStep === 'analyze') {
      const resp = await abSendBg({
        type: 'API_FETCH',
        path: `/extension/jobs/${jobId}/analyze-fit`,
        options: { method: 'POST' },
      });
      if (resp.error) {
        showError(resp.error, 'analyze');
        return;
      }
      updateFromStatus(resp);
    }
  });

  container.querySelector('.ab-results-dashboard')?.addEventListener('click', async () => {
    const cfg = await abSendBg({ type: 'GET_CONFIG' });
    abSendBg({ type: 'OPEN_TAB', url: `${cfg.appBase}/dashboard/jobs/${jobId}` });
  });

  const jobStatusListener = (msg) => {
    if (msg?.type === 'JOB_STATUS' && msg.jobId === jobId && msg.status) {
      updateFromStatus(msg.status);
    }
  };
  chrome.runtime.onMessage.addListener(jobStatusListener);

  updateFromStatus(currentStatus);

  return {
    updateFromStatus,
    destroy: () => chrome.runtime.onMessage.removeListener(jobStatusListener),
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    abRunCaptureFlow,
    abRunGenerateFlow,
    abConfirmLowFit,
    abRenderResultsHtml,
    abBindResultsPanel,
  };
}
