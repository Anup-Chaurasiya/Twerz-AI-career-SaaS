'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { jobsApi } from '@/lib/api/endpoints';
import { Job, ChatMessage } from '@/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import { useCreditStore } from '@/lib/stores/creditStore';

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fetchBalance = useCreditStore((s) => s.fetchBalance);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchJob = async () => {
      try {
        const res = await jobsApi.get(Number(id));
        setJob(res.data);
        if (res.data.status === 'PENDING' || res.data.status === 'GENERATING_RESUME' || res.data.status === 'GENERATING_PDF') {
          interval = setTimeout(fetchJob, 3000);
        } else if (res.data.status === 'READY') {
          setLoading(false);
          fetchChatHistory();
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load job');
        setLoading(false);
      }
    };
    fetchJob();
    return () => clearTimeout(interval);
  }, [id]);

  const fetchChatHistory = async () => {
    try {
      const res = await jobsApi.getChatHistory(Number(id));
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
      const blob = await jobsApi.downloadPdf(Number(id));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Resume_${job?.job_description.company.replace(/\s+/g, '_')}_${job?.job_description.role.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 429) alert('Not enough credits to download PDF.');
      else alert('Failed to download PDF.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    const msg = input; setInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    
    // Simulate chat response - backend integration needed for real streaming
    setTimeout(async () => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "I've updated the resume based on your request. Let me know if you need any other changes." }]);
      setChatLoading(false);
      // Trigger a re-fetch of the job to get the updated resume data
      const res = await jobsApi.get(Number(id));
      setJob(res.data);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>GENERATING RESUME</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>Our AI is extracting keywords from the job description and tailoring your profile. This takes about 45 seconds.</p>
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

        {job.status === 'READY' ? (
          <div className="widget-card" style={{ height: 'calc(100% - 120px)', padding: 0, overflow: 'hidden' }}>
            <iframe src={`${process.env.NEXT_PUBLIC_API_URL}/jobs/${job.id}/pdf`} className="pdf-embed" title="Resume Preview" />
          </div>
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
          <button className="btn-ghost" onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${job.id}/pdf`, '_blank')} style={{ padding: '6px 12px', fontSize: 10 }}>View Fullscreen</button>
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
              disabled={chatLoading || job.status !== 'READY'}
              style={{ paddingRight: 40, borderRadius: 24, padding: '12px 20px', background: 'rgba(15,27,46,0.8)' }}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || chatLoading || job.status !== 'READY'}
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
