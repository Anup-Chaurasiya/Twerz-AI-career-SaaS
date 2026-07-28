/** Lightweight extension funnel telemetry via backend /extension/events. */

function abTrackEvent(event, jobId, meta) {
  if (typeof abSendBg !== 'function') return;
  abSendBg({
    type: 'API_FETCH',
    path: '/extension/events',
    options: {
      method: 'POST',
      body: JSON.stringify({ event, job_id: jobId ?? null, meta: meta ?? null }),
    },
  }).catch(() => {});
}

const AB_BLOCK_REASON_LABELS = {
  analyze_required: 'Analyze fit first.',
  no_credits: 'No credits available — purchase a pack or wait for daily free credits.',
  low_fit_unconfirmed: 'Confirm the stretch-fit override to generate.',
};

function abBlockReasonLabel(reason) {
  if (!reason) return '';
  if (AB_BLOCK_REASON_LABELS[reason]) return AB_BLOCK_REASON_LABELS[reason];
  if (reason.startsWith('status_')) return `Job is ${reason.replace('status_', '').replace(/_/g, ' ')}.`;
  return reason;
}

function abGenerationButtonLabel(status) {
  const cost = status?.effective_generation_cost ?? status?.resume_generation_cost ?? 10;
  if (status?.has_unlimited) return 'Generate tailored resume (unlimited)';
  return `Generate tailored resume (${cost} credit${cost === 1 ? '' : 's'})`;
}

function abEffectiveCanGenerate(status, overrideChecked = false) {
  const s = abDefensiveStatus(status);
  if (s.phase === 'generating' || s.ready_to_apply) return false;
  if (s.can_generate) return true;
  if (overrideChecked && s.requires_override && s.phase === 'fit_analyzed') return true;
  return false;
}

function abIsGeneratingPhase(phase) {
  return phase === 'generating';
}

function abDefensiveStatus(status) {
  if (!status || typeof status !== 'object') return {};
  return {
    ...status,
    gap_list: status.gap_list ?? [],
    fit_rationale: status.fit_rationale ?? '',
    effective_generation_cost:
      status.effective_generation_cost ?? status.resume_generation_cost ?? 10,
    can_generate: status.can_generate ?? false,
    low_fit_confirmed: status.low_fit_confirmed ?? false,
    requires_override: status.requires_override ?? false,
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    abTrackEvent,
    abBlockReasonLabel,
    abGenerationButtonLabel,
    abDefensiveStatus,
    abEffectiveCanGenerate,
    abIsGeneratingPhase,
    AB_BLOCK_REASON_LABELS,
  };
}
