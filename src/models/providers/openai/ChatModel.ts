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
      let userMessageContent = message

      if (context?.screenshot) {
        // Step 1: Analyze the image separately first (non-streaming for analysis)
        console.log('Analyzing uploaded image...')
        const imageAnalysisPrompt = `Analyze this image in detail. Describe:
1. What type of content or interface is shown
2. Key visual elements, text, and components - transcribe any text you see
3. Any errors, issues, or important details visible
4. Overall context and purpose of what's displayed

Provide a comprehensive but concise analysis that will help an AI assistant understand what the user is seeing.`

        const analysisResponse = await this.analyzeImage(context.screenshot.base64, imageAnalysisPrompt)
        
        if (analysisResponse.success && analysisResponse.data) {
          // Step 2: Include the analysis summary with the user's message
          userMessageContent = `${message}

[IMAGE ANALYSIS CONTEXT]
${analysisResponse.data}
[END IMAGE ANALYSIS]

Please use the image analysis above to help answer my question or provide relevant assistance.`
          
          console.log('Image analysis complete, proceeding with streaming response...')
        } else {
          console.warn('Image analysis failed:', analysisResponse.error)
          userMessageContent = `${message}\n\n(Note: I tried to analyze an uploaded image but the analysis failed. Please respond based on the text message only.)`
        }
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