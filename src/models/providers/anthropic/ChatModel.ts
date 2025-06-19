import { IChatModel, ChatMessage, ContextData } from '../../../types/chat';
import Anthropic from '@anthropic-ai/sdk';

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
    console.log('Claude: Initializing client with config:', {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'missing'
    });
    this.client = new Anthropic({ 
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true // Enable browser/Electron usage like OpenAI
    });
    console.log('Claude: Client initialized successfully');
  }

  async sendMessageStream(
    userMessage: string,
    contextData: ContextData | undefined,
    chatHistory: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<{ success: boolean; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    try {
      console.log('Claude: Starting message stream with model:', this.model);
      
      const messages: Anthropic.Messages.MessageParam[] = [];

      // Add conversation history
      if (chatHistory && chatHistory.length > 0) {
        // Take last 20 messages to avoid token limits
        const recentHistory = chatHistory.slice(-20);
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
      let userMessageContent: Anthropic.Messages.MessageParam['content'];

      if (contextData?.screenshot) {
        console.log('Claude: Attaching image for analysis...');
        userMessageContent = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: contextData.screenshot.base64,
            },
          },
          {
            type: "text",
            text: `Analyze the attached screenshot in the context of my query: "${userMessage}". Please provide a direct and relevant response.`
          },
        ];
      } else {
        userMessageContent = userMessage;
      }

      messages.push({
        role: "user",
        content: userMessageContent
      });

      console.log('Claude: Sending request to API...');

      const systemPrompt = "You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You may be provided with an image analysis summary to help provide context for your response.";

      console.log('Claude: About to make API call with:', {
        model: this.model,
        messagesCount: messages.length,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        systemPrompt: systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'none'
      });

      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages: messages,
      });

      console.log('Claude: API call successful, stream created');
      let fullContent = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      console.log('Claude: Processing stream...');

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          onChunk(chunk.delta.text);
        } else if (chunk.type === 'message_start') {
          totalInputTokens = chunk.message.usage.input_tokens;
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          totalOutputTokens = chunk.usage.output_tokens;
        }
      }

      console.log('Claude: Stream completed successfully');

      return {
        success: true,
        usage: {
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
      };

    } catch (error: any) {
      console.error("Error during Claude sendMessageStream:", error);
      // Log all available error details
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
        console.error("Error response headers:", error.response.headers);
      }
      if (error.request) {
        console.error("Error request:", error.request);
      }
      // Check if it's an Anthropic API error and log specific properties
      if (error instanceof Anthropic.APIError) {
        // Anthropic APIError object exposes status and message directly
        console.error("Anthropic API Error - Name:", error.name);
        console.error("Anthropic API Error - Status:", error.status);
        console.error("Anthropic API Error - Message:", error.message); // The top-level error message
        console.error("Anthropic API Error - Headers:", (error as any).headers); // Access headers, often useful
        console.error("Anthropic API Error - Request ID:", (error as any)._request_id); // Access internal request ID if available
      }
      console.error("Full error message:", error.message);
      console.error("Error stack:", error.stack);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  async isScreenshotRequired(message: string, screenshot: string): Promise<boolean> {
    try {
      console.log('Claude: Checking if screenshot is required for message:', message.substring(0, 100) + '...');
      
      // Use the existing client but with Haiku model for screenshot detection (faster and cheaper)
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022', // Use Haiku for screenshot detection
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Does the following query require the attached screenshot or content on the screen to be answered effectively? Assume the query is the only context provided. Respond with only "true" or "false".\n\nQuery: "${message}"`
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: screenshot
                }
              }
            ]
          }
        ]
      });

      const result = response.content[0]?.type === 'text' ? response.content[0].text.trim().toLowerCase() : '';
      console.log('Claude: Screenshot detection result:', result);
      return result === "true";
    } catch (error: any) {
      console.error('Claude screenshot check error:', error);
      console.error('Screenshot check error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // In case of error, assume screenshot is not required to avoid unnecessary processing
      return false;
    }
  }
} 