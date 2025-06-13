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
        // TODO: Implement local problem-solving model
        throw new Error('Local problem-solving model not yet implemented')
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
    return this.model.extractProblem(imageData, language)
  }

  public async generateSolutions(problemInfo: ProblemInfo): Promise<ModelResponse<GeneratedSolutions>> {
    return this.model.generateSolutions(problemInfo)
  }

  public async debugCode(problemInfo: ProblemInfo, imageData: string[]): Promise<ModelResponse<DebugInfo>> {
    return this.model.debugCode(problemInfo, imageData)
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
  const [providerId, modelValue] = modelId.split(':')

  if (!providerId || !modelValue) {
    throw new Error(`Invalid model ID format: ${modelId}. Expected format 'provider:model'.`)
  }

  const apiKey = await getApiKey(providerId)

  switch (providerId) {
    case 'openai':
      const { OpenAIChatModel } = await import('./providers/openai/ChatModel')
      return new OpenAIChatModel({
        apiKey,
        model: modelValue,
        temperature: 0.7,
        maxTokens: 2000, // Default max tokens
      })
    case 'anthropic':
      const { ClaudeChatModel } = await import('./providers/anthropic/ChatModel')
      return new ClaudeChatModel({
        apiKey,
        model: modelValue,
        temperature: 0.7,
        maxTokens: 2000, // Default max tokens
      })
    case 'google':
      // TODO: Implement GoogleChatModel
      throw new Error('Google model not yet implemented')
    default:
      throw new Error(`Unsupported model provider: ${providerId}`)
  }
} 