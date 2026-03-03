export type AccountStatus = 'offline' | 'starting' | 'streaming' | 'error';

export interface IAccountInfo {
  id: string;
  name: string;
  status: AccountStatus;
  duration: number; // in seconds
  streamType: string;
  streamConfig?: IStreamConfig; // 持久化推流与AI配置
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
