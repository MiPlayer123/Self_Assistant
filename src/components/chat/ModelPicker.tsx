import React from 'react';
import { useModel } from '../../contexts/ModelContext';
import { AI_MODEL_PROVIDERS } from '../../lib/aiModels';

const ModelPicker: React.FC = () => {
  const { selectedModelId, setSelectedModelId } = useModel();

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
          {AI_MODEL_PROVIDERS.map((provider) => (
            <optgroup key={provider.id} label={provider.name}>
              {provider.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ModelPicker; 