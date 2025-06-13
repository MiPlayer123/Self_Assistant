import { ChatMessage, ContextData } from '../types/chat';
import OpenAI from 'openai';

export function buildOpenAIMessages(userMessage: string, chatHistory: ChatMessage[], contextData?: ContextData): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are Wagoo, a helpful AI assistant that can help with any task and respond to any queries. You may be provided with an image analysis summary to help provide context for your response.

      You can:
      - Answer questions about anything
      - Use image analysis summaries to understand what the user is seeing
      - Help with coding, writing, problem-solving
      - Provide explanations and guidance

      Be helpful, concise, and friendly. 
      Provide a response that answers the question using any provided image analysis as context.
      `
    }
  ];

  // Add conversation history
  if (chatHistory && chatHistory.length > 0) {
    // Take last 25 messages to avoid token limits
    const recentHistory = chatHistory.slice(-25);
    for (const msg of recentHistory) {
      if (msg.role !== 'system') {
        // For conversation history, just include text content without re-analyzing images
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }
  }

  // Handle current message with potential image analysis
  let userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: userMessage }];

  if (contextData?.screenshot) {
    console.log('Attaching image for targeted analysis...');
    
    userMessageContent = [
      {
        type: "text",
        text: `Analyze the attached screenshot in the context of my query: "${userMessage}". Please provide a direct and relevant response.`
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${contextData.screenshot.base64}`,
          detail: "high"
        }
      }
    ];
    
    console.log('Image attached, proceeding with streaming response...');
  }

  messages.push({
    role: "user",
    content: userMessageContent
  });

  return messages;
} 