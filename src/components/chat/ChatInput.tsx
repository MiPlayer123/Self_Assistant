import React, { useState } from 'react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onTakeScreenshot: () => void
  isProcessing: boolean
  hasScreenshot: boolean
}

export function ChatInput({ 
  onSendMessage, 
  onTakeScreenshot, 
  isProcessing, 
  hasScreenshot 
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim())
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px'
      }
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="wagoo-chat-input-container">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        {/* Screenshot button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          disabled={isProcessing}
          className={`wagoo-screenshot-button ${hasScreenshot ? 'active' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={hasScreenshot ? 'Screenshot attached' : 'Take screenshot'}
        >
          📸
        </button>

        {/* Message input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Wagoo anything..."
            disabled={isProcessing}
            className="wagoo-input disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              height: '40px'
            }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || isProcessing}
          className="flex-shrink-0 w-10 h-10 wagoo-button disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send message"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            '↑'
          )}
        </button>
      </form>

      {/* Context indicator */}
      {hasScreenshot && (
        <div className="mt-2 wagoo-context-indicator">
          <span className="wagoo-status-dot"></span>
          Screenshot ready - AI will use it for visual context if needed
        </div>
      )}
    </div>
  )
} 