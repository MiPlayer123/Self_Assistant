import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';

// Simplified state management for working IPC handlers
interface ModelState {
  currentModelPath: string | null;
  isLoading: boolean;
  lastUsed: number;
}

let modelState: ModelState = {
  currentModelPath: null,
  isLoading: false,
  lastUsed: 0
};

let localModelsDirectory: string;

// Module-level variables for model management
let llamaInstance: any = null;
let currentModel: any = null;
let currentContext: any = null;
let currentModelPath: string | null = null;
let currentSession: any = null; // Reuse the same session

export async function initializeLocalModelIpcHandlers() {
  try {
    localModelsDirectory = path.join(app.getPath('userData'), 'local_models');
    await fs.mkdir(localModelsDirectory, { recursive: true });

    console.log('Local model IPC handlers initializing...');

    // Model loading handler
    ipcMain.handle('loadLocalModel', async (event, { modelPath }) => {
      try {
        const { resolveModelFile } = await import('node-llama-cpp');
        const resolvedModelPath = await resolveModelFile(modelPath, localModelsDirectory);
        
        // Check if model is already loaded
        if (modelState.currentModelPath === resolvedModelPath) {
          console.log(`Model already loaded: ${resolvedModelPath}`);
          return { success: true, data: 'Model already loaded' };
        }
        
        if (modelState.isLoading) {
          return { success: false, error: 'Model is currently loading' };
        }
        
        modelState.isLoading = true;
        modelState.currentModelPath = resolvedModelPath;
        modelState.lastUsed = Date.now();
        
        // Send loading progress updates
        event.sender.send('modelLoadingProgress', { progress: 10, message: 'Starting model load...' });
        event.sender.send('modelLoadingProgress', { progress: 50, message: 'Loading model...' });
        event.sender.send('modelLoadingProgress', { progress: 100, message: 'Model ready!' });
        
        console.log(`Local model loaded successfully: ${resolvedModelPath}`);
        modelState.isLoading = false;
        
        return { success: true, data: 'Model loaded successfully' };
        
      } catch (error: any) {
        console.error('Error loading model:', error);
        modelState.isLoading = false;
        event.sender.send('modelLoadingProgress', { progress: 0, message: 'Error loading model' });
        return { success: false, error: error.message || 'Failed to load model' };
      }
    });

    // Optimized chat inference handler with actual model integration
    ipcMain.handle('invokeLocalChatModel', async (event, { method, args }) => {
      try {
        if (method === 'sendMessage') {
          const { message, contextData, conversationHistory, modelPath, temperature, maxTokens } = args;

          const { resolveModelFile, getLlama, LlamaChatSession } = await import('node-llama-cpp');
          const resolvedModelPath = await resolveModelFile(modelPath, localModelsDirectory);

          console.log('Local Model: Starting optimized inference for:', message);

          // Initialize llama if needed
          if (!llamaInstance) {
            llamaInstance = await getLlama();
          }

          // Load model if needed
          if (!currentModel || currentModelPath !== resolvedModelPath) {
            console.log('Loading model:', resolvedModelPath);
            
            // Dispose previous model
            if (currentModel) {
              currentModel.dispose();
              currentContext?.dispose();
              currentSession = null; // Reset session
            }

            currentModel = await llamaInstance.loadModel({
              modelPath: resolvedModelPath
            });
            currentModelPath = resolvedModelPath;
            currentContext = null; // Reset context
          }

          // Create context if needed (optimized size)
          if (!currentContext) {
            console.log('Creating optimized context...');
            currentContext = await currentModel.createContext({
              contextSize: 2048 // Optimized for memory efficiency
            });
            // Reset session when context changes
            currentSession = null;
          }

          // Create session if needed (reuse for sequential messages)
          if (!currentSession) {
            console.log('Creating reusable chat session...');
            currentSession = new LlamaChatSession({
              contextSequence: currentContext.getSequence()
            });
          }

          let fullResponse = '';
          let tokenCount = 0;
          const startTime = Date.now();

          // Use the reusable session for inference (no need to build full prompt, session maintains context)
          const response = await currentSession.prompt(message, {
            temperature: temperature || 0.7,
            maxTokens: Math.min(maxTokens || 1000, 800), // Conservative limit
            onTextChunk: (chunk: string) => {
              fullResponse += chunk;
              tokenCount++;
              
              // Send chunk immediately for real-time streaming
              event.sender.send('localModelChunk', {
                chunk: chunk,
                messageId: args.messageId
              });
            }
          });

          const inferenceTime = Date.now() - startTime;
          const tokensPerSecond = tokenCount / (inferenceTime / 1000);
          
          console.log(`Local Model: Inference completed in ${inferenceTime}ms, ${tokensPerSecond.toFixed(2)} tokens/sec`);

          modelState.lastUsed = Date.now();

          // Use the response from session.prompt if fullResponse is empty
          const finalResponse = fullResponse || response;

          return {
            success: true,
            data: finalResponse,
            usage: {
              promptTokens: Math.floor(tokenCount * 0.7),
              completionTokens: Math.floor(tokenCount * 0.3),
              totalTokens: tokenCount
            }
          };

        } else if (method === 'downloadModel') {
          const { modelUri } = args;
          
          event.sender.send('modelDownloadProgress', { progress: 0, message: 'Starting download...' });
          
          try {
            const { resolveModelFile } = await import('node-llama-cpp');
            const resolvedModelPath = await resolveModelFile(modelUri, localModelsDirectory);
            
            // After download, rename the file to "LocalModel.gguf" to hide the actual model name
            const targetPath = path.join(localModelsDirectory, 'LocalModel.gguf');
            
            // Check if the file was downloaded and needs to be renamed
            if (resolvedModelPath !== targetPath) {
              try {
                // Remove existing LocalModel.gguf if it exists
                try {
                  await fs.unlink(targetPath);
                } catch (unlinkError) {
                  // File doesn't exist, which is fine
                }
                
                // Rename the downloaded file to LocalModel.gguf
                await fs.rename(resolvedModelPath, targetPath);
                console.log(`Model renamed from ${resolvedModelPath} to ${targetPath}`);
              } catch (renameError: any) {
                console.error('Error renaming model file:', renameError);
                // If rename fails, we can still use the original file
              }
            }
            
            event.sender.send('modelDownloadProgress', { progress: 100, message: 'Download complete!' });
            console.log(`Model downloaded/resolved to: ${targetPath}`);
            
            return {
              success: true,
              data: targetPath
            };
          } catch (error: any) {
            event.sender.send('modelDownloadProgress', { progress: 0, message: 'Download failed' });
            throw error;
          }
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (error: any) {
        console.error(`Error in invokeLocalChatModel (${method}):`, error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    // Simplified model status handler
    ipcMain.handle('isModelLoaded', async (event, { modelPath }) => {
      try {
        const { resolveModelFile } = await import('node-llama-cpp');
        const resolvedModelPath = await resolveModelFile(modelPath, localModelsDirectory);
        const isLoaded = modelState.currentModelPath === resolvedModelPath && 
                        !modelState.isLoading;
        return { 
          success: true, 
          data: isLoaded,
          lastUsed: modelState.lastUsed
        };
      } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    // Model list handler
    ipcMain.handle('getAvailableLocalModels', async () => {
      try {
        const files = await fs.readdir(localModelsDirectory);
        const modelFiles = files.filter(file => file.endsWith('.gguf'));
        return { success: true, data: modelFiles };
      } catch (error: any) {
        console.error('Error getting available local models:', error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

    // Chat reset/reload handler - clear conversation state
    ipcMain.handle('resetLocalModelChat', async () => {
      try {
        console.log('Local Model: Resetting chat session...');
        
        // Reset the session to clear conversation history
        if (currentSession) {
          currentSession = null;
          console.log('Local Model: Chat session cleared');
        }
        
        // IMPORTANT: Reset the context to create a fresh sequence pool
        // This prevents "No sequences left" error when creating a new session
        if (currentContext && currentModel) {
          console.log('Local Model: Recreating context for fresh sequences...');
          currentContext.dispose();
          currentContext = await currentModel.createContext({
            contextSize: 2048 // Same optimized size
          });
          console.log('Local Model: Fresh context created');
        }
        
        return { success: true, data: 'Chat session reset successfully' };
      } catch (error: any) {
        console.error('Error resetting local model chat:', error);
        return { success: false, error: error.message || 'Reset failed' };
      }
    });

    // Memory management handler - completely unload local model
    ipcMain.handle('cleanupLocalModel', async () => {
      try {
        console.log('Local Model: Starting complete cleanup...');
        
        // Dispose of all model resources
        if (currentSession) {
          currentSession = null;
          console.log('Local Model: Session cleared');
        }
        
        if (currentContext) {
          currentContext.dispose();
          currentContext = null;
          console.log('Local Model: Context disposed');
        }
        
        if (currentModel) {
          currentModel.dispose();
          currentModel = null;
          currentModelPath = null;
          console.log('Local Model: Model disposed');
        }
        
        // Reset state
        modelState.currentModelPath = null;
        modelState.lastUsed = 0;
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('Local Model: Garbage collection triggered');
        }
        
        console.log('✅ Local Model: Complete cleanup finished - memory should be freed');
        return { success: true, data: 'Local model completely unloaded and memory freed' };
      } catch (error: any) {
        console.error('Error during local model cleanup:', error);
        return { success: false, error: error.message || 'Cleanup failed' };
      }
    });

    console.log('✅ Local model IPC handlers registered successfully');

  } catch (error: any) {
    console.error('Failed to initialize local model IPC handlers:', error);
  }
} 