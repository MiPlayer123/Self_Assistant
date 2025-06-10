import OpenAI from 'openai'
import { BaseChatModel } from '../../base/ChatModel'
import { ModelConfig, ModelResponse } from '../../base/types'
import { ChatMessage, ContextData } from '../../../types/chat'

export class OpenAIChatModel extends BaseChatModel {
  private openai: OpenAI

  constructor(config: ModelConfig) {
    super(config)
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Allow browser usage
    })
  }

  private messageNeedsVisualContext(message: string): boolean {
    const visualKeywords = [
      'see', 'look', 'show', 'visible', 'screen', 'display', 'image', 'picture',
      'what', 'where', 'how', 'describe', 'explain', 'analyze', 'read',
      'interface', 'button', 'click', 'element', 'page', 'website', 'app',
      'error', 'problem', 'issue', 'help', 'guide', 'tutorial', 'navigate'
    ]
    
    const lowerMessage = message.toLowerCase()
    return visualKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  async sendMessage(
    message: string,
    context?: ContextData,
    conversationHistory?: ChatMessage[]
  ): Promise<ModelResponse<string>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You will also be given a screenshot of the user's screen for context to aid your response. 
          
          You can:
          - Answer questions about anything
          - Analyze screenshots and describe what you see
          - Help with coding, writing, problem-solving
          - Provide explanations and guidance
          
          Be helpful, concise, and friendly. 
          Provide a reposne that answers the question. 
          Use the screenshot to help answer the question or proide a useful response. Not all messages will have screenshots or are relevant to the question.
          
          The context in the screnshot might be reated to the text in the screenshot as well, so read the text in the screenshot to help answer the question.
          `
        }
      ]

      // Add conversation history
      if (conversationHistory && conversationHistory.length > 0) {
        // Take last 25 messages to avoid token limits
        const recentHistory = conversationHistory.slice(-25)
        for (const msg of recentHistory) {
          if (msg.role !== 'system') {
            // Check if message has screenshot context
            if (msg.context?.screenshot && msg.role === 'user') {
              messages.push({
                role: 'user',
                content: [
                  {
                    type: "text",
                    text: msg.content
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/png;base64,${msg.context.screenshot.base64}`,
                      detail: "high"
                    }
                  }
                ]
              })
            } else {
              messages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              })
            }
          }
        }
      }

      // Determine if we should include screenshot with current message
      let userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam

      if (context?.screenshot) {
        // Check if the message seems to need visual context
        const needsVisualContext = this.messageNeedsVisualContext(message)
        
        if (needsVisualContext) {
          userMessage = {
            role: "user",
            content: [
              {
                type: "text", 
                text: message
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${context.screenshot.base64}`,
                  detail: "high"
                }
              }
            ]
          }
        } else {
          // Include screenshot but mention it's available
          userMessage = {
            role: "user",
            content: `${message}\n\n(Note: I have a screenshot available if you need to see what's on my screen to help answer this)`
          }
        }
      } else {
        userMessage = {
          role: "user",
          content: message
        }
      }

      messages.push(userMessage)

      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      return {
        success: true,
        data: content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('OpenAI chat error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data
      })
      return {
        success: false,
        error: error.message || 'Failed to send message'
      }
    }
  }

  async analyzeImage(
    imageData: string,
    prompt: string = "What do you see in this image?"
  ): Promise<ModelResponse<string>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageData}`,
                detail: "high"
              }
            }
          ]
        }
      ]

      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      return {
        success: true,
        data: content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('OpenAI image analysis error:', error)
      return {
        success: false,
        error: error.message || 'Failed to analyze image'
      }
    }
  }
} 