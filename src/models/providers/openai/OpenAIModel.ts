import OpenAI from 'openai'
import { BaseModel, ModelConfig, ModelResponse, ProblemInfo, GeneratedSolutions, DebugInfo } from '../../base/types'
import { zodResponseFormat } from "openai/helpers/zod"
import { z } from "zod"

// Zod schemas for structured outputs
const ProblemInfoSchema = z.object({
  problemDescription: z.string().describe("Clear description of the coding problem"),
  constraints: z.array(z.string()).describe("List of constraints and requirements"),
  examples: z.array(z.object({
    input: z.string().describe("Example input"),
    output: z.string().describe("Expected output"),
    explanation: z.string().nullable().optional().describe("Explanation of the example")
  })).describe("Input/output examples"),
  hints: z.array(z.string()).nullable().optional().describe("Helpful hints for solving the problem"),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional().describe("Problem difficulty level"),
  language: z.string().describe("Programming language")
})

const SolutionSchema = z.object({
  code: z.string().describe("Complete, runnable code solution"),
  explanation: z.string().describe("Detailed explanation of the solution approach"),
  timeComplexity: z.string().describe("Time complexity analysis (e.g., O(n))"),
  spaceComplexity: z.string().describe("Space complexity analysis (e.g., O(1))"),
  approach: z.string().describe("High-level approach or algorithm used"),
  keyInsights: z.array(z.string()).describe("Key insights that make this solution work")
})

const GeneratedSolutionsSchema = z.object({
  problemInfo: ProblemInfoSchema,
  solutions: z.array(SolutionSchema).describe("Multiple solution approaches"),
  additionalNotes: z.string().nullable().optional().describe("Additional notes or alternative approaches")
})

const DebugInfoSchema = z.object({
  error: z.string().describe("Description of the error or issue"),
  possibleCauses: z.array(z.string()).describe("Possible causes of the error"),
  suggestions: z.array(z.string()).describe("Suggestions to fix the error"),
  fixedCode: z.string().nullable().optional().describe("Corrected code if applicable")
})

export class OpenAIModel extends BaseModel {
  private openai: OpenAI

  constructor(config: ModelConfig) {
    super(config)
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Allow browser usage
    })
  }

  async extractProblem(imageData: string[], language: string): Promise<ModelResponse<ProblemInfo>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are an expert at analyzing coding interview screenshots and extracting problem information. 
          
          Your task is to:
          1. Analyze the provided screenshot(s) of a coding problem
          2. Extract the problem description, constraints, examples, and any hints
          3. Return structured data that can be used to generate solutions
          
          Be thorough and accurate. If multiple screenshots are provided, consider them as parts of the same problem.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze these screenshot(s) of a coding problem and extract all relevant information. The target programming language is: ${language}`
            },
            ...imageData.map(data => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/png;base64,${data}`,
                detail: "high" as const
              }
            }))
          ]
        }
      ]

      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages,
        response_format: zodResponseFormat(ProblemInfoSchema, "problem_info"),
        temperature: this.config.temperature || 0.1,
        max_tokens: this.config.maxTokens || 2000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      const parsed = JSON.parse(content)
      
      return {
        success: true,
        data: {
          ...parsed,
          language // Ensure language is set
        },
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('OpenAI extractProblem error:', error)
      return {
        success: false,
        error: error.message || 'Failed to extract problem information'
      }
    }
  }

  async generateSolutions(problemInfo: ProblemInfo): Promise<ModelResponse<GeneratedSolutions>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are an expert coding interview coach. Generate multiple high-quality solutions for coding problems.
          
          Your task is to:
          1. Provide 2-3 different solution approaches when possible (brute force, optimized, alternative)
          2. Include complete, runnable code for each solution
          3. Explain the approach, time/space complexity, and key insights
          4. Ensure code follows best practices and is interview-ready
          
          Focus on clarity, correctness, and educational value.`
        },
        {
          role: "user",
          content: `Generate solutions for this coding problem:

Problem: ${problemInfo.problemDescription}

Constraints: ${problemInfo.constraints.join(', ')}

Examples: ${problemInfo.examples.map(ex => `Input: ${ex.input}, Output: ${ex.output}${ex.explanation ? `, Explanation: ${ex.explanation}` : ''}`).join(' | ')}

${problemInfo.hints ? `Hints: ${problemInfo.hints.join(', ')}` : ''}

Target language: ${problemInfo.language}
Difficulty: ${problemInfo.difficulty || 'unknown'}`
        }
      ]

      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages,
        response_format: zodResponseFormat(GeneratedSolutionsSchema, "generated_solutions"),
        temperature: this.config.temperature || 0.1,
        max_tokens: this.config.maxTokens || 4000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      const parsed = JSON.parse(content)
      
      return {
        success: true,
        data: parsed,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('OpenAI generateSolutions error:', error)
      return {
        success: false,
        error: error.message || 'Failed to generate solutions'
      }
    }
  }

  async debugCode(problemInfo: ProblemInfo, imageData: string[]): Promise<ModelResponse<DebugInfo>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are an expert debugging assistant for coding interviews. Analyze code errors and provide helpful debugging information.
          
          Your task is to:
          1. Identify the error or issue from the screenshot(s)
          2. Explain possible causes
          3. Provide specific suggestions to fix the issue
          4. If possible, provide corrected code
          
          Be specific and actionable in your debugging advice.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze these screenshot(s) showing a coding error or issue. 

Original problem context:
Problem: ${problemInfo.problemDescription}
Language: ${problemInfo.language}
Constraints: ${problemInfo.constraints.join(', ')}

Help debug the issue shown in the screenshot(s):`
            },
            ...imageData.map(data => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/png;base64,${data}`,
                detail: "high" as const
              }
            }))
          ]
        }
      ]

      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages,
        response_format: zodResponseFormat(DebugInfoSchema, "debug_info"),
        temperature: this.config.temperature || 0.1,
        max_tokens: this.config.maxTokens || 2000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      const parsed = JSON.parse(content)
      
      return {
        success: true,
        data: parsed,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('OpenAI debugCode error:', error)
      return {
        success: false,
        error: error.message || 'Failed to debug code'
      }
    }
  }
} 