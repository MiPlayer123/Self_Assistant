import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_CHAT_MODEL_ID } from '../lib/aiModels';

interface ModelContextType {
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  isModelLoading: boolean;
  setIsModelLoading: (loading: boolean) => void;
  modelLoadingProgress: number;
  setModelLoadingProgress: (progress: number) => void;
  modelLoadingMessage: string;
  setModelLoadingMessage: (message: string) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const storedModelId = localStorage.getItem('selectedAiModelId');
    return storedModelId || DEFAULT_CHAT_MODEL_ID;
  });
  
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
  const [modelLoadingMessage, setModelLoadingMessage] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('selectedAiModelId', selectedModelId);
  }, [selectedModelId]);

  return (
    <ModelContext.Provider value={{ 
      selectedModelId, 
      setSelectedModelId,
      isModelLoading,
      setIsModelLoading,
      modelLoadingProgress,
      setModelLoadingProgress,
      modelLoadingMessage,
      setModelLoadingMessage
    }}>
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