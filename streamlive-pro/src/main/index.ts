import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AccountCoordinator } from './AccountCoordinator';
import { ResourceManager } from './ResourceManager';

let mainWindow: BrowserWindow | null = null;
const coordinator = new AccountCoordinator();
const resourceManager = new ResourceManager();

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

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    coordinator.stopAllAccounts();
  });
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

ipcMain.handle('start-account', async (event, accountId: string, streamType: string) => {
  try {
    await coordinator.startAccount(accountId, streamType);
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

// Route updates from coordinator to the renderer
coordinator.on('account-status-changed', (accountId, status) => {
    if (mainWindow) {
        mainWindow.webContents.send('account-status-changed', { accountId, status });
    }
});
