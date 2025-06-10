import { ModelConfig, ModelResponse } from './types'
import { ChatMessage, ContextData } from '../../types/chat'

export abstract class BaseChatModel {
  protected config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
  }

  // General chat method - send message with optional context
  abstract sendMessage(
    message: string, 
    context?: ContextData,
    conversationHistory?: ChatMessage[]
  ): Promise<ModelResponse<string>>

  // Optional: Analyze screenshot without specific structure
  abstract analyzeImage(
    imageData: string,
    prompt?: string
  ): Promise<ModelResponse<string>>
} 