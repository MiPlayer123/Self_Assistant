import React, { useState, useEffect } from 'react';

interface LocalModelSettingsProps {
  onSelectLocalModel: (modelPath: string) => void;
  onModelDownloaded?: () => void;
}

interface ModelInfo {
  filename: string;
}

interface PopularModel {
  name: string;
  uri: string;
  description: string;
  size: string;
}

const POPULAR_MODELS: PopularModel[] = [
  {
    name: 'Qwen3-8B (Q4_K_M)',
    uri: 'hf:Qwen/Qwen3-8B-GGUF/Qwen3-8B-Q4_K_M.gguf',
    description: 'Advanced reasoning with thinking/non-thinking modes (Text-only)',
    size: '~5GB'
  },
  {
    name: 'Qwen3-8B (Q8_0)',
    uri: 'hf:Qwen/Qwen3-8B-GGUF/Qwen3-8B-Q8_0.gguf',
    description: 'Higher quality, larger size version (Text-only)',
    size: '~8.7GB'
  },
  {
    name: 'LLaVA 1.6 Vicuna 7B (Q4_K_M)',
    uri: 'hf:cjpais/llava-1.6-vicuna-7b-gguf/llava-v1.6-vicuna-7b.q4_k_m.gguf',
    description: 'Multimodal vision model - can analyze images',
    size: '~4GB'
  },
  {
    name: 'BakLLaVA 7B (Q4_K_M)',
    uri: 'hf:mys/ggml_bakllava-1/ggml-model-q4_k.gguf',
    description: 'Multimodal model based on Mistral 7B with vision',
    size: '~4GB'
  },
  {
    name: 'Llama 3.2 3B (Q4_K_M)',
    uri: 'hf:bartowski/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    description: 'Compact and efficient model (Text-only)',
    size: '~2GB'
  }
];

export const LocalModelSettings: React.FC<LocalModelSettingsProps> = ({ onSelectLocalModel, onModelDownloaded }) => {
  const [modelUri, setModelUri] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);

  const fetchAvailableModels = async () => {
    try {
      const response = await window.electronAPI?.getAvailableLocalModels();
      if (response?.success) {
        setAvailableModels(response.data?.map((filename: string) => ({ filename })) || []);
      } else {
        setError(response?.error || 'Failed to fetch available models');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching available models');
    }
  };

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  const handleDownloadModel = async (uri?: string) => {
    const downloadUri = uri || modelUri;
    if (!downloadUri) return;

    setDownloadStatus('Downloading...');
    setError(null);
    setDownloadingModel(downloadUri);
    
    try {
      const response = await window.electronAPI?.invokeLocalChatModel('downloadModel', {
        modelUri: downloadUri
      });

      if (response?.success) {
        setDownloadStatus('Download complete!');
        if (!uri) setModelUri(''); // Clear input only if it was manual entry
        fetchAvailableModels(); // Refresh the list of models
        if (onModelDownloaded) onModelDownloaded();
      } else {
        setDownloadStatus('Download failed.');
        setError(response?.error || 'Unknown download error');
      }
    } catch (err: any) {
      setDownloadStatus('Download failed.');
      setError(err.message || 'Error initiating download');
    } finally {
      setDownloadingModel(null);
    }
  };

  return (
    <div className="local-model-settings p-4 border rounded-md shadow-sm bg-zinc-700">
      <h3 className="text-lg font-semibold mb-4 text-white">Local Model Settings</h3>

      {/* Popular Models Section */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3 text-white">Popular Models:</h4>
        <div className="space-y-3">
          {POPULAR_MODELS.map((model) => (
            <div key={model.uri} className="border border-gray-600 rounded-md p-3 bg-zinc-800">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h5 className="font-medium text-white">{model.name}</h5>
                  <p className="text-sm text-gray-400">{model.description}</p>
                  <p className="text-xs text-gray-500">Size: {model.size}</p>
                </div>
                <button
                  onClick={() => handleDownloadModel(model.uri)}
                  disabled={downloadingModel === model.uri}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingModel === model.uri ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Model URI Section */}
      <div className="mb-4">
        <label htmlFor="modelUri" className="block text-sm font-medium text-gray-300 mb-2">
          Or enter custom model URI:
        </label>
        <input
          type="text"
          id="modelUri"
          value={modelUri}
          onChange={(e) => setModelUri(e.target.value)}
          placeholder="e.g., hf:user/model/model.gguf"
          className="mt-1 block w-full border border-gray-600 rounded-md shadow-sm p-2 bg-zinc-800 text-white"
        />
        <button
          onClick={() => handleDownloadModel()}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          disabled={!modelUri || downloadingModel === modelUri}
        >
          {downloadingModel === modelUri ? 'Downloading...' : 'Download Model'}
        </button>
      </div>

      {/* Status Messages */}
      {downloadStatus && <p className="mb-2 text-sm text-gray-300">{downloadStatus}</p>}
      {error && <p className="mb-2 text-sm text-red-400">Error: {error}</p>}

      {/* Available Models Section */}
      <div>
        <h4 className="text-md font-semibold mb-2 text-white">Available Local Models:</h4>
        {availableModels.length === 0 ? (
          <p className="text-sm text-gray-400">No local models available. Download one above!</p>
        ) : (
          <ul className="space-y-1">
            {availableModels.map((model) => (
              <li key={model.filename} className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-300">{model.filename}</span>
                <button
                  onClick={() => onSelectLocalModel(model.filename)}
                  className="ml-4 px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600"
                >
                  Use Model
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}; 