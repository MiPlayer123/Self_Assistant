import OpenAI from 'openai'
import { getApiKey } from '../models/ModelManager'
import { transcribeAudioWithWhisperCpp, isWhisperCppAvailable } from './whisperCppTranscription'

export interface TranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

// Check if local dictation is enabled
function isLocalDictationEnabled(): boolean {
  // Allow override via environment variable for production use
  if (import.meta.env.PROD && !import.meta.env.VITE_ENABLE_LOCAL_WHISPER) {
    console.log('Local transcription disabled in production build (set VITE_ENABLE_LOCAL_WHISPER=true to enable)')
    return false
  }
  
  const enabled = localStorage.getItem('localDictationEnabled')
  return enabled === 'true'
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  // Check if local dictation is enabled and available
  const useLocal = isLocalDictationEnabled()
  
  if (useLocal) {
    console.log('Local transcription enabled, checking availability...')
    const isLocalAvailable = await isWhisperCppAvailable()
    if (isLocalAvailable) {
      console.log('✅ Using local whisper.cpp for transcription')
      const localResult = await transcribeAudioWithWhisperCpp(audioBlob)
      
      // If local transcription succeeds, return it
      if (localResult.success) {
        console.log('🎯 Local transcription successful')
        return localResult
      } else {
        console.warn('❌ Local transcription failed, falling back to cloud:', localResult.error)
        // Fall through to cloud transcription as fallback
      }
    } else {
      console.warn('⚠️ Local transcription not available, using cloud transcription')
      // Fall through to cloud transcription
    }
  } else {
    console.log('📡 Local transcription disabled, using cloud transcription')
  }

  // Use cloud transcription (OpenAI Whisper API)
  try {
    console.log('☁️ Starting cloud transcription with OpenAI Whisper...')
    
    // Get OpenAI API key using existing infrastructure
    const apiKey = await getApiKey('openai')
    if (!apiKey) {
      throw new Error('OpenAI API key not available')
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    })

    // Validate audio blob first
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid audio data: empty or corrupted audio file')
    }

    if (audioBlob.size < 100) {
      throw new Error('Audio file too small. Please record for at least 1 second.')
    }

    // Convert blob to File object for OpenAI API with proper extension
    let fileName = 'audio.webm'
    if (audioBlob.type.includes('mp4')) {
      fileName = 'audio.mp4'
    } else if (audioBlob.type.includes('wav')) {
      fileName = 'audio.wav'
    } else if (audioBlob.type.includes('ogg')) {
      fileName = 'audio.ogg'
    }

    const audioFile = new File([audioBlob], fileName, {
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

    // Validate transcription result
    if (!transcription || typeof transcription !== 'string') {
      throw new Error('Invalid transcription response from OpenAI')
    }

    const transcribedText = transcription.trim()
    
    if (!transcribedText) {
      throw new Error('Transcription returned empty result. The audio may be unclear or contain no speech.')
    }

    console.log('✅ Cloud transcription successful:', transcribedText.length, 'characters')

    return {
      success: true,
      text: transcribedText
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