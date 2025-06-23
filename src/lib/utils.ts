// src/lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Attempts to preserve markdown formatting when copying selected text
 * This provides a better user experience similar to ChatGPT and Claude
 */
export function getMarkdownForSelection(
  selectedText: string, 
  fullMarkdown: string,
  isFullSelection: boolean
): string {
  // If the entire message is selected, return the full markdown
  if (isFullSelection) {
    return fullMarkdown
  }

  // For partial selections, we'll do basic markdown preservation
  // This is a simplified approach - a full implementation would need
  // more sophisticated text-to-markdown mapping
  
  // Clean up the selected text (remove extra whitespace)
  const cleanText = selectedText.trim()
  
  // If it's a short selection, likely just plain text
  if (cleanText.length < 50) {
    return cleanText
  }

  // Try to detect and preserve some common markdown patterns
  let result = cleanText

  // Preserve code blocks if the selection seems to contain them
  if (fullMarkdown.includes('```') && selectedText.includes('\n')) {
    // Simple heuristic: if selection has multiple lines and original has code blocks,
    // check if we're selecting code
    const lines = selectedText.split('\n')
    if (lines.length > 2 && lines.some(line => line.trim().length > 0)) {
      // This might be a code block selection
      const firstLine = lines[0].trim()
      const lastLine = lines[lines.length - 1].trim()
      
      // If it looks like code (indented or has programming symbols)
      if (lines.some(line => /^[\s]*[{}\[\]();]|^[\s]*[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]/.test(line))) {
        result = '```\n' + cleanText + '\n```'
      }
    }
  }

  // Preserve bold/italic if present in the original markdown
  if (fullMarkdown.includes('**') || fullMarkdown.includes('*')) {
    // Simple pattern matching for emphasis
    result = result.replace(/\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)*)\b/g, (match) => {
      if (fullMarkdown.includes(`**${match}**`)) return `**${match}**`
      if (fullMarkdown.includes(`*${match}*`)) return `*${match}*`
      return match
    })
  }

  return result
}
