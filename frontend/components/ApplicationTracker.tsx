'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import type { Job } from '@/types';

interface ApplicationTrackerProps {
  job: Job;
}

const statusOptions = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const appliedViaOptions = [
  { value: 'cold', label: 'Direct / Cold Apply' },
  { value: 'referral', label: 'Referral' },
  { value: 'recruiter_outreach', label: 'Recruiter Outreach' },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ApplicationTracker({ job }: ApplicationTrackerProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(job.application_status || 'SAVED');
  const [appliedVia, setAppliedVia] = useState(job.applied_via || '');
  const [notes, setNotes] = useState(job.application_notes || '');
  const [followUpDate, setFollowUpDate] = useState(
    job.follow_up_at ? new Date(job.follow_up_at).toISOString().split('T')[0] : ''
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      await jobsApi.updateApplication(job.id, {
        application_status: status,
        application_notes: notes,
        follow_up_at: followUpDate || null,
        applied_via: appliedVia || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', job.id] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 16 }}>
          APPLICATION TRACKING
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Application Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
              Track progress to see conversion rates in Analytics
            </p>
          </div>

          {status !== 'SAVED' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Applied Via
              </label>
              <select
                value={appliedVia}
                onChange={(e) => setAppliedVia(e.target.value)}
                className="input-field"
              >
                <option value="">Select method…</option>
                {appliedViaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                Referrals typically have 3–5× higher interview rates
              </p>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Follow-up Reminder
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Application Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="input-field"
              placeholder="Recruiter name, interview feedback, next steps…"
              style={{ minHeight: 100 }}
            />
          </div>

          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Application Details'}
          </button>

          {updateMutation.isSuccess && (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, fontSize: 12, color: 'var(--green)' }}>
              Application details saved successfully.
            </div>
          )}

          {updateMutation.isError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
              {getErrorMessage(updateMutation.error)}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 16 }}>
          TIMELINE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', marginTop: 5, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Job created</p>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{formatDateTime(job.created_at)}</p>
            </div>
          </div>

          {job.applied_at && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', marginTop: 5, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Application submitted</p>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{formatDateTime(job.applied_at)}</p>
                {job.applied_via && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    via {appliedViaOptions.find((opt) => opt.value === job.applied_via)?.label || job.applied_via}
                  </p>
                )}
              </div>
            </div>
          )}

          {job.follow_up_notified_at && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', marginTop: 5, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Follow-up reminder sent</p>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{formatDateTime(job.follow_up_notified_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div style={{ padding: 14, background: 'rgba(255,90,31,0.06)', border: '1px solid rgba(255,90,31,0.15)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Best Practices</div>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 16 }}>
          <li>Update status promptly to track success rates</li>
          <li>Follow up 7–10 days after applying</li>
          <li>Referrals increase interview chances by 3–5×</li>
          <li>Keep detailed notes for interview prep</li>
        </ul>
      </div>
    </div>
  );
}
