import { IChatModel, ChatMessage, ContextData } from '../../../types/chat';

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

  constructor(config: ClaudeChatModelConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
  }

  async sendMessageStream(
    userMessage: string,
    contextData: ContextData | undefined,
    chatHistory: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<{ success: boolean; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    // TODO: Implement Claude API call logic here
    console.log('ClaudeChatModel: sendMessageStream called');
    console.log('User Message:', userMessage);
    console.log('Context Data:', contextData);
    console.log('Chat History:', chatHistory);
    
    // Simulate streaming for now
    onChunk("This is a placeholder response from Claude (not yet implemented).");
    
    return { success: true };
  }

  async isScreenshotRequired(message: string, base64ImageData: string): Promise<boolean> {
    // TODO: Implement logic to check if screenshot is required for Claude
    console.log('ClaudeChatModel: isScreenshotRequired called');
    return false; // For now, assume screenshot is not required
  }
} 