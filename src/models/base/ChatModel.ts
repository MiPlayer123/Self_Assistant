import { ModelConfig, ModelResponse } from './types'
import { ChatMessage, ContextData } from '../../types/chat'

export abstract class BaseChatModel {
  protected config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
  }

  // Streaming version of sendMessage
  abstract sendMessageStream(
    message: string,
    context?: ContextData,
    conversationHistory?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<ModelResponse<string>>
} 