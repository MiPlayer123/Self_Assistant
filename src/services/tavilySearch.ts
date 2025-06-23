import { getApiKey } from '../models/ModelManager'
import { SearchResultData } from '../types/chat'

export interface TavilySearchResult {
  success: boolean
  results?: SearchResultData[]
  error?: string
}

export async function searchWithTavily(query: string, maxResults: number = 5): Promise<TavilySearchResult> {
  try {
    // Get Tavily API key using existing infrastructure
    const apiKey = await getApiKey('tavily')
    
    console.log('Searching with Tavily...', {
      query,
      maxResults
    })

    // Call Tavily API
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
        include_domains: [],
        exclude_domains: []
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Tavily search successful:', data)

    const results: SearchResultData[] = data.results?.map((result: any) => ({
      title: result.title || '',
      content: result.content || '',
      url: result.url || '',
      score: result.score || 0
    })) || []

    return {
      success: true,
      results
    }

  } catch (error: any) {
    console.error('Tavily search error:', error)
    
    let errorMessage = 'Failed to perform web search'
    
    if (error.status === 401) {
      errorMessage = 'Tavily API authentication failed. Please check your API key.'
    } else if (error.status === 429) {
      errorMessage = 'Tavily API rate limit exceeded. Please try again later.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.'
    }

    return {
      success: false,
      error: errorMessage
    }
  }
} 