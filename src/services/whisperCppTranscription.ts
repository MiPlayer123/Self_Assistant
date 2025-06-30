/**
 * Local Whisper Transcription Service
 * 
 * Provides interface for local whisper transcription via Electron backend.
 * Currently disabled but ready for future implementation.
 */

export interface WhisperCppTranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

/**
 * Check if local whisper backend is available
 */
async function checkWhisperBackend(): Promise<boolean> {
  try {
    if (!window.electronAPI?.isLocalWhisperLoaded) {
      return false
    }
    
    const result = await window.electronAPI.isLocalWhisperLoaded()
    return result?.success && result.data === true
  } catch (error) {
    console.error('Failed to check whisper backend:', error)
    return false
  }
}

/**
 * Check if whisper.cpp is available and ready
 */
export async function isWhisperCppAvailable(): Promise<boolean> {
  try {
    // Check if local dictation is enabled
    const isEnabled = localStorage.getItem('localDictationEnabled') === 'true'
    if (!isEnabled) {
      return false
    }
    
    // In an Electron environment, we can always try to initialize
    if (!window.electronAPI) {
      return false
    }
    
    // Check if the backend is available
    const backendAvailable = await checkWhisperBackend()
    return backendAvailable
  } catch (error) {
    console.error('Error checking whisper.cpp availability:', error)
    return false
  }
}

/**
 * Transcribe audio using local whisper (via Electron backend)
 */
export async function transcribeAudioWithWhisperCpp(audioBlob: Blob): Promise<WhisperCppTranscriptionResult> {
  try {
    if (!window.electronAPI?.invokeLocalWhisper) {
      throw new Error('Electron API not available')
    }
    
    // Convert blob to array buffer for Electron
    const audioBuffer = await audioBlob.arrayBuffer()
    
    // Use Electron's whisper implementation
    const result = await window.electronAPI.invokeLocalWhisper('transcribe', {
      audioBuffer: Array.from(new Uint8Array(audioBuffer)),
      audioType: audioBlob.type
    })
    
    if (!result?.success) {
      throw new Error(result?.error || 'Transcription failed')
    }
    
    const transcribedText = result.text?.trim()
    if (!transcribedText) {
      throw new Error('Transcription returned empty result')
    }
    
    return {
      success: true,
      text: transcribedText
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown transcription error'
    }
  }
}

/**
 * Get basic info about local whisper models (for UI display)
 */
export function getWhisperModelInfo() {
  return {
    currentModel: 'Local transcription currently disabled',
    description: 'Local transcription will be available when a whisper backend is configured',
    info: 'Currently using cloud transcription via OpenAI API'
  }
} 