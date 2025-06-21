import { useState, useRef, useCallback } from 'react'

export type RecordingState = 'idle' | 'recording' | 'processing'

export interface UseAudioRecordingReturn {
  recordingState: RecordingState
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  error: string | null
  clearError: () => void
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      })
      
      streamRef.current = stream
      audioChunksRef.current = []

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Start recording
      mediaRecorder.start()
      setRecordingState('recording')
      
    } catch (err: any) {
      console.error('Error starting recording:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your audio devices.')
      } else {
        setError('Failed to start recording. Please try again.')
      }
      setRecordingState('idle')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null)
        return
      }

      setRecordingState('processing')

      mediaRecorder.onstop = () => {
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType
        })
        
        setRecordingState('idle')
        resolve(audioBlob)
      }

      mediaRecorder.stop()
    })
  }, [])

  return {
    recordingState,
    startRecording,
    stopRecording,
    error,
    clearError
  }
} 