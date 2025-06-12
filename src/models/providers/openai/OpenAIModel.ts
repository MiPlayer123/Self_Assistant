import OpenAI from 'openai'
import OpenAI from 'openai'
import { BaseModel, ModelConfig, ModelResponse, ProblemInfo, GeneratedSolutions, DebugInfo } from '../../base/types'
import { ChatMessage, ContextData } from '../../../types/chat'
import { Tool, FunctionCall } from '../../../types/tools'
import { ToolRegistry } from '../../../tools/ToolRegistry'
import { zodResponseFormat } from "openai/helpers/zod"
import { z } from "zod"
import { countTokens } from '../../../utils/tokenizer'

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

  async sendMessageStream(
    message: string,
    context?: ContextData, // ContextData might not be directly used if image data is handled differently
    conversationHistory: ChatMessage[] = [],
    onChunk?: (chunk: string, isFunctionCall?: boolean, toolName?: string) => void,
    tools?: Tool[],
    toolRegistry?: ToolRegistry,
  ): Promise<ModelResponse<string>> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Adapt conversation history to OpenAI's format
    conversationHistory.forEach(msg => {
      const openAIMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
      if (msg.functionCall && msg.toolCallId) {
        openAIMsg.tool_calls = [{
          id: msg.toolCallId,
          type: 'function',
          function: {
            name: msg.functionCall.tool_name,
            arguments: JSON.stringify(msg.functionCall.arguments),
          },
        }];
        openAIMsg.content = msg.content || null; // Ensure content is null if tool_calls are present and no text from assistant
      } else if (msg.role === 'tool' && msg.toolCallId && msg.functionResult) {
        // This is a slight deviation as OpenAI expects 'tool' role to have 'content' (result) and 'tool_call_id'
        // The ChatMessage type stores this as functionResult, so we adapt it
        messages.push({
            role: 'tool',
            tool_call_id: msg.toolCallId,
            content: typeof msg.functionResult === 'string' ? msg.functionResult : JSON.stringify(msg.functionResult),
        });
        return; // Skip adding to messages directly as it's already added
      }
      messages.push(openAIMsg);
    });

    messages.push({ role: 'user', content: message });

    // TODO: Handle context if it includes images or other specific data relevant to OpenAI call
    // For now, assuming context.selectedText or applicationContext could be appended to the user message if needed.

    try {
      const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.config.model || "gpt-4o", // Use model from config or default
        messages: messages,
        stream: true,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1000,
      };

      if (tools && toolRegistry && tools.length > 0) {
        requestOptions.tools = toolRegistry.getToolDefinitions() as any;
      }

      const stream = await this.openai.chat.completions.create(requestOptions);

      let fullResponse = '';
      let currentToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
      let assistantMessageContent: string | null = null; // To store text content from assistant when tool calls are also present

      for await (const part of stream) {
        const delta = part.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantMessageContent = (assistantMessageContent || "") + delta.content;
          if (onChunk) {
            onChunk(delta.content, false);
          }
        }

        if (delta.tool_calls) {
          delta.tool_calls.forEach(tc => {
            if (tc.index === undefined) return;
            if (!currentToolCalls[tc.index]) {
              currentToolCalls[tc.index] = {
                id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2,10)}`,
                type: 'function',
                function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
              };
            } else {
              if (tc.id) currentToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          });
        }

        if (part.choices[0]?.finish_reason) {
          // Store assistant's message before handling tool calls or finishing
          if (assistantMessageContent !== null || currentToolCalls.length > 0) {
             messages.push({
                role: 'assistant',
                content: assistantMessageContent,
                tool_calls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
             });
          }
          fullResponse = assistantMessageContent || ""; // Set base response to assistant's text
          assistantMessageContent = null; // Reset
          break;
        }
      }

      if (currentToolCalls.length > 0 && toolRegistry) {
        if (assistantMessageContent && onChunk) { // If there was text before tool call was fully parsed
            // This should have been streamed already, but as a safeguard for any remainder
        }

        const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        for (const toolCall of currentToolCalls) {
          if (toolCall.type === 'function') {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;

            if (onChunk) {
              onChunk(`Using tool: ${toolName}...`, true, toolName);
            }

            const tool = toolRegistry.getTool(toolName);
            let resultString: string;
            if (tool) {
              try {
                const parsedArgs = JSON.parse(toolArgs);
                const result = await tool.execute(parsedArgs);
                resultString = typeof result === 'string' ? result : JSON.stringify(result);
              } catch (e: any) {
                console.error(`Error executing tool ${toolName}:`, e);
                resultString = `Error: ${e.message}`;
              }
            } else {
              console.warn(`Tool ${toolName} not found in registry.`);
              resultString = `Error: Tool ${toolName} not found.`;
            }
            toolResultMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: resultString,
            });
          }
        }

        messages.push(...toolResultMessages);

        const secondStream = await this.openai.chat.completions.create({
          model: this.config.model || "gpt-4o",
          messages: messages, // Send the augmented history
          stream: true,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 1000,
        });

        let finalResponseContent = '';
        for await (const part of secondStream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            finalResponseContent += content;
            if (onChunk) {
              onChunk(content, false);
            }
          }
        }
        fullResponse = finalResponseContent;
      } else if (assistantMessageContent !== null) {
        // If there were no tool calls but there was content (e.g. finish_reason 'stop')
        // fullResponse is already set from assistantMessageContent
      }


      // Calculate token usage (simplified)
      const promptTokens = messages.reduce((acc, msg) => {
        if (typeof msg.content === 'string') return acc + countTokens(msg.content);
        // Add more sophisticated counting for image inputs or other types if necessary
        return acc;
      }, 0);
      const completionTokens = countTokens(fullResponse);

      return {
        success: true, // Assuming ModelResponse needs a success field like others in this file
        data: fullResponse,
        usage: { // Assuming ModelResponse needs a usage field
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        // metadata might be more appropriate if ModelResponse is generic
        // metadata: {
        //   promptTokens,
        //   completionTokens,
        //   totalTokens,
        //   modelId: this.config.model || "gpt-4o",
        // },
      };
    } catch (error: any) {
      console.error('Error streaming OpenAI response:', error);
      if (onChunk) {
        onChunk(`OpenAI API error: ${error.message}`, false);
      }
      // Adapt to ModelResponse structure
      return {
        success: false,
        error: `OpenAI API error: ${error.message}`,
      }
      // throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}