import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';

let llama: any;
let llamaModel: any = null;
let llamaContext: any = null;
let localModelsDirectory: string;

export async function initializeLocalModelIpcHandlers() {
  try {
    // Use dynamic import for node-llama-cpp since it's an ES module
    const { getLlama, resolveModelFile } = await import('node-llama-cpp');
    
    llama = await getLlama();
    console.log("node-llama-cpp initialized in main process.");
    
    localModelsDirectory = path.join(app.getPath('userData'), 'local_models');
    await fs.mkdir(localModelsDirectory, { recursive: true });

    ipcMain.handle('invokeLocalChatModel', async (event, { method, args }) => {
      try {
        if (method === 'sendMessage') {
          const { message, conversationHistory, modelPath, temperature, maxTokens } = args;

          const resolvedModelPath = await resolveModelFile(modelPath, localModelsDirectory);

          if (!llamaModel || (llamaModel as any).modelPath !== resolvedModelPath) {
            if (llamaModel) {
              llamaModel.dispose();
              llamaContext?.dispose();
            }
            llamaModel = await llama.loadModel({ modelPath: resolvedModelPath });
            llamaContext = await llamaModel.createContext();
            console.log(`Local model loaded: ${resolvedModelPath}`);
          }

          if (!llamaContext) {
            throw new Error('Llama context not initialized.');
          }

          const { LlamaChatSession } = await import('node-llama-cpp');
          const session = new LlamaChatSession({
            contextSequence: llamaContext.getSequence()
          });

          let conversationContext = '';
          if (conversationHistory && conversationHistory.length > 0) {
            conversationContext = conversationHistory
              .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
              .join('\n') + '\n';
          }

          const fullPrompt = conversationContext + `User: ${message}\nAssistant:`;

          let fullResponse = '';
          let tokenCount = 0;

          await session.prompt(fullPrompt, {
            temperature: temperature || 0.7,
            maxTokens: maxTokens || 2000,
            onToken: (chunk: any) => {
              const chunkText = chunk.toString();
              fullResponse += chunkText;
              tokenCount++;
            }
          });

          return {
            success: true,
            data: fullResponse,
            usage: {
              promptTokens: Math.floor(tokenCount * 0.7),
              completionTokens: Math.floor(tokenCount * 0.3),
              totalTokens: tokenCount
            }
          };
        } else if (method === 'downloadModel') {
          const { modelUri } = args;
          
          // Just resolve/download the model without loading it
          const resolvedModelPath = await resolveModelFile(modelUri, localModelsDirectory);
          console.log(`Model downloaded/resolved to: ${resolvedModelPath}`);
          
          return {
            success: true,
            data: resolvedModelPath
          };
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (error: any) {
        console.error(`Error in invokeLocalChatModel (${method}):`, error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });

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
  } catch (error: any) {
    console.error('Failed to initialize local model IPC handlers:', error);
    // Don't throw here, just log the error so the app can still start
  }
} 