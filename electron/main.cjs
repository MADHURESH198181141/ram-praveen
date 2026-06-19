const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Load settings and register IPC handlers
const { getSettings } = require('./settingsManager.cjs');
require('./folderPicker.cjs');
require('./storageManager.cjs');

let mainWindow;

function checkStorageOnStartup() {
  const settings = getSettings();
  const storagePath = settings.storagePath;
  if (!fs.existsSync(storagePath)) {
    setTimeout(() => {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Storage Folder Not Found',
        message: 'Storage folder not found. Please select a new storage location.',
        buttons: ['OK']
      });
    }, 1000);
  } else {
    const { ensureFolders } = require('./storageManager.cjs');
    ensureFolders(storagePath);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    title: 'Mano Innovation Club',
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false, // Show only when ready to avoid flash
    backgroundColor: '#0f172a',
  });

  // Show window gracefully after content is loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    checkStorageOnStartup();
  });

  // Open external links in the default browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
    if (linkUrl.startsWith('http:') || linkUrl.startsWith('https:')) {
      shell.openExternal(linkUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true,
      })
    );
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

