import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { EventEmitter } from 'events';
import { AccountStatus, IAccountInfo } from '../shared/types';

export class AccountCoordinator extends EventEmitter {
  private accounts: Map<string, IAccountInfo> = new Map();
  private workers: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
    // Initialize with some dummy data for the UI
    this.createAccount('account_8', '新用户直播间158');
    this.createAccount('account_9', '新用户直播间159');
    this.createAccount('account_0', '新用户直播间160');
  }

  createAccount(id: string, name: string) {
    const accountInfo: IAccountInfo = {
      id,
      name,
      status: 'offline',
      duration: 0,
      streamType: 'rtmp',
    };
    this.accounts.set(id, accountInfo);
    return accountInfo;
  }

  async startAccount(accountId: string, streamType: string = 'rtmp', streamConfig: any = null): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found.`);
    if (this.workers.has(accountId)) throw new Error(`Account ${accountId} is already running.`);

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
      const account = this.accounts.get(accountId);
      if (account) {
        account.status = message.payload.status;
        this.emitStatusChange(accountId, account.status);
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
