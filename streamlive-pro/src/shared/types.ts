export type AccountStatus = 'offline' | 'starting' | 'streaming' | 'error';

export interface IAccountInfo {
  id: string;
  name: string;
  status: AccountStatus;
  duration: number; // in seconds
  streamType: string;
}

export interface IAISettings {
  enabled: boolean;
  provider: 'openai' | 'deepseek';
  apiKey: string;
  systemPrompt: string;
}

export interface IStreamConfig {
  server: string;
  key: string;
  filePath?: string;
  aiSettings?: IAISettings;
}

export interface IPCMessage {
  type: string;
  payload?: any;
}
