import OpenAI from 'openai'
import { getApiKey } from '../models/ModelManager'
import { transcribeAudioLocally, isLocalWhisperAvailable } from './localWhisperTranscription'

export interface TranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

// Check if local dictation is enabled
function isLocalDictationEnabled(): boolean {
  const enabled = localStorage.getItem('localDictationEnabled')
  return enabled === 'true'
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  // Check if local dictation is enabled and available
  const useLocal = isLocalDictationEnabled()
  
  if (useLocal) {
    const isLocalAvailable = await isLocalWhisperAvailable()
    if (isLocalAvailable) {
      console.log('Using local Whisper for transcription')
      const localResult = await transcribeAudioLocally(audioBlob)
      
      // If local transcription succeeds, return it
      if (localResult.success) {
        return localResult
      } else {
        console.warn('Local transcription failed, falling back to cloud:', localResult.error)
        // Fall through to cloud transcription as fallback
      }
    } else {
      console.warn('Local Whisper not available, falling back to cloud transcription')
      // Fall through to cloud transcription
    }
  }

  // Use cloud transcription (existing OpenAI Whisper implementation)
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

    console.log('Transcribing audio with OpenAI Whisper...', {
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