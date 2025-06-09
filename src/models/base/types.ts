// Base types for AI model abstraction
export interface ModelConfig {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}

export interface ModelResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ProblemInfo {
  problemDescription: string
  constraints: string[]
  examples: Array<{
    input: string
    output: string
    explanation?: string
  }>
  hints?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  language: string
}

export interface Solution {
  code: string
  explanation: string
  timeComplexity: string
  spaceComplexity: string
  approach: string
  keyInsights: string[]
}

export interface GeneratedSolutions {
  problemInfo: ProblemInfo
  solutions: Solution[]
  additionalNotes?: string
}

export interface DebugInfo {
  error: string
  possibleCauses: string[]
  suggestions: string[]
  fixedCode?: string
}

export abstract class BaseModel {
  protected config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
  }

  abstract extractProblem(imageData: string[], language: string): Promise<ModelResponse<ProblemInfo>>
  abstract generateSolutions(problemInfo: ProblemInfo): Promise<ModelResponse<GeneratedSolutions>>
  abstract debugCode(problemInfo: ProblemInfo, imageData: string[]): Promise<ModelResponse<DebugInfo>>
} 