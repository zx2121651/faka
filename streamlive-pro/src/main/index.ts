import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { AccountCoordinator } from './AccountCoordinator';
import { ResourceManager } from './ResourceManager';
import { SystemMonitor } from './SystemMonitor';

let mainWindow: BrowserWindow | null = null;
const coordinator = new AccountCoordinator();
const resourceManager = new ResourceManager();
const systemMonitor = new SystemMonitor();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simplicity in prototyping. In production, use a preload script and contextIsolation: true.
    },
    title: 'StreamLive Pro',
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  const statsListener = (stats: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-stats-update', stats);
    }
  };

  systemMonitor.on('stats-updated', statsListener);

  mainWindow.on('closed', () => {
    mainWindow = null;
    coordinator.stopAllAccounts();
    systemMonitor.stop();
    systemMonitor.removeListener('stats-updated', statsListener);
  });

  systemMonitor.start();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Setup IPC Listeners
ipcMain.handle('get-accounts', () => {
  return coordinator.getAccountList();
});

ipcMain.handle('add-account', (event, name: string) => {
  const id = `acc_${Date.now()}`;
  return coordinator.createAccount(id, name);
});

ipcMain.handle('start-account', async (event, accountId: string, streamType: string, streamConfig: any) => {
  try {
    await coordinator.startAccount(accountId, streamType, streamConfig);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-account', async (event, accountId: string) => {
  try {
    await coordinator.stopAccount(accountId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-account', async (event, accountId: string) => {
  try {
    await coordinator.removeAccount(accountId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择本地推流视频',
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'flv', 'mkv', 'avi', 'mov'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Route updates from coordinator to the renderer
coordinator.on('account-status-changed', (accountId, status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('account-status-changed', { accountId, status });
    }
});

coordinator.on('ai-log', (accountId, log) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-log', { accountId, log });
    }
});

coordinator.on('qr-code', (accountId, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('qr-code', { accountId, data });
    }
});
