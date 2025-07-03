import { IChatModel, ChatMessage, ContextData, ChatModelConfig } from '../../../types/chat';
import { GoogleGenAI } from '@google/genai';
import { shouldPerformSearch, performWebSearch } from '../../../utils/searchUtils';

export class GeminiChatModel implements IChatModel {
  public supportsScreenshot = true;
  private client: GoogleGenAI;
  private config: ChatModelConfig;

  constructor(config: ChatModelConfig) {
    this.config = config;
    console.log('GeminiChatModel: Initializing with config:', {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKeyLength: this.config.apiKey ? this.config.apiKey.length : 0,
      apiKeyPrefix: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'missing'
    });
    
    if (!this.config.apiKey) {
      throw new Error('Google API key is required');
    }

    // Use native Google GenAI client
    this.client = new GoogleGenAI({ 
      apiKey: config.apiKey 
    });
    console.log('GeminiChatModel: Native Google GenAI client initialized successfully');
  }

  async sendMessageStream(
    userMessage: string,
    contextData: ContextData | undefined,
    chatHistory: ChatMessage[],
    onChunk: (chunk: string) => void,
    onSearchStatusChange?: (isSearching: boolean) => void
  ): Promise<{ success: boolean; error?: string; data?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; }; }> {
    try {
      console.log('GeminiChatModel: Starting message stream with model:', this.config.model);
      
      // Check if search is needed and perform it
      if (await shouldPerformSearch(userMessage, chatHistory)) {
        const searchResults = await performWebSearch(userMessage, 3, onSearchStatusChange);
        if (searchResults) {
          contextData = { 
            ...contextData, 
            searchResults 
          };
        }
      }

      // Build conversation history for context
      let conversationContext = '';
      if (chatHistory && chatHistory.length > 0) {
        // Take last 20 messages to avoid token limits
        const recentHistory = chatHistory.slice(-20);
        for (const msg of recentHistory) {
          if (msg.role !== 'system') {
            conversationContext += `${msg.role}: ${msg.content}\n`;
          }
        }
      }

      // Build the prompt text
      let promptText = `You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You may be provided with an image analysis summary to help provide context for your response.

You can:
- Answer questions about anything
- Use image analysis summaries to understand what the user is seeing
- Use real-time web search results when provided to give current information
- Help with coding, writing, problem-solving
- Provide explanations and guidance

Be helpful, concise, and friendly. 
Provide a response that answers the question using any provided image analysis or search results as context.
When using search results, cite the sources with their URLs when relevant.

`;

      // Add search results context if available
      if (contextData?.searchResults && contextData.searchResults.length > 0) {
        const searchContext = contextData.searchResults
          .map(result => `Title: ${result.title}\nContent: ${result.content}\nURL: ${result.url}`)
          .join('\n\n');
        
        promptText += `Recent web search results for the user's query:\n\n${searchContext}\n\nUse this information to provide accurate, up-to-date responses. Cite sources when relevant.\n\n`;
      }

      // Add conversation context if available
      if (conversationContext) {
        promptText += `Previous conversation context:\n${conversationContext}\n\nCurrent request: `;
      }

      // Handle image if present
      if (contextData?.screenshot) {
        console.log('GeminiChatModel: Attaching image for analysis...');
        
        // Create an intelligent prompt based on whether the user provided a query or not
        let imagePrompt: string;
        
        if (userMessage.trim()) {
          // User provided a specific query - analyze in context of that query
          imagePrompt = promptText + `Analyze the attached screenshot in the context of my query: "${userMessage}". Please provide a direct and relevant response.`;
        } else {
          // No user query - provide intelligent assistance based on what's visible on screen
          imagePrompt = promptText + `I've taken a screenshot but didn't provide a specific question. Please analyze what's on my screen and provide helpful assistance. Look for:

- Questions, problems, or errors that need solving
- Forms, interfaces, or tasks that might need completion
- Content that could benefit from explanation or guidance
- Any issues, prompts, or decisions that require attention
- Learning opportunities or educational content visible

Provide practical, actionable help based on what you see. If there's a clear question or problem visible, solve it. If there's content that could be explained or improved, do so. Be proactive and helpful while being concise and relevant.`;
        }
        
        // For image handling, we need to use a different approach
        const contentParts = [
          { text: imagePrompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: contextData.screenshot.base64
            }
          }
        ];
        
        const response = await this.client.models.generateContentStream({
          model: this.config.model,
          contents: contentParts,
          config: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          }
        });

        let fullContent = '';
        for await (const chunk of response) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullContent += chunkText;
            onChunk(chunkText);
          }
        }

        return {
          success: true,
          data: fullContent,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          }
        };
      } else {
        promptText += userMessage;

        const response = await this.client.models.generateContentStream({
          model: this.config.model,
          contents: promptText,
          config: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          }
        });

        let fullContent = '';
        for await (const chunk of response) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullContent += chunkText;
            onChunk(chunkText);
          }
        }

        console.log('GeminiChatModel: Stream completed successfully');

        return {
          success: true,
          data: fullContent,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          }
        };
      }
    } catch (error: any) {
      console.error('GeminiChatModel streaming error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data
      });
      
      // Provide more specific error messages for common issues
      let errorMessage = error.message || 'Failed to send streaming message to Gemini';
      
      if (error.status === 401 || error.message?.includes('401') || error.message?.includes('API key')) {
        errorMessage = 'Gemini API authentication failed. Please check your VITE_GOOGLE_API_KEY environment variable.';
      } else if (error.status === 403 || error.message?.includes('403')) {
        errorMessage = 'Gemini API access forbidden. Please verify your API key has the necessary permissions.';
      } else if (error.status === 429 || error.message?.includes('429')) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
      } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('network')) {
        errorMessage = 'Network error connecting to Gemini API. Please check your internet connection.';
      } else if (error.message?.includes('model')) {
        errorMessage = `Model "${this.config.model}" not found or not accessible. Please check if the model name is correct.`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async isScreenshotRequired(message: string, base64ImageData: string): Promise<boolean> {
    try {
      console.log('GeminiChatModel: Checking if screenshot is required...');
      
      // If there's no message text, always use the screenshot for intelligent analysis
      if (!message.trim()) {
        console.log('GeminiChatModel: Empty message, screenshot will be analyzed');
        return true;
      }
      
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: [
          {
            text: `Does the following query require the attached screenshot to be answered effectively? Respond with only "true" or "false".\n\nQuery: "${message}"`
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64ImageData
            }
          }
        ],
        config: {
          maxOutputTokens: 10
        }
      });

      const result = response.text?.trim().toLowerCase();
      const isRequired = result === "true";
      
      console.log('GeminiChatModel: Screenshot required:', isRequired);
      return isRequired;
    } catch (error: any) {
      console.error('GeminiChatModel screenshot check error:', error);
      // In case of error, assume screenshot is not required to avoid unnecessary processing
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Return the models that are available via the Google GenAI API
    return [
      'gemini-2.0-flash',
      'gemini-1.5-flash', 
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-pro-vision'
    ];
  }


} 