import React, { useEffect, useState } from 'react';
import { useModel } from '../../contexts/ModelContext';
import { AI_MODEL_PROVIDERS, AiModel } from '../../lib/aiModels';

const ModelPicker: React.FC = () => {
  const { selectedModelId, setSelectedModelId } = useModel();
  const [dynamicLocalModels, setDynamicLocalModels] = useState<AiModel[]>([]);

  useEffect(() => {
    const fetchLocalModels = async () => {
      if (window.electronAPI) {
        try {
          const response = await window.electronAPI.getAvailableLocalModels();
          if (response.success && response.data) {
            const models: AiModel[] = response.data.map(filename => ({
              id: `local-${filename}`,
              name: filename.replace('.gguf', ''), // Display name without .gguf extension
              provider: 'local',
            }));
            setDynamicLocalModels(models);
          } else {
            console.error('Failed to fetch local models:', response.error);
          }
        } catch (error) {
          console.error('Error fetching local models:', error);
        }
      }
    };

    fetchLocalModels();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(event.target.value);
  };

  return (
    <div className="model-picker-container flex items-center">
      <label htmlFor="model-select" className="text-gray-300 text-sm mr-1">Model:</label>
      <div className="w-fit min-w-0">
        <select
          id="model-select"
          value={selectedModelId}
          onChange={handleChange}
          className="px-1 py-0.5 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-zinc-700 text-white text-xs appearance-none !block cursor-pointer"
        >
          {AI_MODEL_PROVIDERS.map((provider) => {
            if (provider.id === 'local') {
              return (
                <optgroup key={provider.id} label={provider.name}>
                  {dynamicLocalModels.length > 0 ? (
                    dynamicLocalModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))
                  ) : (
                    <option key="local-none-selected" value="local-none-selected">No local models found</option>
                  )}
                </optgroup>
              );
            } else {
              return (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              );
            }
          })}
        </select>
      </div>
    </div>
  );
};

export default ModelPicker; 