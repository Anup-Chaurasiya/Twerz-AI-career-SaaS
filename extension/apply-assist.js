class ApplyAssistSidebar {
  constructor() {
    this.root = null;
    this.context = null;
    this.jobId = null;
    this.override = false;
    this.scamAck = false;
  }

  mount() {
    if (this.root) return;
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
    this.root.querySelector('.ab-close').addEventListener('click', () => this.root.remove());
    this.load();
  }

  setStatus(text) {
    const el = this.root?.querySelector('.ab-status');
    if (el) el.textContent = text;
  }

  async load() {
    try {
      const match = await abSendBg({
        type: 'API_FETCH',
        path: `/extension/jobs/match?url=${encodeURIComponent(location.href)}`,
      });
      if (match.error) throw new Error(match.error);
      this.jobId = match.job_id;
      if (!match.ready_to_apply) {
        this.renderWaiting(match);
        abSendBg({ type: 'START_JOB_POLL', jobId: this.jobId });
        return;
      }
      const ctx = await abSendBg({ type: 'API_FETCH', path: `/extension/jobs/${this.jobId}/apply-context` });
      if (ctx.error) throw new Error(ctx.error);
      this.context = ctx;
      this.render(ctx);
    } catch (err) {
      this.setStatus(String(err.message || err));
    }
  }

  renderWaiting(match) {
    const body = this.root.querySelector('.ab-body');
    body.innerHTML = `
      <p class="ab-meta"><strong>${match.role || 'Role'}</strong> @ ${match.company || 'Company'}</p>
      <div class="ab-warn">Resume not ready yet (${match.status}). Open the dashboard to analyze fit and generate.</div>
      <button class="ab-btn ab-btn-secondary" id="ab-open-dash">Open in Twerz</button>
      <div class="ab-status">Polling for ready status…</div>
    `;
    body.querySelector('#ab-open-dash').addEventListener('click', async () => {
      const cfg = await abSendBg({ type: 'GET_CONFIG' });
      chrome.runtime.sendMessage({ type: 'OPEN_TAB', url: `${cfg.appBase}/dashboard/jobs/${match.job_id}` });
    });
    const poll = setInterval(async () => {
      const status = await abSendBg({ type: 'API_FETCH', path: `/extension/jobs/${match.job_id}/status` });
      if (status.error) return;
      const statusEl = body.querySelector('.ab-status');
      if (status.ready_to_apply) {
        clearInterval(poll);
        this.load();
        return;
      }
      if (statusEl) statusEl.textContent = `Status: ${status.phase.replace(/_/g, ' ')}…`;
    }, 3000);
  }

  renderScamWarnings(risk) {
    if (!risk?.warnings?.length) return '';
    const level = risk.risk_level === 'high' ? 'High risk listing' : 'Review listing';
    const items = risk.warnings.map((w) => `<li>${w}</li>`).join('');
    const ack =
      risk.requires_acknowledgement
        ? `<label class="ab-checkbox"><input type="checkbox" id="ab-scam-ack" /> I verified this employer is legitimate.</label>`
        : '';
    return `<div class="ab-warn"><strong>${level}</strong><ul style="margin:8px 0 0 16px;padding:0;">${items}</ul>${ack}</div>`;
  }

  render(ctx) {
    const body = this.root.querySelector('.ab-body');
    const gate = ctx.requires_override
      ? `<label class="ab-checkbox"><input type="checkbox" id="ab-override" /> I understand this is a ${ctx.fit_label} fit and want to proceed anyway.</label>`
      : '';
    const fitWarn = ctx.requires_override
      ? `<div class="ab-warn">Fit gate: ${ctx.fit_label}. Review gaps before applying.</div>`
      : '';

    body.innerHTML = `
      <div class="ab-fit">
        <span class="ab-fit-badge ${abFitClass(ctx.fit_label)}">${ctx.fit_label || 'N/A'}</span>
        <span>Fit ${ctx.fit_score ?? '—'}/100</span>
      </div>
      <p class="ab-meta"><strong>${ctx.role || 'Role'}</strong> @ ${ctx.company || 'Company'}</p>
      ${this.renderScamWarnings(ctx.listing_risk)}
      ${fitWarn}
      ${gate}
      <div class="ab-actions">
        <button class="ab-btn ab-btn-primary" id="ab-upload">Upload tailored PDF</button>
        <button class="ab-btn ab-btn-secondary" id="ab-cover">Paste cover letter</button>
        <button class="ab-btn ab-btn-secondary" id="ab-fill">Fill common questions</button>
        <button class="ab-btn ab-btn-secondary" id="ab-outreach">Copy cold outreach</button>
        <button class="ab-btn ab-btn-success" id="ab-applied">Mark as applied</button>
      </div>
      <div class="ab-nudge">${ctx.rate_nudge || ''}</div>
      <div class="ab-status"></div>
    `;

    body.querySelector('#ab-override')?.addEventListener('change', (e) => {
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

  async uploadPdf(blocked) {
    if (this.guard(blocked)) return;
    const input = abFindResumeInput();
    if (!input) {
      this.setStatus('No resume file input found on this page.');
      return;
    }
    try {
      this.setStatus('Downloading tailored PDF…');
      const cfg = await abSendBg({ type: 'GET_CONFIG' });
      const res = await fetch(`${cfg.apiBase}${this.context.pdf_download_path}`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      const filename = `${this.context.role || 'resume'}.pdf`.replace(/[/\\?%*:|"<>]/g, '');
      await abInjectPdfFile(input, blob, filename);
      this.setStatus('Resume uploaded. Review before submitting.');
    } catch (err) {
      this.setStatus(String(err.message || err));
    }
  }

  pasteCoverLetter(blocked) {
    if (this.guard(blocked)) return;
    const field = abFindCoverLetterField();
    if (!field) {
      this.setStatus('No cover letter field found.');
      return;
    }
    if (!this.context.cover_letter) {
      this.setStatus('No cover letter on this job. Generate one in the dashboard.');
      return;
    }
    abSetNativeValue(field, this.context.cover_letter);
    this.setStatus('Cover letter pasted.');
  }

  async fillQuestions(blocked) {
    if (this.guard(blocked)) return;
    const questions = abScrapeFormQuestions();
    if (!questions.length) {
      this.setStatus('No form questions detected on this page.');
      return;
    }
    try {
      this.setStatus('Fetching evidence-grounded answers…');
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
      for (const q of questions) {
        const key = q.id || q.label;
        const entry = resp.answers?.[key];
        if (!entry || entry.skip || !entry.value) continue;
        const target = abResolveFieldTarget(q);
        if (abFillAnswer(target, entry.value)) filled += 1;
      }
      this.setStatus(`Filled ${filled} field(s). Review every answer before submitting.`);
    } catch (err) {
      this.setStatus(String(err.message || err));
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

function mountApplyAssistFab() {
  if (document.querySelector('.ab-fab-apply')) return;
  const btn = document.createElement('button');
  btn.className = 'ab-fab ab-fab-apply';
  btn.innerHTML = abFabLabel('Apply Assist');
  btn.addEventListener('click', () => new ApplyAssistSidebar().mount());
  document.body.appendChild(btn);
}

if (abIsApplyFormPage()) {
  mountApplyAssistFab();
}
