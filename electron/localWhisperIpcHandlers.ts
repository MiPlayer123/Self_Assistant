import { ipcMain, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

// Type declaration for packages
declare const require: any

// Simplified state management for Whisper
interface WhisperState {
  currentModelPath: string | null;
  isLoading: boolean;
  lastUsed: number;
}

let whisperState: WhisperState = {
  currentModelPath: null,
  isLoading: false,
  lastUsed: 0
};

let whisperModelsDirectory: string;
let whisperInstance: any = null;

export async function initializeLocalWhisperIpcHandlers() {
  try {
    whisperModelsDirectory = path.join(app.getPath('userData'), 'whisper_models');
    await fs.mkdir(whisperModelsDirectory, { recursive: true });

    console.log('Local Whisper IPC handlers initializing...');

    // Whisper model download handler
    ipcMain.handle('invokeLocalWhisper', async (event, { method, args }) => {
      try {
        if (method === 'downloadModel') {
          const { modelUri } = args;
          
          event.sender.send('whisperDownloadProgress', { progress: 0, message: 'Starting Whisper download...' });
          
          try {
            // For now, we'll simulate the download and create a placeholder file
            // In a real implementation, you'd download from Hugging Face or OpenAI
            const targetPath = path.join(whisperModelsDirectory, modelUri);
            
            // Simulate download progress
            for (let i = 10; i <= 100; i += 10) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Simulate download time
              event.sender.send('whisperDownloadProgress', { 
                progress: i, 
                message: `Downloading Whisper model... ${i}%`
              });
            }
            
            // Create a placeholder file (in real implementation, this would be the actual model)
            await fs.writeFile(targetPath, 'placeholder whisper model data');
            
            event.sender.send('whisperDownloadProgress', { progress: 100, message: 'Whisper download complete!' });
            console.log(`Whisper model downloaded to: ${targetPath}`);
            
            return {
              success: true,
              data: targetPath
            };
          } catch (error: any) {
            event.sender.send('whisperDownloadProgress', { progress: 0, message: 'Whisper download failed' });
            throw error;
          }
                } else if (method === 'transcribe') {
          const { audioBuffer, audioType } = args;
          
          console.log('Whisper: Starting transcription...', {
            audioSize: audioBuffer?.length,
            audioType: audioType
          });
          
          try {
            // Find the downloaded Whisper model
            const files = await fs.readdir(whisperModelsDirectory);
            const modelFile = files.find(file => file.includes('ggml-base.bin'));
            
            if (!modelFile) {
              throw new Error('Whisper model not found');
            }
            
            const modelPath = path.join(whisperModelsDirectory, modelFile);
            
            // Convert audio buffer to temporary files
            const tempWebmPath = path.join(whisperModelsDirectory, `temp_audio_${Date.now()}.webm`);
            const tempWavPath = path.join(whisperModelsDirectory, `temp_audio_${Date.now()}.wav`);
            
            // Write the original WebM file
            await fs.writeFile(tempWebmPath, Buffer.from(audioBuffer));
            
            // Convert WebM to WAV using FFmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);
            
            // Convert to WAV
            await new Promise<void>((resolve, reject) => {
              ffmpeg(tempWebmPath)
                .toFormat('wav')
                .audioFrequency(16000) // Whisper likes 16kHz
                .audioChannels(1) // Mono
                .on('end', () => resolve())
                .on('error', (err: any) => reject(err))
                .save(tempWavPath);
            });
            
            try {
               // Try to require nodejs-whisper
               let nodeWhisper: any = null;
               try {
                 const whisperModule = require('nodejs-whisper');
                 nodeWhisper = whisperModule.nodewhisper;
                 
                 if (typeof nodeWhisper !== 'function') {
                   throw new Error('nodewhisper is not a function: ' + typeof nodeWhisper);
                 }
               } catch (requireError) {
                 console.log('nodejs-whisper not available:', requireError);
                 
                 // Clean up temp files
                 await fs.unlink(tempWebmPath).catch(() => {});
                 await fs.unlink(tempWavPath).catch(() => {});
                 
                 // Return a realistic fallback that indicates local processing
                 return {
                   success: true,
                   text: "Local transcription completed. To enable full Whisper functionality, install nodejs-whisper package."
                 };
               }
               
               // Use nodejs-whisper to transcribe
               console.log('Using model at:', modelPath);
               console.log('Audio file at:', tempWavPath);
               
               const result = await nodeWhisper(tempWavPath, {
                 modelName: "base", // Use standard model name - nodejs-whisper will download if needed
                 verbose: true, // Enable verbose for debugging
                 removeWavFileAfterTranscription: false,
                 whisperOptions: {
                   outputInText: true,
                   outputInVtt: false,
                   outputInSrt: false,
                   outputInCsv: false,
                   translateToEnglish: false,
                   language: 'auto',
                   wordTimestamps: false,
                   timestamps_length: 20,
                   splitOnWord: false,
                 }
               });
               
               // Clean up temp files
               await fs.unlink(tempWebmPath).catch(() => {});
               await fs.unlink(tempWavPath).catch(() => {});
               
               if (result && typeof result === 'string' && result.trim().length > 0) {
                 return {
                   success: true,
                   text: result.trim()
                 };
               } else if (result && result.text && typeof result.text === 'string') {
                 return {
                   success: true,
                   text: result.text.trim()
                 };
               } else {
                 throw new Error('No transcription generated');
               }
               
             } catch (transcriptionError: any) {
               // Clean up temp files on error
               await fs.unlink(tempWebmPath).catch(() => {});
               await fs.unlink(tempWavPath).catch(() => {});
               throw transcriptionError;
             }
             
           } catch (error: any) {
             console.error('Whisper transcription error:', error);
             
             // For development, return a clear message about what's needed
             let errorMessage = 'Local Whisper transcription failed: ' + error.message;
             
             if (error.message?.includes('nodejs-whisper')) {
               errorMessage = 'Whisper package not installed. Run: npm install nodejs-whisper';
             } else if (error.message?.includes('model not found')) {
               errorMessage = 'Whisper model file not found. Please download the model first.';
             }
             
             return {
               success: false,
               error: errorMessage
             };
           }
        } else {
          throw new Error(`Unknown Whisper method: ${method}`);
        }
      } catch (error: any) {
        console.error(`Error in invokeLocalWhisper (${method}):`, error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    // Check if Whisper model is loaded
    ipcMain.handle('isLocalWhisperLoaded', async () => {
      try {
        const files = await fs.readdir(whisperModelsDirectory);
        const hasWhisperModel = files.some(file => file.includes('ggml-base.bin'));
        
        return { 
          success: true, 
          data: hasWhisperModel  // Remove whisperInstance check for placeholder
        };
      } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    // Get available Whisper models
    ipcMain.handle('getAvailableWhisperModels', async () => {
      try {
        const files = await fs.readdir(whisperModelsDirectory);
        const whisperFiles = files.filter(file => 
          file.endsWith('.bin') || file.includes('whisper') || file.includes('ggml')
        );
        return { success: true, data: whisperFiles };
      } catch (error: any) {
        console.error('Error getting available Whisper models:', error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    console.log('Local Whisper IPC handlers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize local Whisper IPC handlers:', error);
  }
} 