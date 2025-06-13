import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_CHAT_MODEL_ID } from '../lib/aiModels';

interface ModelContextType {
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const storedModelId = localStorage.getItem('selectedAiModelId');
    return storedModelId || DEFAULT_CHAT_MODEL_ID;
  });

  useEffect(() => {
    localStorage.setItem('selectedAiModelId', selectedModelId);
  }, [selectedModelId]);

  return (
    <ModelContext.Provider value={{ selectedModelId, setSelectedModelId }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}; 