'use client';

import { memo } from 'react';
import { ChatMessage } from '@/types';
import ChatMessageContent from './ChatMessageContent';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function ChatMessageBubble({ message, isStreaming }: ChatMessageBubbleProps) {
  const isEmptyStreaming = isStreaming && !message.content.trim();

  return (
    <div
      className={`chat-bubble ${message.role}${isStreaming ? ' chat-bubble--streaming' : ''}`}
    >
      {message.role === 'assistant' ? (
        isEmptyStreaming ? (
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <ChatMessageContent content={message.content} />
        )
      ) : (
        message.content
      )}
    </div>
  );
}

export default memo(ChatMessageBubble);
