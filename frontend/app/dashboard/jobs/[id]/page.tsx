'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobsApi } from '@/lib/api/endpoints';
import { Job, ChatMessage } from '@/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import { useProgressSSE, ProgressEvent } from '@/lib/hooks/useProgressSSE';

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
  const chatAllowed = job?.status === 'READY' || job?.status === 'RESUME_GENERATED';

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await jobsApi.get(jobId);
        setJob(res.data);
        
        // Store original resume data for reset functionality
        if (res.data.custom_resume_data && !originalJsonValue) {
          setOriginalJsonValue(JSON.stringify(res.data.custom_resume_data, null, 2));
        }
        
        // Check if job is in processing state
        const processingStates = ['PENDING', 'GENERATING_RESUME', 'GENERATING_PDF'];
        setIsProcessing(processingStates.includes(res.data.status));
        
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

  if (loading || isProcessing) {
    return (
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>GENERATING RESUME</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>Our AI is extracting keywords from the job description and tailoring your profile. This takes about 45 seconds.</p>
        
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
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={handleDownload} disabled={job.status !== 'READY'} style={{ padding: '10px 20px', fontSize: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download PDF
            </button>
          </div>
        </div>

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
                <iframe src={`${API_BASE}/jobs/${job.id}/pdf?inline=true`} className="pdf-embed" title="Resume Preview" />
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
          <button className="btn-ghost" onClick={() => window.open(`${API_BASE}/jobs/${job.id}/pdf?inline=true`, '_blank')} disabled={job.status !== 'READY' || needsRecompile} style={{ padding: '6px 12px', fontSize: 10 }}>View Fullscreen</button>
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
