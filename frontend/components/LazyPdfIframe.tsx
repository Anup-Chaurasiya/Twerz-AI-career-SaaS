'use client';

import { memo, useEffect, useRef, useState } from 'react';

interface LazyPdfIframeProps {
  src: string;
  title?: string;
}

function LazyPdfIframe({ src, title = 'Resume Preview' }: LazyPdfIframeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setMounted(entry.isIntersecting),
      { root: null, rootMargin: '120px 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="pdf-embed-wrap">
      {mounted ? (
        <iframe src={src} className="pdf-embed" title={title} />
      ) : (
        <div className="pdf-embed-placeholder">
          <div className="spinner spinner-lg" />
          <span>Loading preview…</span>
        </div>
      )}
    </div>
  );
}

export default memo(LazyPdfIframe);
