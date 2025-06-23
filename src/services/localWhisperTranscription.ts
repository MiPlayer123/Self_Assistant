export interface LocalTranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

// Global whisper pipeline instance
let whisperPipeline: any = null
let isInitializing = false

async function initializeWhisperPipeline() {
  if (whisperPipeline || isInitializing) {
    return whisperPipeline
  }

  isInitializing = true
  try {
    console.log('🔧 Initializing local Whisper pipeline...')
    
    // Dynamic import of @xenova/transformers
    const { pipeline, env } = await import('@xenova/transformers')
    
    // Configure transformers environment
    env.allowLocalModels = false
    env.allowRemoteModels = true
    env.useBrowserCache = true
    
    // Clear cache if we had previous failures
    const lastFailure = localStorage.getItem('whisperInitFailure')
    if (lastFailure) {
      console.log('🧹 Clearing transformer cache due to previous failure...')
      try {
        // Clear the cache
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames
              .filter(name => name.includes('transformers') || name.includes('huggingface'))
              .map(name => caches.delete(name))
          )
        }
        localStorage.removeItem('whisperInitFailure')
      } catch (cacheError) {
        console.warn('Failed to clear cache:', cacheError)
      }
    }
    
    // Try different models in order of preference
    console.log('📥 Loading Whisper model...')
    
    const modelsToTry = [
      'Xenova/whisper-tiny.en',
      'Xenova/whisper-tiny',
      'microsoft/speecht5_asr'  // Fallback ASR model
    ]
    
    let lastError: any = null
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔄 Trying model: ${modelName}`)
        whisperPipeline = await pipeline('automatic-speech-recognition', modelName, {
          quantized: true
        })
        console.log(`✅ Successfully loaded model: ${modelName}`)
        break
      } catch (err: any) {
        console.warn(`⚠️ Failed to load ${modelName}:`, err.message)
        lastError = err
        continue
      }
    }
    
    if (!whisperPipeline) {
      throw new Error(`Failed to load any speech recognition model. Last error: ${lastError?.message}`)
    }
    
    console.log('✅ Local Whisper pipeline initialized successfully')
    return whisperPipeline
  } catch (error) {
    console.error('❌ Failed to initialize Whisper pipeline:', error)
    // Mark failure for cache clearing next time
    localStorage.setItem('whisperInitFailure', Date.now().toString())
    throw error
  } finally {
    isInitializing = false
  }
}

export async function transcribeAudioLocally(audioBlob: Blob): Promise<LocalTranscriptionResult> {
  try {
    console.log('🎵 Local Whisper: Starting transcription...', {
      size: audioBlob.size,
      type: audioBlob.type
    })

    // Check if local dictation is enabled
    const isEnabled = localStorage.getItem('localDictationEnabled') === 'true'
    if (!isEnabled) {
      throw new Error('Local dictation is not enabled')
    }

    // Initialize pipeline if needed
    const pipeline = await initializeWhisperPipeline()
    if (!pipeline) {
      throw new Error('Failed to initialize Whisper pipeline')
    }

    // Convert blob to audio data that Whisper can process
    const audioData = await blobToAudioData(audioBlob)
    
    // Transcribe using the pipeline
    console.log('🔄 Running inference...')
    const result = await pipeline(audioData)
    
    if (result && result.text && typeof result.text === 'string') {
      const transcribedText = result.text.trim()
      console.log('✅ Local Whisper transcription successful:', transcribedText.slice(0, 100))
      
      return {
        success: true,
        text: transcribedText
      }
    } else {
      throw new Error('No transcription generated')
    }

  } catch (error: any) {
    console.error('❌ Local Whisper transcription error:', error)
    return {
      success: false,
      error: error.message || 'Failed to transcribe audio locally'
    }
  }
}

async function blobToAudioData(blob: Blob): Promise<Float32Array> {
  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 16000 // Whisper expects 16kHz
  })
  
  try {
    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer()
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    // Get the audio data as Float32Array (mono, 16kHz)
    const audioData = audioBuffer.getChannelData(0) // Get first channel (mono)
    
    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      console.log(`🔄 Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz`)
      return resampleAudio(audioData, audioBuffer.sampleRate, 16000)
    }
    
    return audioData
  } finally {
    // Clean up audio context
    await audioContext.close()
  }
}

function resampleAudio(audioData: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio
    const index = Math.floor(originalIndex)
    const fraction = originalIndex - index
    
    if (index + 1 < audioData.length) {
      // Linear interpolation
      result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction
    } else {
      result[i] = audioData[index] || 0
    }
  }
  
  return result
}

export async function isLocalWhisperAvailable(): Promise<boolean> {
  try {
    // Check if local dictation is enabled
    const isEnabled = localStorage.getItem('localDictationEnabled') === 'true'
    if (!isEnabled) {
      return false
    }
    
    // Check if we can import transformers
    const { pipeline } = await import('@xenova/transformers')
    return typeof pipeline === 'function'
  } catch (error) {
    console.error('Error checking local Whisper availability:', error)
    return false
  }
} 