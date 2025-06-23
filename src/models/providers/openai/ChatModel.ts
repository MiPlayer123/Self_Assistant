import OpenAI from 'openai'
import { ChatMessage, ContextData, IChatModel, ChatModelConfig } from '../../../types/chat'
import { buildOpenAIMessages } from '../../../prompts/openai' // Import the new prompt builder
import { shouldPerformSearch, performWebSearch } from '../../../utils/searchUtils'

export class OpenAIChatModel implements IChatModel {
  private openai: OpenAI;
  private config: ChatModelConfig; // Store the config

  constructor(config: ChatModelConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Allow browser usage
    })
  }

  async sendMessageStream(
    message: string,
    contextData?: ContextData,
    conversationHistory?: ChatMessage[],
    onChunk?: (chunk: string) => void,
    onSearchStatusChange?: (isSearching: boolean) => void
  ): Promise<{ success: boolean; error?: string; data?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    try {
      // Check if search is needed and perform it
      if (await shouldPerformSearch(message, conversationHistory)) {
        const searchResults = await performWebSearch(message, 3, onSearchStatusChange);
        if (searchResults) {
          contextData = { 
            ...contextData, 
            searchResults 
          };
        }
      }

      // Use the modular prompt builder
      const messages = buildOpenAIMessages(message, conversationHistory || [], contextData);

      // Create streaming completion
      const stream = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
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
        model: this.config.model,
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