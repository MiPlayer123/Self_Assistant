import { BaseModel, ModelConfig, ModelResponse, ProblemInfo, GeneratedSolutions, DebugInfo } from './base/types'
import { OpenAIModel } from './providers/openai/OpenAIModel'
import { IChatModel } from '../types/chat'
// import { AI_MODEL_PROVIDERS } from '../lib/aiModels' // This import is not directly used in this file but by other files for model listings

export type ModelProvider = 'openai' | 'claude' | 'local'

export interface ModelManagerConfig {
  provider: ModelProvider
  config: ModelConfig
}

export class ModelManager {
  private model: BaseModel
  private currentProvider: ModelProvider

  constructor(managerConfig: ModelManagerConfig) {
    this.currentProvider = managerConfig.provider
    this.model = this.createModel(managerConfig.provider, managerConfig.config)
  }

  private createModel(provider: ModelProvider, config: ModelConfig): BaseModel {
    switch (provider) {
      case 'openai':
        return new OpenAIModel(config)
      case 'claude':
        // TODO: Implement Claude problem-solving model if needed, otherwise throw or return a placeholder
        throw new Error('Claude problem-solving model not yet implemented')
      case 'local':
        // As per user request, LocalModel is not used for problem solving
        throw new Error('Local problem-solving model is not supported. Only Local Chat Model is available.')
      default:
        throw new Error(`Unsupported model provider: ${provider}`)
    }
  }

  public switchModel(provider: ModelProvider, config: ModelConfig): void {
    this.currentProvider = provider
    this.model = this.createModel(provider, config)
  }

  public getCurrentProvider(): ModelProvider {
    return this.currentProvider
  }

  public async extractProblem(imageData: string[], language: string): Promise<ModelResponse<ProblemInfo>> {
    // Problem solving with local model is not supported directly through BaseModel
    throw new Error('Local problem extraction not supported.')
  }

  public async generateSolutions(problemInfo: ProblemInfo): Promise<ModelResponse<GeneratedSolutions>> {
    // Problem solving with local model is not supported directly through BaseModel
    throw new Error('Local solution generation not supported.')
  }

  public async debugCode(problemInfo: ProblemInfo, imageData: string[]): Promise<ModelResponse<DebugInfo>> {
    // Problem solving with local model is not supported directly through BaseModel
    throw new Error('Local code debugging not supported.')
  }
}

// Singleton instance for global access for the ModelManager (problem-solving)
let modelManagerInstance: ModelManager | null = null

export function initializeModelManager(config: ModelManagerConfig): ModelManager {
  modelManagerInstance = new ModelManager(config)
  return modelManagerInstance
}

export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    throw new Error('ModelManager not initialized. Call initializeModelManager first.')
  }
  return modelManagerInstance
}

// Helper function to get API key from environment for any provider
export async function getApiKey(providerId: string): Promise<string> {
  let envVarName: string
  switch (providerId) {
    case 'openai':
      envVarName = 'VITE_OPENAI_API_KEY'
      break
    case 'anthropic':
      envVarName = 'VITE_ANTHROPIC_API_KEY'
      break
    case 'google':
      envVarName = 'VITE_GOOGLE_API_KEY'
      break
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }

  if (typeof window !== 'undefined' && (window as any).electronAPI?.getEnvVar) {
    try {
      const apiKey = await (window as any).electronAPI.getEnvVar(envVarName)
      if (apiKey) {
        return apiKey
      }
    } catch (error) {
      console.error(`Failed to get ${providerId} API key from IPC:`, error)
    }
  }

  throw new Error(`${providerId} API key not found. Please set ${envVarName} in your .env file.`)
}

// Factory function to get chat model (for the new chat feature)
export async function getChatModel(modelId: string): Promise<IChatModel> {
  let providerId: string;
  let actualModelValue: string;

  if (modelId.startsWith('local-')) {
    providerId = 'local';
    actualModelValue = modelId.substring(6); // Remove 'local-' prefix to get the full filename
  } else {
    // For non-local models, split by ':' as before
    const parts = modelId.split(':');
    if (parts.length < 2) {
      throw new Error(`Invalid model ID format: ${modelId}. Expected format 'provider:model' or 'local-modelName'.`);
    }
    providerId = parts[0];
    actualModelValue = parts.slice(1).join(':'); // Rejoin in case modelValue itself contains ':'
  }

  if (!providerId || !actualModelValue) {
    throw new Error(`Invalid model ID format: ${modelId}. Expected format 'provider:model' or 'local-modelName'.`);
  }

  // Local models don't need API keys
  if (providerId === 'local') {
    const { LocalChatModel } = await import('./providers/local/ChatModel')
    return new LocalChatModel({
      apiKey: '', // Not needed for local models
      model: actualModelValue, // This will now be the full filename for local models
      temperature: 0.7,
      maxTokens: 2000,
    })
  }

  const apiKey = await getApiKey(providerId)

  switch (providerId) {
    case 'openai':
      const { OpenAIChatModel } = await import('./providers/openai/ChatModel')
      return new OpenAIChatModel({
        apiKey,
        model: actualModelValue,
        temperature: 0.7,
        maxTokens: 2000, // Default max tokens
      })
    case 'anthropic':
      const { ClaudeChatModel } = await import('./providers/anthropic/ChatModel')
      return new ClaudeChatModel({
        apiKey,
        model: actualModelValue,
        temperature: 0.7,
        maxTokens: 2000, // Default max tokens
      })
    case 'google':
      const { GeminiChatModel } = await import('./providers/google/ChatModel')
      return new GeminiChatModel({
        apiKey,
        model: actualModelValue,
        temperature: 0.7,
        maxTokens: 2000, // Default max tokens
      })
    default:
      throw new Error(`Unsupported model provider: ${providerId}`)
  }
} 