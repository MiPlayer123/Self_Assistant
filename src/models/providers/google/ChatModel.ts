import { IChatModel, ChatMessage, ContextData } from '../../../types/chat';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Content, Part } from '@google/genai';

interface GeminiChatModelConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export class GeminiChatModel implements IChatModel {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private client: GoogleGenAI;

  constructor(config: GeminiChatModelConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async sendMessageStream(
    userMessage: string,
    contextData: ContextData | undefined,
    chatHistory: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<{ success: boolean; error?: string; data?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    // TODO: Implement Gemini API call logic here
    console.log('GeminiChatModel: sendMessageStream received', { userMessage, contextData, chatHistory });

    try {
      const chat = this.client.chats.create({
        model: this.model,
        history: chatHistory.map(message => ({
          role: message.role === 'user' ? 'user' : 'model',
          parts: [{ text: message.content }],
        })),
        config: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        },
      });

      let userMessageParts: Part[] = [];
      if (contextData?.screenshot) {
        userMessageParts = [
          { inlineData: { mimeType: 'image/png', data: contextData.screenshot.base64 } },
          { text: userMessage }
        ];
      } else {
        userMessageParts = [{ text: userMessage }];
      }

      const result = await chat.sendMessageStream({ message: userMessageParts });
      let text = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of result) {
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        text += chunkText;
        onChunk(chunkText);

        // TODO: Figure out how to get token usage from Gemini streaming
        // The Gemini API doesn't seem to provide token usage in real-time during streaming.
        // We might need to make a separate call or estimate after the stream ends.
      }

      // For now, we'll return placeholder usage. This needs to be properly implemented
      // once a method to get token usage from streaming responses is identified.
      return {
        success: true,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        data: text,
      };
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async isScreenshotRequired(message: string, base64ImageData: string): Promise<boolean> {
    return Promise.resolve(true);
  }
} 