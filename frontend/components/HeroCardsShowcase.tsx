'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const AUTO_ROTATE_MS = 5500;
const MANUAL_PAUSE_MS = 14000;

function ScoreRing({
  score,
  color,
  size = 88,
  animate = false,
}: {
  score: number;
  color: string;
  size?: number;
  animate?: boolean;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className={animate ? 'hero-score-ring-draw' : undefined}
        style={
          {
            '--score-circ': circ,
            '--score-offset': offset,
          } as CSSProperties
        }
      />
    </svg>
  );
}

export default function HeroCardsShowcase() {
  const stackRef = useRef<HTMLDivElement>(null);
  const pauseUntilRef = useRef(0);
  const [focus, setFocus] = useState<'editor' | 'fit'>('fit');
  const [paused, setPaused] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [chatCycle, setChatCycle] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  const focusCard = useCallback((card: 'editor' | 'fit', manual = true) => {
    setFocus(card);
    if (card !== 'fit') setDisplayScore(0);
    if (manual) pauseUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
    if (card === 'editor') setChatCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused || Date.now() < pauseUntilRef.current) return;
      setFocus((prev) => {
        const next = prev === 'fit' ? 'editor' : 'fit';
        if (next === 'editor') {
          setChatCycle((c) => c + 1);
          setDisplayScore(0);
        }
        return next;
      });
    }, AUTO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (focus !== 'fit') {
      return;
    }
    const target = 87;
    const start = performance.now();
    const duration = 900;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setDisplayScore(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 10, y: py * -7 });
  };

  const stackStyle = {
    '--hero-tilt-x': `${tilt.x}deg`,
    '--hero-tilt-y': `${tilt.y}deg`,
    '--hero-shift-x': `${tilt.x * 0.55}px`,
    '--hero-shift-y': `${tilt.y * 0.45}px`,
  } as CSSProperties;

  return (
    <div
      className="fade-slide-in stagger-2 hero-cards-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setTilt({ x: 0, y: 0 });
      }}
      onMouseMove={handleMouseMove}
    >
      <div className="hero-cards-tabs" role="tablist" aria-label="Product preview">
        <button
          type="button"
          role="tab"
          aria-selected={focus === 'editor'}
          className={`hero-cards-tab${focus === 'editor' ? ' hero-cards-tab--active' : ''}`}
          onClick={() => focusCard('editor')}
        >
          AI Editor
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={focus === 'fit'}
          className={`hero-cards-tab${focus === 'fit' ? ' hero-cards-tab--active' : ''}`}
          onClick={() => focusCard('fit')}
        >
          Fit Analysis
        </button>
      </div>

      <div
        ref={stackRef}
        className={`hero-cards-stack hero-cards-stack--focus-${focus}${paused ? ' hero-cards-stack--paused' : ''}`}
        style={stackStyle}
      >
        <div
          className={`hero-card-3d hero-card-3d--back${focus === 'editor' ? ' hero-card-3d--active' : ''}`}
          role="tabpanel"
          aria-hidden={focus !== 'editor'}
          onClick={() => focusCard('editor')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusCard('editor');
            }
          }}
          tabIndex={0}
        >
          <div className="hero-card-inner hero-card-inner--back">
            <div className="hero-mock hero-chat-mock">
              <div className="hero-mock-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="led-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span className="hero-mock-bar-label">AI RESUME EDITOR</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#ef4444', '#fbbf24', '#34d399'].map((c) => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
                  ))}
                </div>
              </div>
              <div key={`chat-${chatCycle}`} className="hero-chat-body">
                <div className="hero-chat-bubble hero-chat-bubble--user msg-fade-in delay-1">
                  Tailor my resume for Senior React Developer at Stripe
                </div>
                <div className="hero-chat-tool msg-fade-in delay-2">
                  <span className="pulse-blue" style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
                  analyze_job_requirements
                </div>
                <div className="hero-chat-bubble hero-chat-bubble--ai msg-fade-in delay-3">
                  Adding TypeScript, React hooks, and performance optimization…
                </div>
                <div className="hero-chat-success msg-fade-in delay-5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Resume tailored · ATS 94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`hero-card-3d hero-card-3d--front${focus === 'fit' ? ' hero-card-3d--active' : ''}`}
          role="tabpanel"
          aria-hidden={focus !== 'fit'}
          onClick={() => focusCard('fit')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusCard('fit');
            }
          }}
          tabIndex={0}
        >
          <div className="hero-card-inner hero-card-inner--front">
            <div className="hero-fit-mock">
              <div className="hero-fit-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="led-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: '#64748B', userSelect: 'none' }}>FIT ANALYSIS</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#6366f1', fontWeight: 600 }}>Twerz</span>
              </div>
              <div className="hero-fit-body">
                <div className="hero-fit-score-row">
                  <div className="hero-fit-ring-wrap">
                    <ScoreRing score={87} color="#10b981" size={72} animate={focus === 'fit'} />
                    <span className="hero-fit-score-num">{displayScore}</span>
                  </div>
                  <div className="hero-fit-meta">
                    <h4>Strong Fit · Senior React Dev</h4>
                    <p>Stripe · ATS match after tailoring</p>
                  </div>
                </div>
                <div key={`gaps-${focus}`} className="hero-fit-gaps">
                  <div className="hero-fit-gap hero-fit-gap--ok msg-fade-in delay-1">✓ React · TypeScript · Node.js — supported</div>
                  <div className="hero-fit-gap hero-fit-gap--ok msg-fade-in delay-2">✓ System design — partial, reframed</div>
                  <div className="hero-fit-gap hero-fit-gap--warn msg-fade-in delay-3">△ Kubernetes — gap noted, not invented</div>
                </div>
                <div className="hero-fit-ats-lift msg-fade-in delay-4">
                  ATS score: 62 → 94 after Twerz tailor
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
