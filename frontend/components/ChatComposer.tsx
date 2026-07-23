'use client';

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface ChatComposerHandle {
  focus: () => void;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_HEIGHT = 72;

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { value, onChange, onSubmit, disabled = false, placeholder = 'Ask AI to tweak the resume...' },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <form onSubmit={onSubmit} className="chat-input-area">
      <div className="chat-compose-wrap">
        <textarea
          ref={textareaRef}
          className="chat-compose-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          type="submit"
          className={`chat-compose-send${canSend ? ' chat-compose-send--active' : ''}`}
          disabled={!canSend}
          aria-label="Send message"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </form>
  );
});

export default ChatComposer;
