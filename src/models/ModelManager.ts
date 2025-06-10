import { BaseModel, ModelConfig, ModelResponse, ProblemInfo, GeneratedSolutions, DebugInfo } from './base/types'
import { OpenAIModel } from './providers/openai/OpenAIModel'

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
        // TODO: Implement Claude model
        throw new Error('Claude model not yet implemented')
      case 'local':
        // TODO: Implement local model
        throw new Error('Local model not yet implemented')
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

// Singleton instance for global access
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

// Helper function to get API key from environment  
export async function getOpenAIApiKey(): Promise<string> {
  // In renderer process, try to get from global object set by preload script
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getEnvVar) {
    try {
      const apiKey = await (window as any).electronAPI.getEnvVar('VITE_OPENAI_API_KEY') || 
                     await (window as any).electronAPI.getEnvVar('OPENAI_API_KEY')
      if (apiKey) {
        return apiKey
      }
    } catch (error) {
      console.error('Failed to get API key from IPC:', error)
    }
  }
  
  // Fallback error message
  throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file.')
} 