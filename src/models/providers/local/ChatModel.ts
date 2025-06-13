import { ChatMessage, ContextData, IChatModel, ChatModelConfig } from '../../../types/chat';

export class LocalChatModel implements IChatModel {
  private config: ChatModelConfig;

  constructor(config: ChatModelConfig) {
    this.config = config;
  }

  async sendMessageStream(
    message: string,
    contextData?: ContextData,
    conversationHistory?: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<{ success: boolean; error?: string; data?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    try {
      // Use IPC to communicate with the main process for local model inference
      if (typeof window !== 'undefined' && (window as any).electronAPI?.invokeLocalChatModel) {
        const result = await (window as any).electronAPI.invokeLocalChatModel('sendMessage', {
          message,
          contextData,
          conversationHistory,
          modelPath: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        });
        
        if (result.success && result.data) {
          // Simulate streaming by calling onChunk with the full response
          if (onChunk) {
            onChunk(result.data);
          }
          return result;
        } else {
          throw new Error(result.error || 'Local chat model failed');
        }
      }

      // Fallback placeholder response if IPC is not available
      const response = "This is a placeholder response from the local chat model. IPC communication is not available.";
      
      if (onChunk) {
        onChunk(response);
      }

      return {
        success: true,
        data: response,
        usage: {
          promptTokens: 50,
          completionTokens: 20,
          totalTokens: 70
        }
      };
    } catch (error: any) {
      console.error('Local chat model error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message to local model'
      };
    }
  }

  async isScreenshotRequired(message: string, screenshot: string): Promise<boolean> {
    // For local models, we'll implement a simple heuristic
    // In the future, this could use a smaller local model for classification
    const screenshotKeywords = [
      'screenshot', 'image', 'picture', 'visual', 'see', 'look', 'show', 'display',
      'screen', 'interface', 'ui', 'button', 'click', 'element'
    ];
    
    const lowerMessage = message.toLowerCase();
    return screenshotKeywords.some(keyword => lowerMessage.includes(keyword));
  }
} 