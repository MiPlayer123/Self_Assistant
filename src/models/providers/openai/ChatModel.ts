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

  async sendMessageStream(
    message: string,
    context?: ContextData,
    conversationHistory?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<ModelResponse<string>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You may be provided with an image analysis summary to help provide context for your response.
          
          You can:
          - Answer questions about anything
          - Use image analysis summaries to understand what the user is seeing
          - Help with coding, writing, problem-solving
          - Provide explanations and guidance
          
          Be helpful, concise, and friendly. 
          Provide a response that answers the question using any provided image analysis as context.
          `
        }
      ]

      // Add conversation history
      if (conversationHistory && conversationHistory.length > 0) {
        // Take last 25 messages to avoid token limits
        const recentHistory = conversationHistory.slice(-25)
        for (const msg of recentHistory) {
          if (msg.role !== 'system') {
            // For conversation history, just include text content without re-analyzing images
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content
            })
          }
        }
      }

      // Handle current message with potential image analysis
      let userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: message }];

      if (context?.screenshot) {
        console.log('Attaching image for targeted analysis...');
        
        userMessageContent = [
          {
            type: "text",
            text: `Analyze the attached screenshot in the context of my query: "${message}". Please provide a direct and relevant response.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${context.screenshot.base64}`,
              detail: "high"
            }
          }
        ];
        
        console.log('Image attached, proceeding with streaming response...');
      }

      messages.push({
        role: "user",
        content: userMessageContent
      })

      // Create streaming completion
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

      // Process the stream
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          const chunkContent = delta.content
          fullContent += chunkContent
          if (onChunk) {
            onChunk(chunkContent)
          }
        }

        // Capture usage info from the final chunk
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

  async isScreenshotRequired(message: string, screenshot: string): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Does the following query require the attached screenshot to be answered effectively? Respond with only "true" or "false".\n\nQuery: "${message}"`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshot}`,
                  detail: "low" // Use low detail for faster processing
                }
              }
            ]
          }
        ],
        max_tokens: 10
      });

      const result = response.choices[0]?.message?.content?.trim().toLowerCase();
      return result === "true";
    } catch (error: any) {
      console.error('OpenAI screenshot check error:', error);
      // In case of error, assume screenshot is not required to avoid unnecessary processing
      return false;
    }
  }
} 