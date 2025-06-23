import { ChatMessage } from '../types/chat';

/**
 * Determines whether a web search should be performed based on the user's message.
 * Uses pattern matching to detect requests that likely need current/real-time information.
 * 
 * @param message - The user's message/query
 * @param chatHistory - Optional chat history for context (currently not used but available for future enhancements)
 * @returns Promise<boolean> - Whether search should be performed
 */
export async function shouldPerformSearch(message: string, chatHistory?: ChatMessage[]): Promise<boolean> {
  // Keywords that suggest current/recent information is needed
  const searchTriggers = /\b(latest|current|recent|news|whats happening|today|now|2024|2025|this year|this month|what happened|today|yesterday)\b/i;
  
  // Question patterns that often need real-time data
  const factualQuestions = /\b(what is|who is|when did|when was|tell me about|what are|how much|the price)\b/i;
  
  // Technology/product updates
  const techUpdates = /\b(features|update|version|release|announcement|launched)\b/i;
  
  // Market/financial queries
  const marketQueries = /\b(stock|price|market|trading|earnings|value)\b/i;
  
  // News and events
  const newsEvents = /\b(news|event|happening|announced|reported)\b/i;
  
  return searchTriggers.test(message) || 
         (factualQuestions.test(message) && (techUpdates.test(message) || marketQueries.test(message) || newsEvents.test(message)));
}

/**
 * Performs a web search with consistent error handling and logging.
 * This could be extended in the future to handle different search providers,
 * caching, rate limiting, etc.
 * 
 * @param message - The search query
 * @param maxResults - Maximum number of results to return
 * @param onStatusChange - Optional callback for status updates
 * @returns Promise with search results or null if failed
 */
export async function performWebSearch(
  message: string, 
  maxResults: number = 3,
  onStatusChange?: (isSearching: boolean) => void
): Promise<any[] | null> {
  try {
    onStatusChange?.(true);
    
    // Dynamic import to avoid circular dependencies
    const { searchWithTavily } = await import('../services/tavilySearch');
    
    console.log(`Performing web search for: "${message}"`);
    const searchResult = await searchWithTavily(message, maxResults);
    
    if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
      console.log(`Search successful, found ${searchResult.results.length} results:`, 
                  searchResult.results.map(r => r.title));
      return searchResult.results;
    } else {
      console.warn('Search returned no results');
      return null;
    }
  } catch (error: any) {
    console.warn('Web search failed, continuing without search:', error.message || error);
    return null;
  } finally {
    onStatusChange?.(false);
  }
} 