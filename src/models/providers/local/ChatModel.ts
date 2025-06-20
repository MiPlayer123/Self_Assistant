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
        // Generate a unique message ID for this streaming session
        const messageId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Set up listener for streaming chunks before starting the request
        let streamingComplete = false;
        let fullResponse = '';
        
        const chunkListener = (data: any) => {
          if (data.messageId === messageId && onChunk && !streamingComplete) {
            onChunk(data.chunk);
            fullResponse += data.chunk;
          }
        };
        
        // Add event listener for chunks - use the generic addListener method
        const removeListener = (window as any).electronAPI.addListener('localModelChunk', chunkListener);
        
        try {
          const result = await (window as any).electronAPI.invokeLocalChatModel('sendMessage', {
            message,
            contextData,
            conversationHistory,
            modelPath: this.config.model,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            messageId: messageId // Pass the message ID to track this specific request
          });
          
          streamingComplete = true;
          
          // Remove event listener using the returned cleanup function
          if (removeListener) {
            removeListener();
          }
          
          if (result.success) {
            // If no chunks were received through streaming, fall back to the full response
            if (!fullResponse && result.data && onChunk) {
              onChunk(result.data);
            }
            
            return {
              ...result,
              data: fullResponse || result.data
            };
          } else {
            throw new Error(result.error || 'Local chat model failed');
          }
        } catch (error) {
          streamingComplete = true;
          // Clean up listener on error using the cleanup function
          if (removeListener) {
            removeListener();
          }
          throw error;
        }
      }

      // Fallback placeholder response if IPC is not available
      let response = "This is a placeholder response from the local chat model. IPC communication is not available.";
      
      // Add screenshot context to placeholder if present
      if (contextData?.screenshot) {
        response = "I can see you've included a screenshot, but I'm currently running in fallback mode without proper image analysis capabilities. " + response;
      }
      
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
    // COMMENTED OUT FOR TESTING - Always return false to disable screenshot functionality
    return false;
    
    // For local models, we'll implement a simple heuristic
    // In the future, this could use a smaller local model for classification
    // const screenshotKeywords = [
    //   'screenshot', 'image', 'picture', 'visual', 'see', 'look', 'show', 'display',
    //   'screen', 'interface', 'ui', 'button', 'click', 'element'
    // ];
    // 
    // const lowerMessage = message.toLowerCase();
    // return screenshotKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Add method to check if model is loaded
  async isModelLoaded(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.isModelLoaded) {
        const result = await (window as any).electronAPI.isModelLoaded({ modelPath: this.config.model });
        return result.success && result.data;
      }
      return false;
    } catch (error) {
      console.error('Error checking if model is loaded:', error);
      return false;
    }
  }

  // Add method to explicitly load model
  async loadModel(): Promise<{ success: boolean; error?: string }> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.loadLocalModel) {
        const result = await (window as any).electronAPI.loadLocalModel({ modelPath: this.config.model });
        return result;
      }
      return { success: false, error: 'IPC not available' };
    } catch (error: any) {
      console.error('Error loading model:', error);
      return { success: false, error: error.message || 'Failed to load model' };
    }
  }
} 