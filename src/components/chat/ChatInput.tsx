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

  // Adjust the opacity of the bottom bar
  const inputBarStyle = {
    opacity: 0.7, // Reduce this to 0.2-0.3
    // ... other styles ...
  };

  return (
    <div className="wagoo-chat-input-container flex items-center justify-center py-2 px-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-2xl">
        {/* Screenshot button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          disabled={isProcessing}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors
            ${hasScreenshot ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
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
            className="wagoo-input disabled:opacity-50 disabled:cursor-not-allowed focus:ring-0 focus:border-transparent"
            rows={1}
            style={{
              minHeight: '38px',
              maxHeight: '120px',
              height: 'auto',
              resize: 'none',
              padding: '8px 12px',
              borderRadius: '9999px', // Makes it pill-shaped
              border: '1px solid var(--wagoo-border-secondary)',
              backgroundColor: 'var(--wagoo-bg-tertiary)',
              color: 'var(--wagoo-text-primary)',
            }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || isProcessing}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send message"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            '↑'
          )}
        </button>
      </form>
    </div>
  )
} 