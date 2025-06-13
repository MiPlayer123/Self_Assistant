import { IChatModel, ChatMessage, ContextData } from '../../../types/chat';
import Anthropic from '@anthropic-ai/sdk';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface ClaudeChatModelConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export class ClaudeChatModel implements IChatModel {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private client: Anthropic;

  constructor(config: ClaudeChatModelConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async sendMessageStream(
    userMessage: string,
    contextData: ContextData | undefined,
    chatHistory: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<{ success: boolean; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    try {
      const messages: Anthropic.Messages.MessageParam[] = [];

      // Add system prompt (optional, but good practice for Claude)
      messages.push({
        role: "user",
        content: "You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You may be provided with an image analysis summary to help provide context for your response."
      });

      // Add conversation history
      if (chatHistory && chatHistory.length > 0) {
        // Take last 25 messages to avoid token limits, similar to OpenAI
        const recentHistory = chatHistory.slice(-25);
        for (const msg of recentHistory) {
          if (msg.role !== 'system') {
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content
            });
          }
        }
      }

      // Handle current message with potential image analysis
      let userMessageContent: Anthropic.Messages.MessageParam['content'] = [{ type: 'text', text: userMessage }];

      if (contextData?.screenshot) {
        console.log('Claude: Attaching image for targeted analysis...');
        userMessageContent = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png", // Assuming PNG. Adjust if different.
              data: contextData.screenshot.base64,
            },
          },
          {
            type: "text",
            text: `Analyze the attached screenshot in the context of my query: "${userMessage}". Please provide a direct and relevant response.`
          },
        ];
        console.log('Claude: Image attached.');
      }

      messages.push({
        role: "user",
        content: userMessageContent
      });

      // Remove the last system message that was acting as a hack, as Claude supports system prompts directly now
      const lastUserMessage = messages.pop();
      const systemMessage = messages.shift(); // Remove the hacky system message

      if (systemMessage && systemMessage.content) {
        // Use the actual system parameter if the first message was a system one
        const systemPrompt = Array.isArray(systemMessage.content) ?
          systemMessage.content.map(block => block.type === 'text' ? block.text : '').join('\n') :
          systemMessage.content;

        const stream = await this.client.messages.stream({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: messages as Anthropic.Messages.MessageParam[],
          system: systemPrompt,
        });

        let promptTokens = 0;
        let completionTokens = 0;

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            onChunk(chunk.delta.text);
          } else if (chunk.type === 'message_start') {
            promptTokens = chunk.message.usage.input_tokens;
          } else if (chunk.type === 'message_delta' && chunk.usage) {
            completionTokens = chunk.usage.output_tokens;
          }
        }

        return {
          success: true,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        };

      } else if (lastUserMessage) {
        // If there was no system message hack, just push back the user message
        messages.push(lastUserMessage);
      }

      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: messages as Anthropic.Messages.MessageParam[],
      });

      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          onChunk(chunk.delta.text);
        } else if (chunk.type === 'message_start') {
          promptTokens = chunk.message.usage.input_tokens;
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          completionTokens = chunk.usage.output_tokens;
        }
      }

      return {
        success: true,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };


    } catch (error: any) {
      console.error("Error during Claude sendMessageStream:", error);
      return { success: false, error: error.message };
    }
  }

  async isScreenshotRequired(message: string, base64ImageData: string): Promise<boolean> {
    // For Claude, if an image is provided, it can always be used.
    // We can potentially make a call to Claude here to ask if it thinks the screenshot is relevant,
    // but for simplicity, we'll assume it's always relevant if present.
    console.log('ClaudeChatModel: isScreenshotRequired called, assuming true if image data is present.');
    return !!base64ImageData;
  }
} 