export type AccountStatus = 'offline' | 'starting' | 'streaming' | 'error';

export interface IAccountInfo {
  id: string;
  name: string;
  status: AccountStatus;
  duration: number; // in seconds
  streamType: string;
}

export interface IStreamConfig {
  server: string;
  key: string;
  filePath?: string;
}

export interface IPCMessage {
  type: string;
  payload?: any;
}
