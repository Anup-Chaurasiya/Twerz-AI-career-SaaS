const AB_FILL_DELAY_MS = 300;

function abDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ApplyAssistSidebar {
  constructor(initialJobId = null) {
    this.root = null;
    this.context = null;
    this.jobId = initialJobId;
    this.override = false;
    this.scamAck = false;
    this.jobStatusListener = null;
  }

  mount() {
    if (this.root) return;
    abTrackEvent('apply_sidebar_opened', this.jobId);
    this.root = document.createElement('div');
    this.root.className = 'ab-sidebar';
    this.root.innerHTML = `
      <div class="ab-sidebar-header">
        <div class="ab-sidebar-header-main">${abBrandHeader('Twerz', 'Apply Assist')}</div>
        <button class="ab-close" aria-label="Close">×</button>
      </div>
      <div class="ab-body">
        <div class="ab-status">Loading job context…</div>
      </div>
    `;
    document.body.appendChild(this.root);
    this.root.querySelector('.ab-close').addEventListener('click', () => {
      this.destroy();
      this.root.remove();
      this.root = null;
    });
    this.load();
  }

  destroy() {
    if (this.jobStatusListener) {
      chrome.runtime.onMessage.removeListener(this.jobStatusListener);
      this.jobStatusListener = null;
    }
  }

  setStatus(text) {
    const el = this.root?.querySelector('.ab-status');
    if (el) el.textContent = text;
  }

  bodyEl() {
    return this.root?.querySelector('.ab-body');
  }

  async load() {
    try {
      if (this.jobId) {
        await this.loadJobById(this.jobId);
        return;
      }
      const match = await abSendBg({
        type: 'API_FETCH',
        path: `/extension/jobs/match?url=${encodeURIComponent(location.href)}`,
      });
      if (match.error) {
        if (match.status === 404) {
          await this.renderJobPicker();
          return;
        }
        throw new Error(match.error);
      }
      this.jobId = match.job_id;
      if (!match.ready_to_apply) {
        this.renderWaiting(match);
        abSendBg({ type: 'START_JOB_POLL', jobId: this.jobId });
        return;
      }
      await this.loadApplyContext();
    } catch (err) {
      this.setStatus(String(err.message || err));
    }
  }

  async loadJobById(jobId) {
    this.jobId = jobId;
    const status = await abSendBg({ type: 'API_FETCH', path: `/extension/jobs/${jobId}/status` });
    if (status.error) throw new Error(status.error);
    if (!status.ready_to_apply) {
      this.renderWaiting({
        job_id: jobId,
        company: status.company,
        role: status.role,
        fit_score: status.fit_score,
        fit_label: status.fit_label,
        status: status.status,
        requires_override: status.requires_override,
        low_fit_confirmed: status.low_fit_confirmed,
        can_generate: status.can_generate,
        generation_block_reason: status.generation_block_reason,
        effective_generation_cost: status.effective_generation_cost,
        has_unlimited: status.has_unlimited,
      });
      abSendBg({ type: 'START_JOB_POLL', jobId });
      return;
    }
    await this.loadApplyContext();
  }

  async renderJobPicker() {
    const body = this.bodyEl();
    const recent = await abSendBg({ type: 'API_FETCH', path: '/extension/jobs/recent?limit=5' });
    if (recent.error) {
      body.innerHTML = `<div class="ab-warn">${recent.error}</div>`;
      return;
    }
    const items = recent.items || [];
    if (!items.length) {
      body.innerHTML = `<div class="ab-warn">No captured jobs yet. Capture a JD on the job board first.</div>`;
      return;
    }
    body.innerHTML = `
      <p class="ab-meta">No URL match — pick a recent job:</p>
      <div class="ab-job-picker">
        ${items
          .map(
            (item) => `
          <button type="button" class="ab-job-picker-item" data-job-id="${item.job_id}">
            <strong>${escapeAssist(item.role || 'Role')}</strong> @ ${escapeAssist(item.company || 'Company')}
            <br /><span style="color:#94a3b8;font-size:11px;">${escapeAssist(item.fit_label || '—')} ${item.fit_score ?? '—'}/100 · ${escapeAssist(item.phase || '')}</span>
          </button>`,
          )
          .join('')}
      </div>
    `;
    body.querySelectorAll('.ab-job-picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.loadJobById(Number(btn.dataset.jobId));
      });
    });
  }

  renderWaiting(match) {
    const body = this.bodyEl();
    const fitHtml =
      match.fit_score != null
        ? `<div class="ab-fit"><span class="ab-fit-badge ${abFitClass(match.fit_label)}">${match.fit_label || '—'}</span><span>Fit ${match.fit_score}/100</span></div>`
        : '';
    const overrideGate = match.requires_override
      ? `<label class="ab-checkbox"><input type="checkbox" id="ab-wait-override" ${match.low_fit_confirmed ? 'checked' : ''} /> Confirm ${match.fit_label} fit to generate.</label>`
      : '';
    const blockReason =
      match.can_generate === false && match.generation_block_reason
        ? `<p class="ab-results-block">${escapeAssist(abBlockReasonLabel(match.generation_block_reason))}</p>`
        : '';
    const genLabel =
      typeof abGenerationButtonLabel === 'function'
        ? abGenerationButtonLabel(match)
        : 'Generate resume';

    body.innerHTML = `
      <p class="ab-meta"><strong>${escapeAssist(match.role || 'Role')}</strong> @ ${escapeAssist(match.company || 'Company')}</p>
      ${fitHtml}
      <div class="ab-warn">Resume not ready yet (${match.status || 'pending'}).</div>
      ${overrideGate}
      ${blockReason}
      <button class="ab-btn ab-btn-primary" id="ab-generate" ${match.can_generate === false ? 'disabled' : ''}>${escapeAssist(genLabel)}</button>
      <button class="ab-btn ab-btn-secondary" id="ab-open-dash">Open in Twerz</button>
      <div class="ab-status ab-wait-status">Waiting for ready status…</div>
    `;

    body.querySelector('#ab-wait-override')?.addEventListener('change', async (e) => {
      const genBtn = body.querySelector('#ab-generate');
      const blockEl = body.querySelector('.ab-results-block');
      if (!e.target.checked) {
        if (genBtn) genBtn.disabled = true;
        if (blockEl) blockEl.style.display = 'block';
        return;
      }
      if (genBtn) {
        genBtn.disabled = true;
        genBtn.classList.add('ab-btn--loading');
      }
      const resp = await abConfirmLowFit(match.job_id);
      if (resp.error) {
        e.target.checked = false;
        this.setStatus(resp.error);
        if (genBtn) {
          genBtn.classList.remove('ab-btn--loading');
          genBtn.disabled = true;
        }
        return;
      }
      this.override = true;
      if (genBtn) {
        genBtn.classList.remove('ab-btn--loading');
        genBtn.disabled = !abEffectiveCanGenerate(resp, true);
        genBtn.textContent = abGenerationButtonLabel(resp);
      }
      if (blockEl) blockEl.style.display = 'none';
    });

    body.querySelector('#ab-generate')?.addEventListener('click', async () => {
      const genBtn = body.querySelector('#ab-generate');
      const blockEl = body.querySelector('.ab-results-block');
      const statusEl = body.querySelector('.ab-wait-status');
      if (genBtn?.disabled) return;
      genBtn.disabled = true;
      genBtn.classList.add('ab-btn--loading');
      genBtn.textContent = 'Generating tailored resume…';
      if (blockEl) blockEl.style.display = 'none';
      const result = await abRunGenerateFlow({
        jobId: match.job_id,
        confirmLowFit: match.low_fit_confirmed || body.querySelector('#ab-wait-override')?.checked,
        onStatus: (text) => {
          if (statusEl && text) statusEl.textContent = text;
        },
      });
      if (!result.ok) {
        genBtn.classList.remove('ab-btn--loading');
        genBtn.textContent = abGenerationButtonLabel(match);
        genBtn.disabled = !abEffectiveCanGenerate(match, body.querySelector('#ab-wait-override')?.checked);
        if (blockEl && genBtn.disabled) blockEl.style.display = 'block';
        this.setStatus(result.error?.error || 'Generation failed');
        return;
      }
      abSendBg({ type: 'START_JOB_POLL', jobId: match.job_id });
    });

    body.querySelector('#ab-open-dash').addEventListener('click', async () => {
      const cfg = await abSendBg({ type: 'GET_CONFIG' });
      abSendBg({ type: 'OPEN_TAB', url: `${cfg.appBase}/dashboard/jobs/${match.job_id}` });
    });

    this.jobStatusListener = (msg) => {
      if (msg?.type !== 'JOB_STATUS' || msg.jobId !== match.job_id) return;
      const statusEl = body.querySelector('.ab-wait-status');
      if (msg.status?.ready_to_apply) {
        this.destroy();
        this.loadApplyContext();
        return;
      }
      if (statusEl && msg.status?.phase) {
        statusEl.textContent = `Status: ${msg.status.phase.replace(/_/g, ' ')}…`;
      }
    };
    chrome.runtime.onMessage.addListener(this.jobStatusListener);
  }

  async loadApplyContext() {
    const ctx = await abSendBg({ type: 'API_FETCH', path: `/extension/jobs/${this.jobId}/apply-context` });
    if (ctx.error) throw new Error(ctx.error);
    this.context = ctx;
    this.override = Boolean(ctx.low_fit_confirmed);
    this.render(ctx);
  }

  renderScamWarnings(risk) {
    if (!risk?.warnings?.length) return '';
    const level = risk.risk_level === 'high' ? 'High risk listing' : 'Review listing';
    const items = risk.warnings.map((w) => `<li>${escapeAssist(w)}</li>`).join('');
    const ack =
      risk.requires_acknowledgement
        ? `<label class="ab-checkbox"><input type="checkbox" id="ab-scam-ack" /> I verified this employer is legitimate.</label>`
        : '';
    return `<div class="ab-warn"><strong>${level}</strong><ul style="margin:8px 0 0 16px;padding:0;">${items}</ul>${ack}</div>`;
  }

  render(ctx) {
    const body = this.bodyEl();
    const gate = ctx.requires_override
      ? `<label class="ab-checkbox"><input type="checkbox" id="ab-override" ${ctx.low_fit_confirmed ? 'checked' : ''} /> I understand this is a ${ctx.fit_label} fit and want to proceed anyway.</label>`
      : '';
    const fitWarn = ctx.requires_override
      ? `<div class="ab-warn">Fit gate: ${ctx.fit_label}. Review gaps before applying.</div>`
      : '';
    const consentKey = `autofill_consented:${ctx.job_id}`;
    const alreadyConsented = sessionStorage.getItem(consentKey) === '1';

    body.innerHTML = `
      <div class="ab-fit">
        <span class="ab-fit-badge ${abFitClass(ctx.fit_label)}">${ctx.fit_label || 'N/A'}</span>
        <span>Fit ${ctx.fit_score ?? '—'}/100</span>
      </div>
      <p class="ab-meta"><strong>${escapeAssist(ctx.role || 'Role')}</strong> @ ${escapeAssist(ctx.company || 'Company')}</p>
      ${this.renderScamWarnings(ctx.listing_risk)}
      ${fitWarn}
      ${gate}
      <div class="ab-consent-banner" id="ab-consent" style="${alreadyConsented ? 'display:none' : ''}">
        Twerz will fill this application using your tailored resume — review every field before submitting.
        <div class="ab-consent-actions">
          <button type="button" class="ab-btn ab-btn-primary" id="ab-consent-fill">Fill now</button>
          <button type="button" class="ab-btn ab-btn-secondary" id="ab-consent-skip">Skip</button>
        </div>
      </div>
      <div class="ab-actions">
        <button class="ab-btn ab-btn-primary" id="ab-upload">Upload tailored PDF</button>
        <button class="ab-btn ab-btn-secondary" id="ab-cover">Paste cover letter</button>
        <button class="ab-btn ab-btn-secondary" id="ab-fill">Fill common questions</button>
        <button class="ab-btn ab-btn-secondary" id="ab-outreach">Copy cold outreach</button>
        <button class="ab-btn ab-btn-success" id="ab-applied">Mark as applied</button>
      </div>
      <div class="ab-nudge">${ctx.rate_nudge || ''}</div>
      <div class="ab-fill-summary-host"></div>
      <div class="ab-status"></div>
    `;

    body.querySelector('#ab-override')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const resp = await abConfirmLowFit(this.jobId);
        if (resp.error) {
          e.target.checked = false;
          this.setStatus(resp.error);
          return;
        }
      }
      this.override = e.target.checked;
    });
    body.querySelector('#ab-scam-ack')?.addEventListener('change', (e) => {
      this.scamAck = e.target.checked;
    });

    const blocked = () => {
      if (ctx.listing_risk?.requires_acknowledgement && !this.scamAck) return true;
      return ctx.requires_override && !this.override;
    };

    body.querySelector('#ab-upload').addEventListener('click', () => this.uploadPdf(blocked));
    body.querySelector('#ab-cover').addEventListener('click', () => this.pasteCoverLetter(blocked));
    body.querySelector('#ab-fill').addEventListener('click', () => this.fillQuestions(blocked));
    body.querySelector('#ab-outreach').addEventListener('click', () => this.copyOutreach());
    body.querySelector('#ab-applied').addEventListener('click', () => this.markApplied());

    body.querySelector('#ab-consent-fill')?.addEventListener('click', () => {
      sessionStorage.setItem(consentKey, '1');
      body.querySelector('#ab-consent').style.display = 'none';
      abTrackEvent('autofill_consented', this.jobId);
      this.autoApplyAssist(blocked);
    });
    body.querySelector('#ab-consent-skip')?.addEventListener('click', () => {
      sessionStorage.setItem(consentKey, '1');
      body.querySelector('#ab-consent').style.display = 'none';
    });
  }

  guard(blocked) {
    if (this.context?.listing_risk?.requires_acknowledgement && !this.scamAck) {
      this.setStatus('Acknowledge the listing safety check before applying.');
      return true;
    }
    if (blocked()) {
      this.setStatus('Confirm the fit override checkbox first.');
      return true;
    }
    return false;
  }

  showFillSummary(lines) {
    const host = this.root?.querySelector('.ab-fill-summary-host');
    if (!host) return;
    host.innerHTML = `<ul class="ab-fill-summary">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
  }

  async autoApplyAssist(blocked) {
    const summary = [];
    const pdfResult = await this.uploadPdf(() => blocked(), { quiet: true });
    await abDelay(AB_FILL_DELAY_MS);
    const coverResult = await this.pasteCoverLetter(() => blocked(), { quiet: true });
    await abDelay(AB_FILL_DELAY_MS);
    const fillResult = await this.fillQuestions(() => blocked(), { quiet: true });

    if (pdfResult.ok) summary.push('✓ PDF uploaded');
    else summary.push(`⚠ PDF: ${pdfResult.message}`);

    if (coverResult.ok) summary.push('✓ Cover letter pasted');
    else summary.push(`⚠ Cover letter: ${coverResult.message}`);

    if (fillResult.ok) {
      summary.push(
        fillResult.skipped?.length
          ? `⚠ ${fillResult.filled} of ${fillResult.total} fields filled (${fillResult.skipped.join(', ')} skipped)`
          : `✓ Filled ${fillResult.filled} field(s)`,
      );
    } else {
      summary.push(`⚠ Fields: ${fillResult.message}`);
    }
    summary.push('Review every field before submitting.');
    this.showFillSummary(summary);

    const partial = summary.some((l) => l.startsWith('⚠'));
    abTrackEvent(partial ? 'autofill_partial' : 'autofill_done', this.jobId, {
      pdf: pdfResult.ok,
      cover: coverResult.ok,
      fields: fillResult.filled,
    });
  }

  async uploadPdf(blocked, { quiet = false } = {}) {
    if (this.guard(blocked)) return { ok: false, message: 'Blocked by fit gate' };
    const input = abFindResumeInput();
    if (!input) {
      const msg = 'No resume file input found on this page.';
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg };
    }
    try {
      if (!quiet) this.setStatus('Downloading tailored PDF…');
      const cfg = await abSendBg({ type: 'GET_CONFIG' });
      const res = await fetch(`${cfg.apiBase}${this.context.pdf_download_path}`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      const filename = `${this.context.role || 'resume'}.pdf`.replace(/[/\\?%*:|"<>]/g, '');
      await abInjectPdfFile(input, blob, filename);
      if (!quiet) this.setStatus('Resume uploaded. Review before submitting.');
      return { ok: true, message: 'uploaded' };
    } catch (err) {
      const msg = String(err.message || err);
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg };
    }
  }

  pasteCoverLetter(blocked, { quiet = false } = {}) {
    if (this.guard(blocked)) return { ok: false, message: 'Blocked by fit gate' };
    const field = abFindCoverLetterField();
    if (!field) {
      const msg = 'No cover letter field found.';
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg };
    }
    if (!this.context.cover_letter) {
      const msg = 'No cover letter on this job.';
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg };
    }
    abSetNativeValue(field, this.context.cover_letter);
    if (!quiet) this.setStatus('Cover letter pasted.');
    return { ok: true, message: 'pasted' };
  }

  async fillQuestions(blocked, { quiet = false } = {}) {
    if (this.guard(blocked)) return { ok: false, message: 'Blocked by fit gate', filled: 0, total: 0 };
    const questions = abScrapeFormQuestions();
    if (!questions.length) {
      const msg = 'No form questions detected on this page.';
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg, filled: 0, total: 0 };
    }
    try {
      if (!quiet) this.setStatus('Fetching evidence-grounded answers…');
      const cfg = await abSendBg({ type: 'GET_CONFIG' });
      const resp = await abSendBg({
        type: 'API_FETCH',
        path: `/extension/jobs/${this.jobId}/form-answers`,
        options: {
          method: 'POST',
          body: JSON.stringify({
            questions,
            confirm_low_fit: this.override || !this.context.requires_override,
            allow_eeoc: cfg.allowEeoc,
          }),
        },
      });
      if (resp.error) throw new Error(resp.error);
      let filled = 0;
      const skipped = [];
      for (const q of questions) {
        const key = q.id || q.label;
        const entry = resp.answers?.[key];
        if (!entry || entry.skip || !entry.value) {
          skipped.push(q.label);
          continue;
        }
        const target = abResolveFieldTarget(q);
        if (abFillAnswer(target, entry.value)) filled += 1;
        else skipped.push(q.label);
      }
      const msg = `Filled ${filled} of ${questions.length} field(s). Review every answer before submitting.`;
      if (!quiet) this.setStatus(msg);
      return { ok: true, message: msg, filled, total: questions.length, skipped };
    } catch (err) {
      const msg = String(err.message || err);
      if (!quiet) this.setStatus(msg);
      return { ok: false, message: msg, filled: 0, total: questions.length || 0 };
    }
  }

  async copyOutreach() {
    try {
      this.setStatus('Generating outreach message…');
      const resp = await abSendBg({
        type: 'API_FETCH',
        path: `/jobs/${this.jobId}/outreach-message`,
        options: {
          method: 'POST',
          body: JSON.stringify({ outreach_type: 'cold_linkedin' }),
        },
      });
      if (resp.error) throw new Error(resp.error);
      await navigator.clipboard.writeText(resp.outreach_message || '');
      this.setStatus('Cold LinkedIn outreach copied to clipboard.');
    } catch (err) {
      this.setStatus(String(err.message || err));
    }
  }

  async markApplied() {
    try {
      const resp = await abSendBg({
        type: 'API_FETCH',
        path: `/jobs/${this.jobId}/application`,
        options: {
          method: 'PATCH',
          body: JSON.stringify({ application_status: 'APPLIED', applied_via: 'cold' }),
        },
      });
      if (resp.error) throw new Error(resp.error);
      this.setStatus('Tracker updated: APPLIED.');
    } catch (err) {
      this.setStatus(String(err.message || err));
    }
  }
}

function escapeAssist(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function abEnsureApplyPermissions() {
  const patterns = [
    'https://boards.greenhouse.io/*',
    'https://*.greenhouse.io/*',
    'https://jobs.lever.co/*',
    'https://*.myworkdayjobs.com/*',
  ];
  const optional = chrome.permissions?.getAll
    ? await chrome.permissions.getAll()
    : { permissions: [], origins: [] };
  const missing = patterns.filter((p) => !(optional.origins || []).includes(p));
  if (missing.length && chrome.permissions?.request) {
    await chrome.permissions.request({ origins: missing });
  }
}

async function mountApplyAssistFab() {
  if (document.querySelector('.ab-fab-apply')) return;
  await abEnsureApplyPermissions();

  const btn = document.createElement('button');
  btn.className = 'ab-fab ab-fab-apply';
  btn.innerHTML = abFabLabel('Apply Assist');
  btn.addEventListener('click', () => new ApplyAssistSidebar().mount());
  document.body.appendChild(btn);

  try {
    const match = await abSendBg({
      type: 'API_FETCH',
      path: `/extension/jobs/match?url=${encodeURIComponent(location.href)}`,
    });
    if (!match.error && match.ready_to_apply) {
      const flagKey = `ab-auto-opened:${match.job_id}`;
      if (!sessionStorage.getItem(flagKey)) {
        sessionStorage.setItem(flagKey, '1');
        new ApplyAssistSidebar(match.job_id).mount();
      }
    }
  } catch {
    /* ignore auto-open failures */
  }
}

if (abIsApplyFormPage()) {
  mountApplyAssistFab();
}
