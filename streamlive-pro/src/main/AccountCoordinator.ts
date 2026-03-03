import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { AccountStatus, IAccountInfo, IStreamConfig } from '../shared/types';

export class AccountCoordinator extends EventEmitter {
  private accounts: Map<string, IAccountInfo> = new Map();
  private workers: Map<string, ChildProcess> = new Map();
  private configPath: string;

  constructor() {
    super();
    this.configPath = path.join(app.getPath('userData'), 'accounts.json');
    this.loadAccounts();
  }

  private loadAccounts() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const parsedAccounts: IAccountInfo[] = JSON.parse(data);
        parsedAccounts.forEach(acc => {
          // Reset status to offline on load
          acc.status = 'offline';
          this.accounts.set(acc.id, acc);
        });
        console.log(`[AccountCoordinator] Loaded ${parsedAccounts.length} accounts from ${this.configPath}`);
      }
    } catch (e) {
      console.error('[AccountCoordinator] Failed to load accounts.json', e);
    }

    // Default mock data if empty
    if (this.accounts.size === 0) {
      this.createAccount(`acc_${Date.now()}`, '默认测试直播间');
    }
  }

  private saveAccounts() {
    try {
      const accountsArray = Array.from(this.accounts.values());
      fs.writeFileSync(this.configPath, JSON.stringify(accountsArray, null, 2), 'utf8');
    } catch (e) {
      console.error('[AccountCoordinator] Failed to save accounts.json', e);
    }
  }

  createAccount(id: string, name: string) {
    const accountInfo: IAccountInfo = {
      id,
      name,
      status: 'offline',
      duration: 0,
      streamType: 'rtmp',
      streamConfig: {
          server: 'rtmp://localhost/live/',
          key: 'test',
          aiSettings: {
              enabled: false,
              provider: 'deepseek',
              apiKey: '',
              systemPrompt: '你是一个活泼的带货主播助手。'
          }
      }
    };
    this.accounts.set(id, accountInfo);
    this.saveAccounts();
    return accountInfo;
  }

  updateAccountConfig(accountId: string, streamType: string, streamConfig: IStreamConfig) {
      const account = this.accounts.get(accountId);
      if (account) {
          account.streamType = streamType;
          account.streamConfig = streamConfig;
          this.saveAccounts();
      }
  }

  async startAccount(accountId: string, streamType: string = 'rtmp', streamConfig: any = null): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found.`);
    if (this.workers.has(accountId)) throw new Error(`Account ${accountId} is already running.`);

    // 启动时自动保存用户的最新配置
    if (streamConfig) {
        this.updateAccountConfig(accountId, streamType, streamConfig);
    } else {
        streamConfig = account.streamConfig;
    }

    // Update state to starting
    account.status = 'starting';
    account.streamType = streamType;
    this.emitStatusChange(accountId, account.status);

    // Fork a new worker process
    const workerPath = path.join(__dirname, '../worker/AccountWorker.js');
    console.log(`Starting worker for ${accountId} at ${workerPath}`);

    const workerArgs = [accountId, streamType];
    if (streamConfig) {
        workerArgs.push(JSON.stringify(streamConfig));
    }

    const worker = fork(workerPath, workerArgs, {
      env: { ...process.env, ACCOUNT_ID: accountId },
      stdio: 'inherit',
    });

    this.workers.set(accountId, worker);

    worker.on('message', (message: any) => {
      this.handleIpcMessage(accountId, message);
    });

    worker.on('error', (err) => {
      console.error(`Worker error for ${accountId}:`, err);
      this.handleWorkerExit(accountId);
    });

    worker.on('exit', (code, signal) => {
      console.log(`Worker for ${accountId} exited with code ${code} and signal ${signal}`);
      this.handleWorkerExit(accountId);
    });
  }

  async stopAccount(accountId: string): Promise<void> {
    const worker = this.workers.get(accountId);
    if (worker) {
      // Graceful shutdown request
      worker.send({ type: 'CMD_STOP' });
      // We could add a timeout here to force kill if it doesn't shut down gracefully
    } else {
        const account = this.accounts.get(accountId);
        if(account) {
            account.status = 'offline';
            this.emitStatusChange(accountId, 'offline');
        }
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    await this.stopAccount(accountId);
    this.accounts.delete(accountId);
    this.workers.delete(accountId);
    this.saveAccounts();
  }

  getAccountList(): IAccountInfo[] {
    return Array.from(this.accounts.values());
  }

  stopAllAccounts() {
      for (const accountId of this.workers.keys()) {
          this.stopAccount(accountId);
      }
  }

  private handleIpcMessage(accountId: string, message: any) {
    console.log(`[Main] Received from Worker [${accountId}]:`, message);
    if (message.type === 'STATUS_UPDATE') {
      if (message.payload.status === 'ai-log') {
        this.emit('ai-log', accountId, message.payload.log);
      } else if (message.payload.status === 'qr-code') {
        this.emit('qr-code', accountId, message.payload.data);
      } else {
        const account = this.accounts.get(accountId);
        if (account) {
          account.status = message.payload.status;
          this.emitStatusChange(accountId, account.status);
        }
      }
    }
  }

  private handleWorkerExit(accountId: string) {
    this.workers.delete(accountId);
    const account = this.accounts.get(accountId);
    if (account) {
      account.status = 'offline';
      this.emitStatusChange(accountId, 'offline');
    }
  }

  private emitStatusChange(accountId: string, status: AccountStatus) {
    this.emit('account-status-changed', accountId, status);
  }
}
