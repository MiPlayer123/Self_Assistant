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
      - Use real-time web search results when provided to give current information
      - Help with coding, writing, problem-solving
      - Provide explanations and guidance

      Be helpful, concise, and friendly. 
      Provide a response that answers the question using any provided image analysis or search results as context.
      When using search results, cite the sources with their URLs when relevant.
      `
    }
  ];

  // Add search results context if available
  if (contextData?.searchResults && contextData.searchResults.length > 0) {
    const searchContext = contextData.searchResults
      .map(result => `Title: ${result.title}\nContent: ${result.content}\nURL: ${result.url}`)
      .join('\n\n');
    
    messages.push({
      role: "system", 
      content: `Recent web search results for the user's query:\n\n${searchContext}\n\nUse this information to provide accurate, up-to-date responses. Cite sources when relevant.`
    });
  }

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
    
    // Create an intelligent prompt based on whether the user provided a query or not
    let imagePrompt: string;
    
    if (userMessage.trim()) {
      // User provided a specific query - analyze in context of that query
      imagePrompt = `Analyze the attached screenshot in the context of my query: "${userMessage}". Please provide a direct and relevant response.`;
    } else {
      // No user query - provide intelligent assistance based on what's visible on screen
      imagePrompt = `I've taken a screenshot but didn't provide a specific question. Please analyze what's on my screen and provide helpful assistance. Look for:

- Questions, problems, or errors that need solving
- Forms, interfaces, or tasks that might need completion
- Content that could benefit from explanation or guidance
- Any issues, prompts, or decisions that require attention
- Learning opportunities or educational content visible

Provide practical, actionable help based on what you see. If there's a clear question or problem visible, solve it. If there's content that could be explained or improved, do so. Be proactive and helpful while being concise and relevant.`;
    }
    
    userMessageContent = [
      {
        type: "text",
        text: imagePrompt
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