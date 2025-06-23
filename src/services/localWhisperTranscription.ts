export interface LocalTranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

export async function transcribeAudioLocally(audioBlob: Blob): Promise<LocalTranscriptionResult> {
  try {
    // Convert blob to File object for IPC communication
    const audioFile = new File([audioBlob], 'audio.webm', {
      type: audioBlob.type
    })

    console.log('Local Whisper: Transcribing audio...', {
      size: audioBlob.size,
      type: audioBlob.type
    })

    // Convert audio file to buffer for IPC
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    // Call local Whisper via IPC
    const result = await (window as any).electronAPI?.invokeLocalWhisper?.('transcribe', {
      audioBuffer: audioBuffer,
      audioType: audioBlob.type
    })

    if (result?.success) {
      console.log('Local Whisper: Transcription successful:', result.text)
      return {
        success: true,
        text: result.text?.trim() || ''
      }
    } else {
      throw new Error(result?.error || 'Local transcription failed')
    }

  } catch (error: any) {
    console.error('Local Whisper transcription error:', error)
    
    let errorMessage = 'Failed to transcribe audio locally'
    
    if (error.message?.includes('model not loaded')) {
      errorMessage = 'Local Whisper model not loaded. Please download the model first.'
    } else if (error.message?.includes('audio format')) {
      errorMessage = 'Unsupported audio format for local transcription.'
    } else if (error.message?.includes('IPC')) {
      errorMessage = 'Local transcription service unavailable.'
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

// Check if local Whisper is available and loaded
export async function isLocalWhisperAvailable(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.isLocalWhisperLoaded) {
      const result = await (window as any).electronAPI.isLocalWhisperLoaded()
      return result.success && result.data
    }
    return false
  } catch (error) {
    console.error('Error checking local Whisper availability:', error)
    return false
  }
} 