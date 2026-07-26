'use client';

import { useCallback, useEffect, useState } from 'react';
import { jobsApi, templatesApi } from '@/lib/api/endpoints';
import type { ResumeTemplate } from '@/types';

const ACK_KEY = 'template_ack_modern_two_col';

interface TemplatePickerProps {
  jobId: number;
  currentTemplateId: string;
  jobStatus: string;
  onTemplateChanged: (templateId: string) => void;
  onRecompileStarted: () => void;
}

export default function TemplatePicker({
  jobId,
  currentTemplateId,
  jobStatus,
  onTemplateChanged,
  onRecompileStarted,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showTradeoff, setShowTradeoff] = useState(false);
  const [tradeoffTemplate, setTradeoffTemplate] = useState<ResumeTemplate | null>(null);

  useEffect(() => {
    templatesApi.listResume().then((res) => setTemplates(res.data)).catch(() => {});
  }, []);

  const applyTemplate = useCallback(
    async (templateId: string) => {
      if (templateId === currentTemplateId || loading) return;
      setLoading(true);
      setPendingId(templateId);
      try {
        await jobsApi.updateTemplate(jobId, templateId);
        onTemplateChanged(templateId);
        onRecompileStarted();
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to switch template';
        alert(typeof message === 'string' ? message : 'Failed to switch template');
      } finally {
        setLoading(false);
        setPendingId(null);
        setShowTradeoff(false);
        setTradeoffTemplate(null);
      }
    },
    [currentTemplateId, jobId, loading, onRecompileStarted, onTemplateChanged]
  );

  const handleSelect = (template: ResumeTemplate) => {
    if (template.id === currentTemplateId || loading) return;
    if (
      template.ats_tier === 'tradeoff' &&
      template.ats_warning &&
      !localStorage.getItem(ACK_KEY)
    ) {
      setTradeoffTemplate(template);
      setShowTradeoff(true);
      return;
    }
    void applyTemplate(template.id);
  };

  const confirmTradeoff = () => {
    if (tradeoffTemplate) {
      localStorage.setItem(ACK_KEY, '1');
      void applyTemplate(tradeoffTemplate.id);
    }
  };

  if (!templates.length) return null;
  if (jobStatus !== 'READY' && jobStatus !== 'RESUME_GENERATED' && jobStatus !== 'GENERATING_PDF') {
    return null;
  }

  return (
    <div className="widget-card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Resume template</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            Switch layout anytime — free, no credits. PDF uploads may auto-suggest the closest house match; never an exact copy.
          </div>
        </div>
        {(loading || jobStatus === 'GENERATING_PDF') && (
          <span style={{ fontSize: 11, color: 'var(--teal)' }}>Recompiling…</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {templates.map((template) => {
          const selected = template.id === currentTemplateId;
          const isPending = pendingId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template)}
              disabled={loading || selected}
              style={{
                textAlign: 'left',
                padding: 12,
                borderRadius: 10,
                border: selected ? '2px solid var(--teal)' : '1px solid rgba(255,255,255,0.08)',
                background: selected ? 'rgba(1,169,219,0.08)' : 'rgba(255,255,255,0.02)',
                cursor: selected || loading ? 'default' : 'pointer',
                opacity: loading && !isPending && !selected ? 0.6 : 1,
              }}
            >
              <img
                src={template.preview_url}
                alt=""
                width={120}
                height={160}
                style={{ width: '100%', height: 'auto', borderRadius: 6, marginBottom: 8 }}
              />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{template.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                {template.description}
              </div>
              {template.ats_tier === 'recommended' && (
                <span style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--green)',
                  background: 'rgba(16,185,129,0.12)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  ATS recommended
                </span>
              )}
              {template.ats_tier === 'tradeoff' && (
                <span style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--amber)',
                  background: 'rgba(245,158,11,0.12)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  Human-first layout
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showTradeoff && tradeoffTemplate?.ats_warning && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{
            maxWidth: 420,
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>
              ATS tradeoff
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              {tradeoffTemplate.ats_warning}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTradeoff(false)} style={{ fontSize: 12 }}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={confirmTradeoff} style={{ fontSize: 12 }}>
                I understand — use this template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
