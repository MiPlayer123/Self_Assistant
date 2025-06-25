import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

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
    <Card className="local-model-settings bg-zinc-800/95 border-zinc-600">
      <CardHeader className="pb-4">
        <CardTitle className="text-white">Local Model Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

      {/* Popular Models Section */}
      <div>
        <h4 className="text-md font-semibold mb-2 text-white">Available Model:</h4>
        {POPULAR_MODELS.map((model) => (
          <Card key={model.uri} className="p-4 bg-zinc-700/80 border-zinc-600">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <h5 className="font-medium text-white mb-1">{model.name}</h5>
                <p className="text-sm text-gray-300 mb-1">{model.description}</p>
                <p className="text-xs text-gray-400">Size: {model.size}</p>
              </div>
              <Button
                onClick={() => handleDownloadModel(model.uri)}
                disabled={downloadingModel === model.uri || isLocalModelDownloaded}
                className="bg-blue-500 hover:bg-blue-600 text-white shrink-0"
                size="sm"
              >
                {downloadingModel === model.uri ? 'Downloading...' : isLocalModelDownloaded ? 'Downloaded' : 'Download'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Local Dictation Settings Section */}
      <div>
        <h4 className="text-md font-semibold mb-2 text-white">Local Dictation Settings:</h4>
        <Card className="p-4 bg-zinc-700/80 border-zinc-600">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localDictationEnabled}
              onChange={(e) => handleLocalDictationToggle(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-blue-500 bg-zinc-600 border-zinc-500 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div>
              <span className="font-medium text-white">Enable Local Dictation</span>
              <p className="text-sm text-gray-300 mt-1">
                Use local Whisper model for voice transcription across all AI models. The model will download automatically when first used.
              </p>
            </div>
          </label>
        </Card>
      </div>

      {/* Status Messages */}
      {downloadStatus && (
        <Card className="p-4 bg-zinc-700/80 border-zinc-600">
          <p className="text-sm text-white mb-2">{downloadStatus}</p>
          {downloadingModel && downloadProgress > 0 && (
            <div className="w-full bg-zinc-600 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-red-900/20 border-red-500/50">
          <p className="text-sm text-red-300">Error: {error}</p>
        </Card>
      )}

      {/* Search Settings Section */}
      <div>
        <h4 className="text-md font-semibold mb-2 text-white">Search Settings:</h4>
        <Card className="p-4 bg-zinc-700/80 border-zinc-600">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={searchEnabled}
              onChange={(e) => handleSearchToggle(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-blue-500 bg-zinc-600 border-zinc-500 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div>
              <span className="font-medium text-white">Enable Web Search</span>
              <p className="text-sm text-gray-300 mt-1">
                Allow the local model to search the web for current information when needed. (Requires internet)
              </p>
            </div>
          </label>
        </Card>
      </div>


      </CardContent>
    </Card>
  );
}; 