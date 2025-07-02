import React, { useRef, useEffect } from 'react'
import { ChatMessage as ChatMessageType } from '../../types/chat'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getMarkdownForSelection } from '../../lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
}

interface CodeComponentProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  [key: string]: any; // Allow other props
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const messageContentRef = useRef<HTMLDivElement>(null)

  // Handle copy events to provide clean markdown text and formatted HTML
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      // Check if selection is within this message
      const range = selection.getRangeAt(0)
      const messageElement = messageContentRef.current
      if (!messageElement || !messageElement.contains(range.commonAncestorContainer)) return

      // Get the raw markdown content for assistant messages
      if (!isUser && !isSystem) {
        e.preventDefault()
        
        // Get selected text from the rendered content
        const selectedText = selection.toString()
        
        if (selectedText.trim()) {
          const fullText = messageElement.textContent || ''
          const isFullSelection = selectedText.trim() === fullText.trim()
          
          // Use the utility function to get the best markdown representation
          const markdownText = getMarkdownForSelection(
            selectedText,
            message.content,
            isFullSelection
          )
          
          // Get the HTML content for rich text formatting
          let htmlContent = ''
          
          if (isFullSelection) {
            // For full selection, get the entire rendered HTML
            htmlContent = messageElement.innerHTML
          } else {
            // For partial selection, get the HTML from the selection
            const container = document.createElement('div')
            container.appendChild(range.cloneContents())
            htmlContent = container.innerHTML
          }
          
          // Clean up the HTML to normalize styling
          const cleanedHtml = cleanHtmlForCopy(htmlContent)
          
          // Set both plain text (markdown) and rich text (HTML) in clipboard
          e.clipboardData?.setData('text/plain', markdownText)
          e.clipboardData?.setData('text/html', cleanedHtml)
        }
      }
    }

    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [message.content, isUser, isSystem])

  // Function to clean HTML and normalize styling for copy/paste
  const cleanHtmlForCopy = (html: string): string => {
    // Create a temporary div to manipulate the HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove or normalize problematic styles and classes
    const allElements = tempDiv.querySelectorAll('*')
    allElements.forEach(element => {
      // Remove all classes to avoid CSS conflicts
      element.removeAttribute('class')
      
      // Remove ALL inline styles first
      element.removeAttribute('style')
      
      // Remove any color-related attributes
      element.removeAttribute('color')
      
      // Keep structural attributes but normalize them with black text
      if (element.tagName === 'CODE') {
        // For inline code, add basic styling with black text
        element.setAttribute('style', 'font-family: monospace; background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; color: #000000;')
      } else if (element.tagName === 'PRE') {
        // For code blocks, add basic styling with black text
        element.setAttribute('style', 'font-family: monospace; background-color: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto; color: #000000;')
      } else if (element.tagName === 'STRONG' || element.tagName === 'B') {
        // Keep bold formatting with black text
        element.setAttribute('style', 'font-weight: bold; color: #000000;')
      } else if (element.tagName === 'EM' || element.tagName === 'I') {
        // Keep italic formatting with black text
        element.setAttribute('style', 'font-style: italic; color: #000000;')
      } else if (element.tagName === 'UL' || element.tagName === 'OL') {
        // Basic list styling with black text
        element.setAttribute('style', 'margin: 8px 0; padding-left: 20px; color: #000000;')
      } else if (element.tagName === 'LI') {
        // Basic list item styling with black text
        element.setAttribute('style', 'margin: 4px 0; color: #000000;')
      } else if (element.tagName === 'P') {
        // Basic paragraph styling with black text
        element.setAttribute('style', 'margin: 8px 0; color: #000000;')
      } else if (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3' || element.tagName === 'H4' || element.tagName === 'H5' || element.tagName === 'H6') {
        // Basic heading styling with black text
        const level = parseInt(element.tagName.charAt(1))
        const fontSize = Math.max(16, 24 - (level * 2))
        element.setAttribute('style', `font-size: ${fontSize}px; font-weight: bold; margin: 12px 0 8px 0; color: #000000;`)
      } else {
        // For any other element, ensure black text
        element.setAttribute('style', 'color: #000000;')
      }
    })
    
    // Handle syntax highlighter elements specifically
    const codeBlocks = tempDiv.querySelectorAll('div[style*="background"], div[class*="language-"], span[style*="color"]')
    codeBlocks.forEach(block => {
      if (block.textContent && block.textContent.trim()) {
        // Replace syntax highlighter divs with simple pre elements
        const preElement = document.createElement('pre')
        preElement.textContent = block.textContent
        preElement.setAttribute('style', 'font-family: monospace; background-color: #f4f4f4; padding: 12px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto; color: #000000;')
        block.parentNode?.replaceChild(preElement, block)
      }
    })
    
    // Additional cleanup: remove any remaining elements with style attributes that might contain colors
    tempDiv.querySelectorAll('[style]').forEach(element => {
      const currentStyle = element.getAttribute('style') || ''
      // Remove any color, background-color properties and add black text
      const cleanStyle = currentStyle
        .replace(/color\s*:\s*[^;]+;?/gi, '')
        .replace(/background-color\s*:\s*[^;]+;?/gi, '')
        .replace(/text-color\s*:\s*[^;]+;?/gi, '')
        .trim()
      
      // Ensure black text color
      const finalStyle = cleanStyle ? `${cleanStyle}; color: #000000;` : 'color: #000000;'
      element.setAttribute('style', finalStyle)
    })
    
    // Wrap in a div with normalized base styling and force black text
    const wrapper = `<div style="color: #000000 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.5;">${tempDiv.innerHTML}</div>`
    
    return wrapper
  }

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-2`}>
      <div className="max-w-[95%]">
        {/* Message bubble */}
        <div
          className={isUser ? 'wagoo-message-user' : 'wagoo-message-assistant'}
        >
          <div 
            ref={messageContentRef}
            className="break-words max-w-full"
            style={{ 
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text'
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({
                  node,
                  inline,
                  className,
                  children,
                  style,
                  ...rest
                }: CodeComponentProps) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={coldarkDark as { [key: string]: React.CSSProperties }}
                      language={match[1]}
                      PreTag="div"
                      wrapLongLines={true}
                      {...rest}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} style={style} {...rest}>
                      {children}
                    </code>
                  )
                },
                pre: ({ node, ...props }) => (
                  <pre className="overflow-x-auto p-2 rounded-md max-w-full w-full block" {...props} />
                ),
                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-6 mb-1 last:mb-0" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-6 mb-1 last:mb-0" {...props} />,
                li: ({ node, ...props }) => <li {...props} />,
                strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                em: ({ node, ...props }) => <em className="italic" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
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
        <div className={`wagoo-timestamp ${isUser ? 'text-right' : 'text-left'}`}>
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