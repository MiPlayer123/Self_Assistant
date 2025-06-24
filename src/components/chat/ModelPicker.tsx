import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { useModel } from '../../contexts/ModelContext';
import { AI_MODEL_PROVIDERS, AiModel } from '../../lib/aiModels';

export interface ModelPickerRef {
  refreshLocalModels: () => void;
}

const ModelPicker = forwardRef<ModelPickerRef>((props, ref) => {
  const { selectedModelId, setSelectedModelId } = useModel();
  const [dynamicLocalModels, setDynamicLocalModels] = useState<AiModel[]>([]);

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

  useEffect(() => {
    fetchLocalModels();
  }, []);

  // Expose refresh function to parent components
  useImperativeHandle(ref, () => ({
    refreshLocalModels: fetchLocalModels
  }));

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(event.target.value);
  };

  return (
    <div className="model-picker-container flex items-center">
      <label
        htmlFor="model-select"
        className="text-sm mr-2"
        style={{ color: "var(--wagoo-text-secondary)" }}
      >
        Model:
      </label>
      <div className="w-fit min-w-0">
        <select
          id="model-select"
          value={selectedModelId}
          onChange={handleChange}
          className="px-2 py-1 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none cursor-pointer transition-all duration-200"
          style={{
            borderColor: "var(--wagoo-border-primary)",
            backgroundColor: "var(--wagoo-bg-tertiary)",
            color: "var(--wagoo-text-primary)"
          }}
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
});

ModelPicker.displayName = 'ModelPicker';

export default ModelPicker; 