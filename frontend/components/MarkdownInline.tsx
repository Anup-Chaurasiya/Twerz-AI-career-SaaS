'use client';

import React from 'react';

type TextPart = { text: string; bold: boolean };

function splitBoldSegments(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }
  if (!parts.length) parts.push({ text, bold: false });
  return parts;
}

function highlightKeyword(text: string, keyword?: string | null): React.ReactNode {
  if (!keyword || !text) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length);
  return (
    <>
      {before}
      <mark style={{ background: 'rgba(20,184,166,0.25)', color: 'var(--teal)', padding: '0 2px', borderRadius: 2 }}>
        {match}
      </mark>
      {after}
    </>
  );
}

interface MarkdownInlineProps {
  text: string;
  keyword?: string | null;
}

/** Renders inline **bold** markdown and optional keyword highlight. */
export function MarkdownInline({ text, keyword }: MarkdownInlineProps) {
  if (!text) return null;
  const segments = splitBoldSegments(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i}>{highlightKeyword(seg.text, keyword)}</strong>
        ) : (
          <span key={i}>{highlightKeyword(seg.text, keyword)}</span>
        )
      )}
    </>
  );
}
