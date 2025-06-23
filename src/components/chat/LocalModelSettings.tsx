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

// WhisperModel interface removed - no longer needed with automatic model handling

const POPULAR_MODELS: PopularModel[] = [
  {
    name: 'Download Local Model',
    uri: 'hf:bartowski/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct-Q6_K.gguf',
    description: 'High-quality local AI model for text generation',
    size: '2.64GB'
  }
];

// Whisper models are now handled automatically by @xenova/transformers
// The whisper-base.en model will be downloaded automatically when first used

export const LocalModelSettings: React.FC<LocalModelSettingsProps> = ({ onSelectLocalModel, onModelDownloaded }) => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  // Local dictation is now handled automatically - no download needed
  
  // Search settings state
  const [searchEnabled, setSearchEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('localModelSearchEnabled');
    return saved === 'true';
  });

  // Local dictation settings state
  const [localDictationEnabled, setLocalDictationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('localDictationEnabled');
    return saved === 'true';
  });

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

  // Whisper models are handled automatically by @xenova/transformers

  useEffect(() => {
    fetchAvailableModels();
    
    // Set up listener for download progress
    if (typeof window !== 'undefined' && (window as any).electronAPI?.addListener) {
      const removeDownloadListener = (window as any).electronAPI.addListener('modelDownloadProgress', (data: any) => {
        setDownloadProgress(data.progress);
        setDownloadStatus(data.message);
      });

      return () => {
        if (removeDownloadListener) {
          removeDownloadListener();
        }
      };
    }
  }, []);

  const handleDownloadModel = async (uri: string) => {
    setDownloadStatus('Starting download...');
    setDownloadProgress(0);
    setError(null);
    setDownloadingModel(uri);
    
    try {
      const response = await window.electronAPI?.invokeLocalChatModel('downloadModel', {
        modelUri: uri
      });

      if (response?.success) {
        setDownloadStatus('Download complete!');
        setDownloadProgress(100);
        fetchAvailableModels(); // Refresh the list of models
        if (onModelDownloaded) onModelDownloaded();
        
        // Clear progress after a delay
        setTimeout(() => {
          setDownloadProgress(0);
          setDownloadStatus('');
        }, 2000);
      } else {
        setDownloadStatus('Download failed.');
        setDownloadProgress(0);
        setError(response?.error || 'Unknown download error');
      }
    } catch (err: any) {
      setDownloadStatus('Download failed.');
      setDownloadProgress(0);
      setError(err.message || 'Error initiating download');
    } finally {
      setDownloadingModel(null);
    }
  };

  // Whisper models are downloaded automatically by @xenova/transformers

  const isLocalModelDownloaded = availableModels.some(model => model.filename === 'LocalModel.gguf');

  const handleSearchToggle = (enabled: boolean) => {
    setSearchEnabled(enabled);
    localStorage.setItem('localModelSearchEnabled', enabled.toString());
  };

  const handleLocalDictationToggle = (enabled: boolean) => {
    setLocalDictationEnabled(enabled);
    localStorage.setItem('localDictationEnabled', enabled.toString());
  };

  return (
    <div className="local-model-settings p-4 border rounded-md shadow-sm bg-zinc-700">
      <h3 className="text-lg font-semibold mb-4 text-white">Local Model Settings</h3>

      {/* Popular Models Section */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3 text-white">Available Model:</h4>
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
                  disabled={downloadingModel === model.uri || isLocalModelDownloaded}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingModel === model.uri ? 'Downloading...' : isLocalModelDownloaded ? 'Already Downloaded' : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Local Dictation Settings Section */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3 text-white">Local Dictation Settings:</h4>
        <div className="border border-gray-600 rounded-md p-3 bg-zinc-800">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={localDictationEnabled}
              onChange={(e) => handleLocalDictationToggle(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
            <div>
              <span className="text-white font-medium">Enable Local Dictation</span>
              <p className="text-sm text-gray-400">
                Use local Whisper model for voice transcription across all AI models. The model will download automatically when first used.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {downloadStatus && (
        <div className="mb-2">
          <p className="text-sm text-gray-300 mb-1">{downloadStatus}</p>
          {downloadingModel && downloadProgress > 0 && (
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-400">Error: {error}</p>}



      {/* Search Settings Section */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3 text-white">Search Settings:</h4>
        <div className="border border-gray-600 rounded-md p-3 bg-zinc-800">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={searchEnabled}
              onChange={(e) => handleSearchToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div>
              <span className="text-white font-medium">Enable Web Search</span>
              <p className="text-sm text-gray-400">
                Allow the local model to search the web for current information when needed. (Requires internet)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Available Models Section */}
      <div>
        <h4 className="text-md font-semibold mb-2 text-white">Downloaded Models:</h4>
        {availableModels.length === 0 ? (
          <p className="text-sm text-gray-400">No local models downloaded yet. Download the model above!</p>
        ) : (
          <ul className="space-y-1">
            {availableModels.map((model) => (
              <li key={model.filename} className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-300">
                  {model.filename === 'LocalModel.gguf' ? 'Local AI Model (Ready)' : model.filename}
                </span>
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