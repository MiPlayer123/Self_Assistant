import OpenAI from 'openai'
import { BaseChatModel } from '../../base/ChatModel'
import { ModelConfig, ModelResponse } from '../../base/types'
import { ChatMessage, ContextData } from '../../../types/chat'
import { encode } from 'gpt-tokenizer'

// Constants for token management
const MAX_HISTORY_MESSAGES = 10 // Reduced from 25 to 10
const MAX_TOKENS_PER_REQUEST = 25000 // Conservative limit below the 30k TPM
const SYSTEM_PROMPT = `You are Wagoo, a helpful AI assistant. Be concise and friendly.`

export class OpenAIChatModel extends BaseChatModel {
  private openai: OpenAI
  private lastRequestTime: number = 0
  private minRequestInterval: number = 2000 // Minimum 2 seconds between requests

  constructor(config: ModelConfig) {
    super(config)
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Allow browser usage
    })
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest))
    }
    this.lastRequestTime = Date.now()
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  private truncateHistory(history: ChatMessage[]): ChatMessage[] {
    let totalTokens = this.countTokens(SYSTEM_PROMPT)
    const truncatedHistory: ChatMessage[] = []
    
    // Process messages in reverse order to keep most recent
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      if (msg.role === 'system') continue
      
      const messageTokens = this.countTokens(msg.content)
      if (totalTokens + messageTokens > MAX_TOKENS_PER_REQUEST) break
      
      truncatedHistory.unshift(msg)
      totalTokens += messageTokens
    }
    
    return truncatedHistory
  }

  async sendMessageStream(
    message: string,
    context?: ContextData,
    conversationHistory?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<ModelResponse<string>> {
    try {
      await this.waitForRateLimit()

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        }
      ]

      // Add truncated conversation history
      if (conversationHistory && conversationHistory.length > 0) {
        const truncatedHistory = this.truncateHistory(conversationHistory)
        for (const msg of truncatedHistory) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })
        }
      }

      // Handle current message with potential image analysis
      let userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: message }]

      if (context?.screenshot) {
        console.log('Attaching image for targeted analysis...')
        
        // Use low detail for image analysis to reduce token usage
        userMessageContent = [
          {
            type: "text",
            text: `Analyze the attached screenshot in the context of my query: "${message}". Please provide a direct and relevant response.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${context.screenshot.base64}`,
              detail: "low" // Changed from "high" to "low"
            }
          }
        ]
      }

      // Count tokens for current message
      const currentMessageTokens = this.countTokens(JSON.stringify(userMessageContent))
      if (currentMessageTokens > MAX_TOKENS_PER_REQUEST) {
        throw new Error(`Message too large: ${currentMessageTokens} tokens exceeds limit of ${MAX_TOKENS_PER_REQUEST}`)
      }

      messages.push({
        role: "user",
        content: userMessageContent
      })

      // Create streaming completion with retry logic
      let retryCount = 0
      const maxRetries = 3
      let lastError: any

      while (retryCount < maxRetries) {
        try {
          const stream = await this.openai.chat.completions.create({
            model: this.config.model || "gpt-4o",
            messages,
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 2000,
            stream: true,
          })

          let fullContent = ''
          let totalTokens = 0
          let promptTokens = 0
          let completionTokens = 0

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              const chunkContent = delta.content
              fullContent += chunkContent
              if (onChunk) {
                onChunk(chunkContent)
              }
            }

            if (chunk.usage) {
              totalTokens = chunk.usage.total_tokens || 0
              promptTokens = chunk.usage.prompt_tokens || 0
              completionTokens = chunk.usage.completion_tokens || 0
            }
          }

          if (!fullContent) {
            throw new Error('No content in OpenAI streaming response')
          }

          return {
            success: true,
            data: fullContent,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens
            }
          }
        } catch (error: any) {
          lastError = error
          if (error.status === 429) { // Rate limit error
            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff
            console.log(`Rate limited, retrying in ${waitTime}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retryCount++
          } else {
            throw error
          }
        }
      }

      throw lastError || new Error('Max retries exceeded')
    } catch (error: any) {
      console.error('OpenAI streaming chat error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data
      })
      return {
        success: false,
        error: error.message || 'Failed to send streaming message'
      }
    }
  }
} 