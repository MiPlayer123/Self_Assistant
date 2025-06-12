import { ModelConfig, ModelResponse } from './types'
import { ChatMessage, ContextData } from '../../types/chat'
import { Tool } from '../../types/tools'
import { ToolRegistry } from '../../tools/ToolRegistry'

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
    onChunk?: (chunk: string, isFunctionCall?: boolean, toolName?: string) => void, // Added isFunctionCall and toolName
    tools?: Tool[], // Changed from Tool[] to any[] to match OpenAI's type for now
    toolRegistry?: ToolRegistry // Added toolRegistry
  ): Promise<ModelResponse<string>>
} 