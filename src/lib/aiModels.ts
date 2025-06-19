export interface AiModel {
  id: string; // Unique identifier for the model (e.g., 'openai:gpt-4o', 'anthropic:claude-3-5-sonnet')
  name: string; // Display name for the model (e.g., 'GPT-4o', 'Claude 3.5 Sonnet')
  provider: string; // Identifier for the provider (e.g., 'openai', 'anthropic', 'google')
}

export interface AiModelProvider {
  id: string; // Unique identifier for the provider (e.g., 'openai', 'anthropic', 'google')
  name: string; // Display name for the provider (e.g., 'OpenAI', 'Anthropic', 'Google')
  models: AiModel[];
}

export const AI_MODEL_PROVIDERS: AiModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'openai:gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'openai:gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      { id: 'openai:gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'anthropic:claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic' },
      { id: 'anthropic:claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'anthropic' },
      { id: 'anthropic:claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'google:gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
      { id: 'google:gemini-2.5-flash-preview-06-05', name: 'Gemini 2.5 Flash (Thinking)', provider: 'google' },
      { id: 'google:gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro (Thinking)', provider: 'google' },
    ],
  },
  {
    id: 'local',
    name: 'Local Models',
    models: [],
  },
];

export const DEFAULT_CHAT_MODEL_ID = AI_MODEL_PROVIDERS[0].models[0].id; 