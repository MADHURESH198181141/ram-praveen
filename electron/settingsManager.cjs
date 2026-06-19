const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'settings.json');
};

const getDefaultStoragePath = () => {
  return path.join(app.getPath('documents'), 'RetailBillingBuddy');
};

function getSettings() {
  const settingsPath = getSettingsPath();
  const defaultPath = getDefaultStoragePath();
  const defaultSettings = {
    storagePath: defaultPath
  };

  if (!fs.existsSync(settingsPath)) {
    try {
      // Ensure directory exists
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
      return defaultSettings;
    } catch (err) {
      console.error('Error writing default settings:', err);
      return defaultSettings;
    }
  }

  try {
    const data = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.storagePath) {
      parsed.storagePath = defaultPath;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading settings:', err);
    return defaultSettings;
  }
}

function updateEnvFile(filePath, sqliteDbPath) {
  const normalizedPath = sqliteDbPath.replace(/\\/g, '/');
  const dbUrl = `sqlite:///${normalizedPath}`;
  
  if (!fs.existsSync(filePath)) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, `DATABASE_URL=${dbUrl}\n`, 'utf8');
      return;
    } catch (err) {
      console.error(`Error creating env file ${filePath}:`, err);
      return;
    }
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${dbUrl}`);
    } else {
      content += `\nDATABASE_URL=${dbUrl}\n`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    console.error(`Error updating env file ${filePath}:`, err);
  }
}

function saveSettings(settings) {
  const settingsPath = getSettingsPath();
  const oldSettings = getSettings();
  const newStoragePath = settings.storagePath;

  // 1. Ensure folders are created at the new path
  const { ensureFolders } = require('./storageManager.cjs');
  ensureFolders(newStoragePath);

  // 2. Copy database file if it exists at old path but not at new path
  const oldDbPath = oldSettings.storagePath ? path.join(oldSettings.storagePath, 'Database', 'billing.db') : null;
  const newDbPath = path.join(newStoragePath, 'Database', 'billing.db');

  try {
    if (!fs.existsSync(newDbPath)) {
      if (oldDbPath && fs.existsSync(oldDbPath)) {
        console.log(`Migrating database from ${oldDbPath} to ${newDbPath}`);
        fs.copyFileSync(oldDbPath, newDbPath);
      } else {
        // Fallback: check if retail_billing.db exists in project root, copy it as initial db
        const rootDbPath = path.join(__dirname, '../retail_billing.db');
        if (fs.existsSync(rootDbPath)) {
          console.log(`Copying initial database from ${rootDbPath} to ${newDbPath}`);
          fs.copyFileSync(rootDbPath, newDbPath);
        }
      }
    }
  } catch (dbErr) {
    console.error('Warning: Database copy/migration failed:', dbErr);
  }

  // 3. Write settings.json
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

  // 4. Update env files (only in unpackaged development environment)
  if (!app.isPackaged) {
    const rootEnvPath = path.join(__dirname, '../.env.local');
    const backendEnvPath = path.join(__dirname, '../backend/.env.local');
    updateEnvFile(rootEnvPath, newDbPath);
    updateEnvFile(backendEnvPath, newDbPath);
  }

  return true;
}

// Register IPC handlers
ipcMain.handle('get-storage-settings', async () => {
  return getSettings();
});

ipcMain.handle('save-storage-settings', async (event, settings) => {
  try {
    return saveSettings(settings);
  } catch (err) {
    console.error('Error in save-storage-settings handler:', err);
    throw new Error(err.message || String(err));
  }
});

ipcMain.handle('reset-storage-settings', async () => {
  const defaultSettings = {
    storagePath: getDefaultStoragePath()
  };
  try {
    return saveSettings(defaultSettings);
  } catch (err) {
    console.error('Error in reset-storage-settings handler:', err);
    throw new Error(err.message || String(err));
  }
});

module.exports = {
  getSettings,
  saveSettings,
  getDefaultStoragePath
};
