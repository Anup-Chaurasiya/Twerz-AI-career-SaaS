/** Badge phase mapping — shared by background service worker and unit tests. */

function abMapBadgeFromStatus(data) {
  if (!data) {
    return { text: '', title: 'Twerz Apply Assist', color: '#6366f1' };
  }
  if (data.ready_to_apply) {
    return { text: '✓', title: 'Ready to apply', color: '#059669' };
  }
  if (data.phase === 'failed') {
    return { text: '!', title: 'Generation failed — retry in extension', color: '#dc2626' };
  }
  if (data.phase === 'generating') {
    return { text: '…', title: 'Generating tailored resume…', color: '#6366f1' };
  }
  if (data.phase === 'fit_analyzed') {
    const score = data.fit_score;
    const badge = score != null && score >= 0 ? String(Math.min(score, 99)) : '#';
    return { text: badge, title: 'Fit analyzed — generate resume', color: '#6366f1' };
  }
  if (data.phase === 'captured') {
    return { text: '.', title: 'Job captured — analyzing…', color: '#64748b' };
  }
  return { text: data.badge_text || '…', title: 'Processing…', color: '#6366f1' };
}

if (typeof module !== 'undefined') {
  module.exports = { abMapBadgeFromStatus };
}
