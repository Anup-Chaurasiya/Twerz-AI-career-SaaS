'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageContentProps {
  content: string;
}

export default function ChatMessageContent({ content }: ChatMessageContentProps) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <p className="chat-md-heading">{children}</p>,
          h2: ({ children }) => <p className="chat-md-heading">{children}</p>,
          h3: ({ children }) => <p className="chat-md-heading">{children}</p>,
          h4: ({ children }) => <p className="chat-md-subheading">{children}</p>,
          p: ({ children }) => <p className="chat-md-p">{children}</p>,
          ul: ({ children }) => <ul className="chat-md-list">{children}</ul>,
          ol: ({ children }) => <ol className="chat-md-list chat-md-list--ordered">{children}</ol>,
          li: ({ children }) => <li className="chat-md-li">{children}</li>,
          strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
