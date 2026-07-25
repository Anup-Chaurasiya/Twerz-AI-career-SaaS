'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageContentProps {
  content: string;
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="chat-md-heading">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="chat-md-heading">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="chat-md-heading">{children}</p>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <p className="chat-md-subheading">{children}</p>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="chat-md-p">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="chat-md-list">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="chat-md-list chat-md-list--ordered">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="chat-md-li">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="chat-md-strong">{children}</strong>
  ),
};

function ChatMessageContent({ content }: ChatMessageContentProps) {
  return (
    <div className="chat-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(ChatMessageContent);
