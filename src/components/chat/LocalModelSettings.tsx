import React, { useState, useEffect } from 'react';

interface LocalModelSettingsProps {
  onSelectLocalModel: (modelPath: string) => void;
}

interface ModelInfo {
  filename: string;
}

export const LocalModelSettings: React.FC<LocalModelSettingsProps> = ({ onSelectLocalModel }) => {
  const [modelUri, setModelUri] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

  const handleDownloadModel = async () => {
    setDownloadStatus('Downloading...');
    setError(null);
    try {
      const response = await window.electronAPI?.invokeLocalChatModel('downloadModel', {
        modelUri
      });

      if (response?.success) {
        setDownloadStatus('Download complete!');
        setModelUri(''); // Clear input after successful download
        fetchAvailableModels(); // Refresh the list of models
      } else {
        setDownloadStatus('Download failed.');
        setError(response?.error || 'Unknown download error');
      }
    } catch (err: any) {
      setDownloadStatus('Download failed.');
      setError(err.message || 'Error initiating download');
    }
  };

  return (
    <div className="local-model-settings p-4 border rounded-md shadow-sm bg-zinc-700">
      <h3 className="text-lg font-semibold mb-2 text-white">Local Model Settings</h3>

      <div className="mb-4">
        <label htmlFor="modelUri" className="block text-sm font-medium text-gray-300">
          Model URI (hf:user/model/file.gguf or https://example.com/model.gguf):
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
          onClick={handleDownloadModel}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          disabled={!modelUri}
        >
          Download Model
        </button>
        {downloadStatus && <p className="mt-2 text-sm text-gray-300">{downloadStatus}</p>}
        {error && <p className="mt-2 text-sm text-red-400">Error: {error}</p>}
      </div>

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