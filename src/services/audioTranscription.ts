import OpenAI from 'openai'
import { getApiKey } from '../models/ModelManager'

export interface TranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    // Get OpenAI API key using existing infrastructure
    const apiKey = await getApiKey('openai')
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    })

    // Convert blob to File object for OpenAI API
    const audioFile = new File([audioBlob], 'audio.webm', {
      type: audioBlob.type
    })

    console.log('Transcribing audio...', {
      size: audioBlob.size,
      type: audioBlob.type
    })

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can be made configurable later
      response_format: 'text'
    })

    console.log('Transcription successful:', transcription)

    return {
      success: true,
      text: transcription.trim()
    }

  } catch (error: any) {
    console.error('Transcription error:', error)
    
    let errorMessage = 'Failed to transcribe audio'
    
    if (error.status === 401) {
      errorMessage = 'OpenAI API authentication failed. Please check your API key.'
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
    } else if (error.status === 413) {
      errorMessage = 'Audio file too large. Please record shorter audio.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.'
    }

    return {
      success: false,
      error: errorMessage
    }
  }
} 