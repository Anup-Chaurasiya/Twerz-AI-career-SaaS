'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobsApi } from '@/lib/api/endpoints';
import { Job, ChatMessage } from '@/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import { useProgressSSE, ProgressEvent } from '@/lib/hooks/useProgressSSE';
import { useCreditStore } from '@/lib/stores/creditStore';
import JobDetailTabs from '@/components/JobDetailTabs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type Notice = { type: 'success' | 'warning' | 'error'; message: string } | null;

const parseSSEEvents = (buffer: string) => {
  const events: any[] = [];
  const frames = buffer.split('\n\n');
  const remainder = frames.pop() || '';

  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
      .join('\n');

    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      events.push({ type: 'response', response: data });
    }
  }

  return { events, remainder };
};

export default function JobDetailPage() {
  const { id } = useParams();
  const jobIdParam = Array.isArray(id) ? id[0] : id;
  const jobId = Number(jobIdParam);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [needsRecompile, setNeedsRecompile] = useState(false);
  const [recompiling, setRecompiling] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Direct JSON editing state
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonEditValue, setJsonEditValue] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [originalJsonValue, setOriginalJsonValue] = useState('');
  const [savingJson, setSavingJson] = useState(false);
  
  // Progress tracking
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyzingFit, setAnalyzingFit] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);
  const analyzeStartedRef = useRef(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [whyFitOpen, setWhyFitOpen] = useState(false);
  const chatAllowed = job?.status === 'READY' || job?.status === 'RESUME_GENERATED';
  const fetchBalance = useCreditStore((s) => s.fetchBalance);
  const hasPro = !!useCreditStore((s) => s.balance?.subscription?.active || s.balance?.has_unlimited);
  const isLowFit = job?.fit_label === 'STRETCH' || job?.fit_label === 'MISMATCH';
  const awaitingGenerate =
    (job?.status === 'PENDING' || job?.status === 'FAILED') &&
    job.fit_score != null &&
    !isProcessing &&
    !generatingResume;

  const startGenerate = async (confirmLowFit: boolean) => {
    setGeneratingResume(true);
    setError('');
    try {
      await jobsApi.generateResume(jobId, { confirm_low_fit: confirmLowFit });
      await fetchBalance();
      setJob((prev) => (prev ? { ...prev, status: 'GENERATING_RESUME' } : prev));
      setIsProcessing(true);
      setProgressMessages(['Starting resume generation…']);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start resume generation');
      setGeneratingResume(false);
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await jobsApi.get(jobId);
        setJob(res.data);
        
        // Store original resume data for reset functionality
        if (res.data.custom_resume_data && !originalJsonValue) {
          setOriginalJsonValue(JSON.stringify(res.data.custom_resume_data, null, 2));
        }
        
        // Only generation/PDF states are "processing" — PENDING waits for user after analyze
        const processingStates = ['GENERATING_RESUME', 'GENERATING_PDF'];
        setIsProcessing(processingStates.includes(res.data.status));
        
        // PENDING without fit → free analyze-fit once
        if (
          res.data.status === 'PENDING' &&
          res.data.fit_score == null &&
          !analyzeStartedRef.current
        ) {
          analyzeStartedRef.current = true;
          setAnalyzingFit(true);
          try {
            const fitRes = await jobsApi.analyzeFit(jobId);
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    fit_score: fitRes.data.fit_score,
                    fit_label: fitRes.data.fit_label,
                    fit_rationale: fitRes.data.fit_rationale,
                    gap_list: fitRes.data.gap_list,
                    gap_roadmap: fitRes.data.gap_roadmap,
                    jd_analysis: fitRes.data.jd_analysis,
                    evidence_map: fitRes.data.evidence_map,
                    fit_score_breakdown: fitRes.data.fit_score_breakdown,
                    evidence_counts: fitRes.data.evidence_counts,
                  }
                : prev
            );
          } catch (err: any) {
            analyzeStartedRef.current = false;
            setError(err.response?.data?.detail || 'Failed to analyze fit');
          } finally {
            setAnalyzingFit(false);
            setLoading(false);
          }
          return;
        }

        if (res.data.status === 'READY') {
          setLoading(false);
          fetchChatHistory();
        } else if (!processingStates.includes(res.data.status)) {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load job');
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobId, originalJsonValue]);

  // Use SSE for progress updates when job is processing
  useProgressSSE({
    entityType: 'job',
    entityId: isProcessing ? jobId : null,
    enabled: isProcessing,
    onUpdate: (event: ProgressEvent) => {
      setProgressMessages(prev => [...prev, event.message]);
      if (event.status) {
        setJob(prevJob => prevJob ? { ...prevJob, status: event.status as Job['status'] } : null);
      }
    },
    onComplete: async (finalStatus) => {
      setIsProcessing(false);
      setLoading(false);
      
      // Refresh job data
      try {
        const res = await jobsApi.get(jobId);
        setJob(res.data);
      if (finalStatus === 'READY') {
        setNeedsRecompile(false);
        fetchChatHistory();
      }
      } catch (err) {
        console.error('Failed to refresh job after completion:', err);
      }
    }
  });

  // Always poll while processing — SSE publish was historically missing, so
  // status could stay spinning until a manual refresh.
  useEffect(() => {
    if (!isProcessing || !jobId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await jobsApi.get(jobId);
        if (cancelled) return;
        setJob(res.data);
        setOriginalJsonValue((prev) => {
          if (prev || !res.data.custom_resume_data) return prev;
          return JSON.stringify(res.data.custom_resume_data, null, 2);
        });
        const status = res.data.status;
        if (status === 'READY' || status === 'FAILED') {
          setIsProcessing(false);
          setLoading(false);
          if (status === 'READY') {
            setNeedsRecompile(false);
            fetchChatHistory();
          }
        }
      } catch (err) {
        console.error('Job status poll failed:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isProcessing, jobId]);

  const fetchChatHistory = async () => {
    try {
      const res = await jobsApi.getChatHistory(jobId);
      if (res.data.messages.length > 0) {
        setChatMessages(res.data.messages);
      } else {
        setChatMessages([{ role: 'assistant', content: "Hi! I've tailored your resume. How would you like to tweak it further? You can say things like 'Make the summary shorter' or 'Add React to my skills'." }]);
      }
    } catch {}
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  // iframe cannot send Authorization headers — load PDF as authenticated blob URL
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPdfPreview = async () => {
      if (job?.status !== 'READY' || needsRecompile) {
        setPdfPreviewUrl(null);
        setPdfPreviewError('');
        return;
      }
      setPdfPreviewError('');
      try {
        const blob = await jobsApi.downloadPdf(jobId);
        if (cancelled) return;
        // Guard against API JSON error bodies returned as blob
        if (blob.type && blob.type.includes('application/json')) {
          const text = await blob.text();
          throw new Error(text || 'Failed to load PDF');
        }
        objectUrl = window.URL.createObjectURL(blob);
        setPdfPreviewUrl(objectUrl);
      } catch (err: any) {
        if (cancelled) return;
        setPdfPreviewUrl(null);
        const detail = err.response?.data?.detail;
        setPdfPreviewError(
          typeof detail === 'string' ? detail : err.message || 'Failed to load PDF preview'
        );
      }
    };

    loadPdfPreview();
    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [job?.status, jobId, needsRecompile]);

  const handleDownload = async () => {
    try {
      const blob = await jobsApi.downloadPdf(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Resume_${job?.job_description.company.replace(/\s+/g, '_')}_${job?.job_description.role.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.response?.data?.detail || 'PDF is not available yet. Recompile it and try again.',
      });
    }
  };

  const handleGeneratePdf = async () => {
    setRecompiling(true);
    setNotice(null);
    try {
      const res = await jobsApi.generatePdf(jobId);
      setJob(prev => prev ? { ...prev, status: res.data.status as Job['status'] } : prev);
      setIsProcessing(true);
      setProgressMessages(['Recompiling PDF...']);
      setNotice({ type: 'success', message: 'PDF recompilation started.' });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to start PDF recompilation.',
      });
    } finally {
      setRecompiling(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    const msg = input; setInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    
    try {
      // Real streaming chat with backend SSE events.
      const response = await fetch(`${API_BASE}/jobs/${jobId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: msg })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const streamError = new Error(errorData.detail || `HTTP ${response.status}`) as Error & { status?: number };
        streamError.status = response.status;
        throw streamError;
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentMessage = '';
      let resumeModified = false;
      let pendingBuffer = '';

      if (reader) {
        // Add empty assistant message that we'll update
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          pendingBuffer += decoder.decode(value, { stream: true });
          const parsed = parseSSEEvents(pendingBuffer);
          pendingBuffer = parsed.remainder;

          for (const event of parsed.events) {
            if (event.type === 'tool_call' && event.label) {
              currentMessage = currentMessage || event.label;
            } else if (event.type === 'response') {
              currentMessage = event.response || event.message || currentMessage;
              resumeModified = Boolean(event.resume_modified);
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Connection lost. Please try again.');
            }

            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: currentMessage || 'Working on it...',
              };
              return updated;
            });
          }
        }
      }

      setChatLoading(false);

      // Refresh job data to check if custom_resume_data changed
      const originalData = JSON.stringify(job?.custom_resume_data);
      const res = await jobsApi.get(jobId);
      setJob(res.data);
      
      const newData = JSON.stringify(res.data.custom_resume_data);
      if (resumeModified || originalData !== newData) {
        setNeedsRecompile(true);
        setNotice({ type: 'warning', message: 'Your resume content was updated. Recompile the PDF to see changes.' });
      }

    } catch (err: any) {
      setChatLoading(false);
      let errorMsg = 'Failed to send message. Please try again.';
      
      if (err.status === 400) {
        errorMsg = 'Chat is only available after your resume has been generated.';
      } else if (err.status === 403) {
        errorMsg = "You don't have access to this job.";
      } else if (err.status === 429) {
        errorMsg = 'Too many messages. Please wait a moment.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMsg = 'Connection lost. Please try again.';
      }
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    }
  };

  const handleEditManually = () => {
    if (job?.custom_resume_data) {
      setJsonEditValue(JSON.stringify(job.custom_resume_data, null, 2));
      setJsonError('');
      setShowJsonEditor(true);
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonEditValue(value);
    // Real-time validation
    try {
      JSON.parse(value);
      setJsonError('');
    } catch (e) {
      setJsonError('⚠ Invalid JSON');
    }
  };

  const handleSaveJson = async () => {
    try {
      const parsed = JSON.parse(jsonEditValue);
      setSavingJson(true);
      
      const result = await jobsApi.updateCustomResume(jobId, parsed);
      setJob(prev => prev ? { ...prev, ...result.data.job } : prev);
      setShowJsonEditor(false);
      setNeedsRecompile(true);
      setNotice({ type: 'warning', message: 'Resume updated. Recompile your PDF to see changes.' });
      
    } catch (err: any) {
      if (err.message.includes('Invalid JSON')) {
        setJsonError('Invalid JSON syntax');
      } else if (err.response?.status === 400) {
        setNotice({ type: 'error', message: 'Cannot edit while resume is being generated.' });
      } else if (err.response?.status === 422 || String(err.response?.data?.detail || '').includes('Invalid resume data')) {
        setNotice({ type: 'error', message: `Schema validation error: ${err.response?.data?.detail || err.message}` });
      } else {
        setNotice({ type: 'error', message: `Failed to save changes: ${err.response?.data?.detail || err.message}` });
      }
    } finally {
      setSavingJson(false);
    }
  };

  const handleResetToOriginal = () => {
    if (originalJsonValue) {
      setJsonEditValue(originalJsonValue);
      setJsonError('');
    }
  };

  if (loading || isProcessing || analyzingFit) {
    const analyzing = analyzingFit || (job?.status === 'PENDING' && job.fit_score == null);
    return (
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
          {analyzing ? 'ANALYZING FIT' : 'GENERATING RESUME'}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          {analyzing
            ? 'Free pre-check: matching your profile against this JD. No credit charged yet.'
            : 'Our AI is extracting keywords from the job description and tailoring your profile. This takes about 45 seconds.'}
        </p>
        
        {/* Live Progress Log */}
        {progressMessages.length > 0 && (
          <div style={{ marginTop: 24, maxWidth: 500, width: '100%', maxHeight: 200, overflowY: 'auto', background: 'rgba(1,169,219,0.05)', border: '1px solid rgba(1,169,219,0.15)', borderRadius: 8, padding: 16 }}>
            {progressMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
                {msg}
              </div>
            ))}
          </div>
        )}
        
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', animation: 'blink 1.4s infinite both' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', animation: 'blink 1.4s infinite both 0.2s' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', animation: 'blink 1.4s infinite both 0.4s' }} />
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="page-scroll">
        <div className="widget-card card-warning" style={{ color: 'var(--red)' }}>{error}</div>
        <Link href="/dashboard/jobs" className="btn-secondary" style={{ marginTop: 24, display: 'inline-block' }}>← Back to Jobs</Link>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="split-layout">
      {/* Main Content (PDF / Preview) */}
      <div className="split-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <Link href="/dashboard/jobs" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, transition: 'color 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Jobs
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              {job.job_description.role}
              <span className={`badge ${getStatusColor(job.status)}`}>{getStatusLabel(job.status)}</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🏢 <span style={{ color: 'var(--text-secondary)' }}>{job.job_description.company}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={async () => {
              try {
                const blob = await jobsApi.downloadDocx(jobId);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Resume_${job?.job_description.company.replace(/\s+/g, '_')}.docx`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err: any) {
                setNotice({ type: 'error', message: err.response?.data?.detail || 'DOCX download failed' });
              }
            }} disabled={!job.custom_resume_data} style={{ padding: '10px 16px', fontSize: 12 }}>
              DOCX
            </button>
            <button className="btn-primary" onClick={handleDownload} disabled={job.status !== 'READY'} style={{ padding: '10px 20px', fontSize: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download PDF
            </button>
          </div>
        </div>

        {(job.fit_score != null || job.ats_score_after != null) && (
          <div className="widget-card" style={{ marginBottom: 20, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>FIT SCORE</div>
                <div style={{
                  fontSize: 36, fontWeight: 800, fontFamily: 'JetBrains Mono',
                  color: job.fit_label === 'STRONG' ? 'var(--green)' : job.fit_label === 'STRETCH' ? 'var(--amber)' : 'var(--red)'
                }}>
                  {job.fit_score ?? '—'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{job.fit_label || ''}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>ATS SCORE</div>
                <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
                  {job.ats_score_before ?? '—'} → <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{job.ats_score_after ?? '—'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>before → after</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                {isLowFit && (
                  <div style={{
                    background: job.fit_label === 'MISMATCH' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${job.fit_label === 'MISMATCH' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    marginBottom: 8,
                    color: job.fit_label === 'MISMATCH' ? 'var(--red)' : 'var(--amber)',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      Low fit — we won&apos;t invent skills
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.45 }}>
                      Low fit means we won&apos;t invent skills — here&apos;s what&apos;s real and the roadmap below.
                      That&apos;s the tool protecting you from a doomed application, not a bug.
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{job.fit_rationale}</p>
                {job.fit_score_breakdown && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '4px 0' }}
                      onClick={() => setWhyFitOpen((o) => !o)}
                    >
                      {whyFitOpen ? 'Hide' : 'Why this Fit score'} ▾
                    </button>
                    {whyFitOpen && (
                      <div style={{
                        marginTop: 8,
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(1,169,219,0.04)',
                        border: '1px solid rgba(1,169,219,0.12)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>Evidence coverage</span>
                            <span style={{ fontFamily: 'JetBrains Mono' }}>{job.fit_score_breakdown.coverage_pct}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, job.fit_score_breakdown.coverage_pct)}%`,
                              background: 'var(--teal)',
                            }} />
                          </div>
                        </div>
                        <div style={{ marginBottom: 8, lineHeight: 1.5 }}>
                          Seniority: JD <strong>{job.fit_score_breakdown.seniority.jd}</strong>
                          {' '}vs candidate ≈ <strong>{job.fit_score_breakdown.seniority.candidate}</strong>
                          {job.fit_score_breakdown.seniority.penalty > 0
                            ? ` (−${job.fit_score_breakdown.seniority.penalty} penalty)`
                            : ' (no penalty)'}
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
                          {job.fit_score_breakdown.formula}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                          {(job.fit_score_breakdown.items || []).map((row, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <span>
                                <span style={{
                                  color: row.support === 'SUPPORTED' ? 'var(--green)' : row.support === 'PARTIAL' ? 'var(--amber)' : 'var(--red)',
                                  marginRight: 6,
                                }}>●</span>
                                {row.requirement}
                              </span>
                              <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>{row.weight}</span>
                            </div>
                          ))}
                        </div>
                        {job.ats_score_detail && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(1,169,219,0.1)' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>ATS detail</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                              Structure/keyword blend is independent of Fit. See before → after scores above.
                              {typeof (job.ats_score_detail as any).critique === 'string'
                                ? ` ${(job.ats_score_detail as any).critique.slice(0, 160)}`
                                : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {awaitingGenerate && (
              <div style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 8,
                background: 'rgba(1,169,219,0.06)',
                border: '1px solid rgba(1,169,219,0.2)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 420 }}>
                  {isLowFit
                    ? 'This role is a stretch or mismatch. Generate a transferable resume anyway (1 credit), or skip with no charge.'
                    : 'Fit looks strong. Generate a tailored resume for 1 credit.'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {isLowFit ? (
                    <>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: '10px 16px' }}
                        disabled={generatingResume}
                        onClick={() => startGenerate(true)}
                      >
                        Generate anyway (1 credit)
                      </button>
                      <Link
                        href="/dashboard/jobs"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '10px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                      >
                        Skip, no charge
                      </Link>
                    </>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ fontSize: 12, padding: '10px 16px' }}
                      disabled={generatingResume}
                      onClick={() => startGenerate(false)}
                    >
                      Generate resume (1 credit)
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && job ? (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{error}</div>
            ) : null}

            {(job.gap_list?.length || job.evidence_map?.items?.length || job.evidence_map?.transferable_themes?.length) ? (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Must-have checklist</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {(job.evidence_map?.items || []).map((item, i) => (
                      <div key={i} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          color: item.support === 'SUPPORTED' ? 'var(--green)' : item.support === 'PARTIAL' ? 'var(--amber)' : 'var(--red)',
                          fontWeight: 700
                        }}>
                          {item.support === 'SUPPORTED' ? '●' : item.support === 'PARTIAL' ? '◐' : '○'}
                        </span>
                        <span>
                          <strong>{item.requirement}</strong>
                          {item.evidence_quote ? (
                            <span style={{ color: 'var(--text-dim)', display: 'block' }} title="Truth lock — source evidence">“{item.evidence_quote}”</span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {isLowFit && (job.evidence_map?.transferable_themes?.length || 0) > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>What&apos;s real</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(job.evidence_map?.transferable_themes || []).map((t, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: 'rgba(20,184,166,0.12)', color: 'var(--teal)' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {isLowFit ? "What's a gap" : 'Gaps (not invented)'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(job.gap_list || []).map((g, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>{g}</span>
                    ))}
                    {!job.gap_list?.length && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>No critical gaps listed</span>}
                  </div>
                  {job.custom_resume_data && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="btn-secondary"
                      style={{
                        fontSize: 11,
                        padding: '6px 10px',
                        opacity: job.fit_label === 'MISMATCH' ? 0.55 : 1,
                      }}
                      title={job.fit_label === 'MISMATCH' ? 'Full keyword injection is reserved for Strong/Stretch matches' : undefined}
                      onClick={async () => {
                      if (job.fit_label === 'MISMATCH') {
                        setNotice({
                          type: 'warning',
                          message: 'Improve keywords is limited on MISMATCH — use transferable framing from generation instead.',
                        });
                        return;
                      }
                      const kws = (job.evidence_map?.items || [])
                        .filter(i => i.support === 'PARTIAL' || i.support === 'SUPPORTED')
                        .map(i => i.requirement)
                        .slice(0, 5);
                      if (!kws.length) { setNotice({ type: 'warning', message: 'No supported/partial keywords to amplify.' }); return; }
                      try {
                        const res = await jobsApi.fixGaps(jobId, kws);
                        setJob(prev => prev ? { ...prev, custom_resume_data: res.data.custom_resume_data, status: res.data.status as Job['status'] } : prev);
                        setNeedsRecompile(true);
                        setNotice({ type: 'success', message: 'Amplified transferable keywords. Recompile PDF.' });
                      } catch (err: any) {
                        setNotice({ type: 'error', message: err.response?.data?.detail || 'Gap fix failed' });
                      }
                    }}>Improve keywords</button>
                    <button className="btn-secondary" style={{ fontSize: 11, padding: '6px 10px' }} onClick={async () => {
                      try {
                        const res = await jobsApi.generateCoverLetter(jobId);
                        setJob(prev => prev ? { ...prev, cover_letter: res.data.cover_letter } : prev);
                        setNotice({ type: 'success', message: 'Cover letter generated below.' });
                      } catch (err: any) {
                        setNotice({ type: 'error', message: err.response?.data?.detail || 'Cover letter failed' });
                      }
                    }}>Cover letter</button>
                    <button className="btn-secondary" style={{ fontSize: 11, padding: '6px 10px' }} onClick={async () => {
                      try {
                        const res = await jobsApi.generateInterviewPacket(jobId);
                        setJob(prev => prev ? { ...prev, interview_packet: res.data.interview_packet } : prev);
                        setNotice({ type: 'success', message: 'Interview packet ready.' });
                      } catch (err: any) {
                        const detail = err.response?.data?.detail || 'Interview packet failed';
                        const paywall = err.response?.status === 402;
                        setNotice({
                          type: paywall ? 'warning' : 'error',
                          message: paywall
                            ? `${detail} — upgrade on Credits for Job Hunt Pro.`
                            : detail,
                        });
                      }
                    }}>Interview pack</button>
                  </div>
                  )}
                </div>
              </div>
            ) : null}

            {isLowFit && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', letterSpacing: 0.4 }}>
                  GAP-CLOSING ROADMAP
                </div>
                {job.gap_roadmap?.steps && job.gap_roadmap.steps.length > 0 ? (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                      {job.gap_roadmap.summary || 'Path to become competitive for this class of role — learning and building, not inventing on the resume.'}
                    </p>
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {job.gap_roadmap.steps.map((step, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{step.title}</strong>
                          {step.category ? (
                            <span style={{ fontSize: 10, marginLeft: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {step.category}
                            </span>
                          ) : null}
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{step.detail}</div>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}>
                    Roadmap unavailable — review gaps above.
                  </p>
                )}
                {!hasPro && (
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, lineHeight: 1.5 }}>
                    Iterate faster with Job Hunt Pro — 40 credits/mo.{' '}
                    <Link href="/dashboard/credits" style={{ color: 'var(--teal)' }}>View plans</Link>
                  </p>
                )}
              </div>
            )}

            {(() => {
              const experiences = job.bullet_diff?.experiences || [];
              const projects = job.bullet_diff?.projects || [];
              const hasPairs =
                experiences.some((e) => (e.pairs || []).length > 0) ||
                projects.some((p) => (p.pairs || []).length > 0);
              if (!hasPairs) return null;

              const highlightKeyword = (text: string, keyword?: string | null) => {
                if (!keyword || !text) return text;
                const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
                if (idx < 0) return text;
                const before = text.slice(0, idx);
                const match = text.slice(idx, idx + keyword.length);
                const after = text.slice(idx + keyword.length);
                return (
                  <>
                    {before}
                    <mark style={{ background: 'rgba(20,184,166,0.25)', color: 'var(--teal)', padding: '0 2px', borderRadius: 2 }}>{match}</mark>
                    {after}
                  </>
                );
              };

              return (
                <div style={{ marginTop: 20, borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', letterSpacing: 0.4 }}>
                    BEFORE → AFTER (bullet changes)
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                    Original profile bullets vs tailored. Highlighted words are Supported/Partial JD keywords that triggered the rewrite.
                  </p>
                  {!hasPro && (
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                      Iterate faster with Job Hunt Pro — 40 credits/mo.{' '}
                      <Link href="/dashboard/credits" style={{ color: 'var(--teal)' }}>View plans</Link>
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 360, overflowY: 'auto' }}>
                    {experiences.map((exp, ei) => (
                      <div key={`exp-${ei}`}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          {exp.role}{exp.company ? ` · ${exp.company}` : ''}
                        </div>
                        {(exp.pairs || []).map((pair, pi) => (
                          <div key={pi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                              <div style={{ fontSize: 10, letterSpacing: 1, marginBottom: 4, opacity: 0.7 }}>ORIGINAL</div>
                              {pair.original || <em style={{ opacity: 0.5 }}>—</em>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, background: 'rgba(20,184,166,0.06)', padding: 10, borderRadius: 6, border: '1px solid rgba(20,184,166,0.15)' }}>
                              <div style={{ fontSize: 10, letterSpacing: 1, marginBottom: 4, color: 'var(--teal)' }}>TAILORED</div>
                              {highlightKeyword(pair.tailored, pair.keyword)}
                              {pair.keyword ? (
                                <div style={{ fontSize: 10, color: 'var(--teal)', marginTop: 6 }}>keyword: {pair.keyword}</div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {projects.map((proj, pi) => (
                      <div key={`proj-${pi}`}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Project · {proj.name}
                        </div>
                        {(proj.pairs || []).map((pair, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                              <div style={{ fontSize: 10, letterSpacing: 1, marginBottom: 4, opacity: 0.7 }}>ORIGINAL</div>
                              {pair.original || <em style={{ opacity: 0.5 }}>—</em>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, background: 'rgba(20,184,166,0.06)', padding: 10, borderRadius: 6, border: '1px solid rgba(20,184,166,0.15)' }}>
                              <div style={{ fontSize: 10, letterSpacing: 1, marginBottom: 4, color: 'var(--teal)' }}>TAILORED</div>
                              {highlightKeyword(pair.tailored, pair.keyword)}
                              {pair.keyword ? (
                                <div style={{ fontSize: 10, color: 'var(--teal)', marginTop: 6 }}>keyword: {pair.keyword}</div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
              <label style={{ fontSize: 12, color: 'var(--text-dim)', paddingTop: 6 }}>Application</label>
              <select
                value={job.application_status || 'SAVED'}
                onChange={async (e) => {
                  try {
                    const res = await jobsApi.updateApplication(jobId, { application_status: e.target.value });
                    setJob(prev => prev ? { ...prev, ...res.data } : prev);
                  } catch (err: any) {
                    setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to update status' });
                  }
                }}
                style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
              >
                {['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                title="Follow-up date"
                value={(() => {
                  if (!job.follow_up_at) return '';
                  const d = new Date(job.follow_up_at);
                  if (Number.isNaN(d.getTime())) return '';
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })()}
                onChange={async (e) => {
                  try {
                    const res = await jobsApi.updateApplication(jobId, {
                      follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    });
                    setJob(prev => prev ? { ...prev, ...res.data } : prev);
                  } catch (err: any) {
                    setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to set follow-up' });
                  }
                }}
                style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
              />
              <textarea
                placeholder="Application notes"
                defaultValue={job.application_notes || ''}
                key={job.application_notes || 'notes'}
                onBlur={async (e) => {
                  const notes = e.target.value;
                  if (notes === (job.application_notes || '')) return;
                  try {
                    const res = await jobsApi.updateApplication(jobId, { application_notes: notes });
                    setJob(prev => prev ? { ...prev, ...res.data } : prev);
                  } catch (err: any) {
                    setNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to save notes' });
                  }
                }}
                rows={2}
                style={{ flex: '1 1 200px', fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', resize: 'vertical' }}
              />
              {(job.resume_versions?.length || 0) > 0 && (
                <select
                  defaultValue=""
                  onChange={async (e) => {
                    const v = Number(e.target.value);
                    if (!v) return;
                    try {
                      const res = await jobsApi.restoreVersion(jobId, v);
                      setJob(prev => prev ? { ...prev, custom_resume_data: res.data.custom_resume_data, status: res.data.status as Job['status'] } : prev);
                      setNeedsRecompile(true);
                      setNotice({ type: 'warning', message: `Restored version ${v}. Recompile PDF.` });
                    } catch (err: any) {
                      setNotice({ type: 'error', message: err.response?.data?.detail || 'Restore failed' });
                    }
                  }}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--deep)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                >
                  <option value="">Restore version…</option>
                  {(job.resume_versions || []).map(v => (
                    <option key={v.version} value={v.version}>v{v.version} — {v.label}</option>
                  ))}
                </select>
              )}
            </div>

            {job.cover_letter && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Cover letter</div>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: '4px 8px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(job.cover_letter || '');
                      setNotice({ type: 'success', message: 'Cover letter copied' });
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, background: 'var(--deep)', padding: 12, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>{job.cover_letter}</pre>
              </div>
            )}
            {job.interview_packet && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Interview packet</div>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: '4px 8px' }}
                    onClick={() => {
                      const p = job.interview_packet!;
                      const text = [
                        p.elevator_pitch ? `Pitch:\n${p.elevator_pitch}` : '',
                        (p.likely_questions || []).length ? `Questions:\n${(p.likely_questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}` : '',
                        (p.star_stories || []).length ? `STAR stories:\n${(p.star_stories || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
                        (p.gaps_to_prepare || []).length ? `Gaps to prepare:\n${(p.gaps_to_prepare || []).map((g, i) => `${i + 1}. ${g}`).join('\n')}` : '',
                      ].filter(Boolean).join('\n\n');
                      navigator.clipboard.writeText(text);
                      setNotice({ type: 'success', message: 'Interview packet copied' });
                    }}
                  >
                    Copy
                  </button>
                </div>
                {job.interview_packet.elevator_pitch && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}><strong>Pitch:</strong> {job.interview_packet.elevator_pitch}</p>
                )}
                {(job.interview_packet.likely_questions || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 0.5 }}>LIKELY QUESTIONS</div>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(job.interview_packet.likely_questions || []).map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </>
                )}
                {(job.interview_packet.star_stories || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 0.5 }}>STAR STORIES</div>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(job.interview_packet.star_stories || []).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </>
                )}
                {(job.interview_packet.gaps_to_prepare || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 0.5 }}>GAPS TO PREPARE</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(job.interview_packet.gaps_to_prepare || []).map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {(job.status === 'READY' || job.status === 'RESUME_GENERATED') && job.evidence_map && (
          <div className="widget-card" style={{ marginBottom: 24, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1 }}>
              NETWORKING & APPLICATION
            </div>
            <JobDetailTabs job={job} />
          </div>
        )}

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 6, marginBottom: 24, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        {notice && (
          <div style={{
            background: notice.type === 'error' ? 'rgba(239,68,68,0.1)' : notice.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${notice.type === 'error' ? 'rgba(239,68,68,0.25)' : notice.type === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 24,
            color: notice.type === 'error' ? 'var(--red)' : notice.type === 'warning' ? 'var(--amber)' : 'var(--green)',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center'
          }}>
            <span>{notice.message}</span>
            {needsRecompile && (
              <button className="btn-primary" onClick={handleGeneratePdf} disabled={recompiling} style={{ padding: '8px 12px', fontSize: 10, flexShrink: 0 }}>
                {recompiling ? 'Starting...' : 'Recompile PDF'}
              </button>
            )}
          </div>
        )}

        {job.status === 'READY' || job.status === 'RESUME_GENERATED' ? (
          <>
            <div className="widget-card" style={{ height: 'calc(100% - 120px)', padding: 0, overflow: 'hidden' }}>
              {job.status === 'READY' && !needsRecompile ? (
                pdfPreviewUrl ? (
                  <iframe src={pdfPreviewUrl} className="pdf-embed" title="Resume Preview" />
                ) : pdfPreviewError ? (
                  <div style={{ minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--red)' }}>PDF preview failed</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.6, marginBottom: 20 }}>{pdfPreviewError}</p>
                    <button className="btn-primary" onClick={handleGeneratePdf} disabled={recompiling}>
                      {recompiling ? 'Starting...' : 'Recompile PDF'}
                    </button>
                  </div>
                ) : (
                  <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner spinner-lg" />
                  </div>
                )
              ) : (
                <div style={{ minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>PDF needs recompilation</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.6, marginBottom: 20 }}>Your resume content is ready, but the downloadable PDF has not been generated for the latest version.</p>
                  <button className="btn-primary" onClick={handleGeneratePdf} disabled={recompiling}>
                    {recompiling ? 'Starting...' : 'Recompile PDF'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Manual Edit Button */}
            {!showJsonEditor && (
              <button 
                onClick={handleEditManually} 
                className="btn-secondary" 
                style={{ marginTop: 16, padding: '8px 16px', fontSize: 12 }}
              >
                ✏️ Edit Manually (JSON)
              </button>
            )}

            {/* JSON Editor */}
            {showJsonEditor && (
              <div className="widget-card" style={{ marginTop: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Edit Resume JSON
                    {jsonError && <span style={{ marginLeft: 12, color: 'var(--red)', fontSize: 12 }}>{jsonError}</span>}
                  </div>
                  <button onClick={handleResetToOriginal} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Reset to original
                  </button>
                </div>
                <textarea
                  value={jsonEditValue}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 400,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    padding: 12,
                    borderRadius: 6,
                    border: `1px solid ${jsonError ? 'var(--red)' : 'var(--card-border)'}`,
                    background: 'var(--deep)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button 
                    onClick={handleSaveJson} 
                    disabled={!!jsonError || savingJson}
                    className="btn-primary" 
                    style={{ padding: '8px 20px', fontSize: 12 }}
                  >
                    {savingJson ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={() => setShowJsonEditor(false)} 
                    className="btn-secondary" 
                    style={{ padding: '8px 20px', fontSize: 12 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="widget-card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Resume not ready</div>
            <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Status: {job.status}</p>
          </div>
        )}
      </div>

      {/* AI Chat Sidebar */}
      <div className="split-chat">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)' }} />
            AI EDITOR
          </div>
          <button
            className="btn-ghost"
            onClick={() => pdfPreviewUrl && window.open(pdfPreviewUrl, '_blank')}
            disabled={job.status !== 'READY' || needsRecompile || !pdfPreviewUrl}
            style={{ padding: '6px 12px', fontSize: 10 }}
          >
            View Fullscreen
          </button>
        </div>
        
        <div className="chat-messages" ref={chatRef}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role} fade-slide-in`}>
              {msg.content}
            </div>
          ))}
          {chatLoading && (
            <div className="chat-bubble assistant fade-slide-in">
              <div className="typing-dots">
                <span style={{ fontSize: 24, lineHeight: 0.5 }}>.</span>
                <span style={{ fontSize: 24, lineHeight: 0.5 }}>.</span>
                <span style={{ fontSize: 24, lineHeight: 0.5 }}>.</span>
              </div>
            </div>
          )}
          {chatMessages.length === 1 && !chatLoading && (
            <div className="chat-starters fade-slide-in stagger-2">
              <button className="chat-starter-btn" onClick={() => setInput("Make the summary more concise and punchy")}>✨ Make the summary more concise</button>
              <button className="chat-starter-btn" onClick={() => setInput("Highlight my leadership experience more")}>👑 Highlight leadership experience</button>
              <button className="chat-starter-btn" onClick={() => setInput("Add more metrics and numbers to my recent role")}>📊 Add more metrics to recent role</button>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="chat-input-area">
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Ask AI to tweak the resume..." 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              disabled={chatLoading || !chatAllowed}
              style={{ paddingRight: 40, borderRadius: 24, padding: '12px 20px', background: 'rgba(15,27,46,0.8)' }}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || chatLoading || !chatAllowed}
              style={{ position: 'absolute', right: 6, top: 6, bottom: 6, width: 32, borderRadius: '50%', background: input.trim() && !chatLoading ? 'var(--teal)' : 'rgba(1,169,219,0.1)', color: input.trim() && !chatLoading ? '#fff' : 'var(--text-dim)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !chatLoading ? 'pointer' : 'default', transition: 'all 0.2s' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
