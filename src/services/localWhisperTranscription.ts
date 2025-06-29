export interface LocalTranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

// Global whisper pipeline instance
let whisperPipeline: any = null
let isInitializing = false
let initializationAttempts = 0
const MAX_INIT_ATTEMPTS = 2

async function initializeWhisperPipeline() {
  if (whisperPipeline || isInitializing) {
    return whisperPipeline
  }

  isInitializing = true
  initializationAttempts++
  
  try {
    console.log('🔧 Initializing local Whisper pipeline... (attempt', initializationAttempts, ')')
    
    // Dynamic import of @xenova/transformers
    const { pipeline, env } = await import('@xenova/transformers')
    
    // Configure transformers environment for production
    env.allowLocalModels = false
    env.allowRemoteModels = true
    env.useBrowserCache = true
    
    // Production-specific configuration
    env.backends.onnx.wasm.wasmPaths = undefined // Let it auto-detect
    env.backends.onnx.wasm.numThreads = 1 // Limit threads for stability
    
    // Clear cache if we've had multiple failures
    if (initializationAttempts > 1) {
      console.log('🧹 Clearing transformer cache due to previous failures...')
      try {
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
      'openai/whisper-tiny.en',
      'openai/whisper-tiny'
    ]
    
    let lastError: any = null
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔄 Trying model: ${modelName}`)
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model loading timeout')), 30000)
        )
        
        const modelPromise = pipeline('automatic-speech-recognition', modelName, {
          quantized: true
        })
        
        whisperPipeline = await Promise.race([modelPromise, timeoutPromise])
        
        // Test the pipeline with a small dummy input
        console.log('🧪 Testing model with dummy input...')
        const testAudio = new Float32Array(16000) // 1 second of silence at 16kHz
        const testResult = await whisperPipeline(testAudio)
        
        // Validate the result format
        if (!testResult || typeof testResult.text !== 'string') {
          throw new Error('Model test failed: invalid output format')
        }
        
        // Check for suspicious outputs that might indicate model corruption
        const testText = testResult.text.toLowerCase().trim()
        if (testText === 'you' || testText === 'yo' || testText.length < 2) {
          throw new Error('Model test failed: suspicious output detected')
        }
        
        console.log(`✅ Successfully loaded and tested model: ${modelName}`)
        break
      } catch (err: any) {
        console.warn(`⚠️ Failed to load ${modelName}:`, err.message)
        lastError = err
        whisperPipeline = null
        continue
      }
    }
    
    if (!whisperPipeline) {
      throw new Error(`Failed to load any speech recognition model. Last error: ${lastError?.message}`)
    }
    
    console.log('✅ Local Whisper pipeline initialized successfully')
    initializationAttempts = 0 // Reset on success
    return whisperPipeline
  } catch (error) {
    console.error('❌ Failed to initialize Whisper pipeline:', error)
    whisperPipeline = null
    
    // Mark failure for cache clearing next time
    localStorage.setItem('whisperInitFailure', Date.now().toString())
    
    // If we've failed multiple times, disable local transcription temporarily
    if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
      console.error('❌ Max initialization attempts reached. Disabling local transcription.')
      localStorage.setItem('localDictationEnabled', 'false')
    }
    
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

    // Validate audio blob
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid audio data: empty blob')
    }

    if (audioBlob.size < 1000) { // Very small audio files are likely empty/corrupted
      throw new Error('Audio data too small to transcribe')
    }

    // Initialize pipeline if needed
    const pipeline = await initializeWhisperPipeline()
    if (!pipeline) {
      throw new Error('Failed to initialize Whisper pipeline')
    }

    // Convert blob to audio data that Whisper can process
    const audioData = await blobToAudioData(audioBlob)
    
    // Validate audio data
    if (!audioData || audioData.length === 0) {
      throw new Error('Failed to convert audio to proper format')
    }

    // Check if audio is just silence (all values near zero)
    const avgAmplitude = audioData.reduce((sum, val) => sum + Math.abs(val), 0) / audioData.length
    if (avgAmplitude < 0.001) {
      throw new Error('Audio appears to be silent')
    }
    
    // Transcribe using the pipeline
    console.log('🔄 Running inference...')
    const result = await pipeline(audioData, {
      language: 'english',
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 0, // Process entire audio at once
      stride_length_s: 0
    })
    
    if (result && result.text && typeof result.text === 'string') {
      const transcribedText = result.text.trim()
      
      // Additional validation to catch suspicious outputs
      if (transcribedText.length === 0) {
        throw new Error('Model returned empty transcription')
      }
      
      // Check for known problematic outputs
      const lowerText = transcribedText.toLowerCase()
      if (lowerText === 'you' || lowerText === 'yo' || lowerText.length < 2) {
        throw new Error('Model returned suspicious output: ' + transcribedText)
      }
      
      console.log('✅ Local Whisper transcription successful:', transcribedText.slice(0, 100))
      
      return {
        success: true,
        text: transcribedText
      }
    } else {
      throw new Error('No transcription generated by model')
    }

  } catch (error: any) {
    console.error('❌ Local Whisper transcription error:', error)
    
    // If we get repeated "you" errors, disable local transcription
    if (error.message?.includes('suspicious output')) {
      console.error('❌ Disabling local transcription due to model corruption')
      localStorage.setItem('localDictationEnabled', 'false')
      whisperPipeline = null // Force reinitialization next time
    }
    
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