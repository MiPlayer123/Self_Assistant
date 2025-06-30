/**
 * Local Whisper Transcription Service (stub)
 *
 * This is a placeholder for future local whisper integration.
 * Currently always returns not available.
 */

export interface LocalTranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

/**
 * Check if local whisper backend is available (stub)
 */
export async function isLocalWhisperAvailable(): Promise<boolean> {
  return false
}

/**
 * Transcribe audio using local whisper (stub)
 */
export async function transcribeAudioLocally(audioBlob: Blob): Promise<LocalTranscriptionResult> {
  return {
    success: false,
    error: 'Local whisper transcription is currently disabled.'
  }
} 