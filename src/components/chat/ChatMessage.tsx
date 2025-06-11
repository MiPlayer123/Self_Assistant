import React from 'react'
import { ChatMessage as ChatMessageType } from '../../types/chat'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  // Adjust the opacity of message bubbles
  const messageStyle = {
    opacity: 0.7, // Reduce this to 0.2-0.3
    // ... other styles ...
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="wagoo-message-system">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4`}>
      <div className="max-w-[85%]">
        {/* Message bubble */}
        <div
          className={isUser ? 'wagoo-message-user' : 'wagoo-message-assistant'}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          
          {/* Screenshot preview if available */}
          {message.context?.screenshot && (
            <div className="mt-3">
              <div className="text-xs opacity-75 mb-2">
                📸 Screenshot included
              </div>
              <img
                src={message.context.screenshot.preview}
                alt="Screenshot"
                className="max-w-full max-h-64 h-auto rounded-lg wagoo-border cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  // Open screenshot in new window for full view
                  const newWindow = window.open()
                  if (newWindow && message.context?.screenshot) {
                    newWindow.document.write(`<img src="${message.context.screenshot.preview}" style="max-width:100%;height:auto;" />`)
                  }
                }}
              />
              <div className="text-xs wagoo-text-muted mt-1">
                Click to view full size
              </div>
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div className={`wagoo-timestamp mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
          {message.status === 'sending' && (
            <span className="ml-1">
              <div className="inline-block w-2 h-2 wagoo-text-muted rounded-full wagoo-pulse"></div>
            </span>
          )}
          {message.status === 'streaming' && (
            <span className="ml-1 wagoo-text-accent">
              <div className="inline-flex items-center gap-1">
                <div className="inline-block w-1 h-1 bg-current rounded-full wagoo-pulse"></div>
                <div className="inline-block w-1 h-1 bg-current rounded-full wagoo-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="inline-block w-1 h-1 bg-current rounded-full wagoo-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </span>
          )}
          {message.status === 'error' && (
            <span className="ml-1" style={{ color: 'var(--wagoo-accent-error)' }}>Failed</span>
          )}
        </div>
      </div>
    </div>
  )
} 