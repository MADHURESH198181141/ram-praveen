const { ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Dynamically require getSettings to avoid circular dependency
function getSettings() {
  return require('./settingsManager.cjs').getSettings();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStoragePath() {
  return getSettings().storagePath;
}

/** Resolve the live SQLite DB path: StoragePath/Database/billing.db, fallback to project root */
function resolveDbPath() {
  const storagePath = getStoragePath();
  if (storagePath) {
    const dbInStorage = path.join(storagePath, 'Database', 'billing.db');
    if (fs.existsSync(dbInStorage)) return dbInStorage;
  }
  // Fallback: project root (dev mode)
  const rootDb = path.join(__dirname, '..', 'retail_billing.db');
  if (fs.existsSync(rootDb)) return rootDb;
  // Packaged app resources
  const resourceDb = path.join(process.resourcesPath || __dirname, 'retail_billing.db');
  if (fs.existsSync(resourceDb)) return resourceDb;
  return null;
}

/** Recursively count files in a directory */
function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFilesRecursive(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

/** Recursively sum file sizes in a directory */
function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      try {
        total += fs.statSync(full).size;
      } catch (_) {}
    }
  }
  return total;
}

// Ensure storage folders are created
function ensureFolders(storagePath) {
  if (!storagePath) return;
  const folders = ['Bills', 'BillImages', 'Reports', 'Backups', 'Database', 'Logs'];
  folders.forEach(folder => {
    const folderPath = path.join(storagePath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('ensure-storage-folders', async (event, customPath) => {
  try {
    const storagePath = customPath || getStoragePath();
    if (!storagePath) return false;
    ensureFolders(storagePath);
    return true;
  } catch (err) {
    console.error('Error ensuring storage folders:', err);
    return false;
  }
});

ipcMain.handle('check-storage-folder-exists', async (event, customPath) => {
  try {
    const storagePath = customPath || getStoragePath();
    if (!storagePath) return false;
    return fs.existsSync(storagePath);
  } catch (err) {
    console.error('Error checking storage folder exists:', err);
    return false;
  }
});

ipcMain.handle('save-bill-image', async (event, { billNumber, createdAt, base64Image }) => {
  try {
    const storagePath = getStoragePath();
    if (!storagePath) throw new Error('Storage path not configured');

    const date = new Date(createdAt);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Create subfolder Bills/YYYY/MM/
    const billFolder = path.join(storagePath, 'Bills', year, month);
    if (!fs.existsSync(billFolder)) {
      fs.mkdirSync(billFolder, { recursive: true });
    }

    // Clean base64 image data
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, "");
    const fileName = `BILL_${billNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    const filePath = path.join(billFolder, fileName);

    fs.writeFileSync(filePath, base64Data, 'base64');
    return filePath;
  } catch (err) {
    console.error('Error saving bill image:', err);
    throw err;
  }
});

ipcMain.handle('read-bill-image', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      return `data:image/png;base64,${data.toString('base64')}`;
    }
    return null;
  } catch (err) {
    console.error('Error reading bill image:', err);
    return null;
  }
});

ipcMain.handle('delete-bill-image', async (event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted bill image:', filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error deleting bill image:', err);
    return false;
  }
});

ipcMain.handle('backup-database', async () => {
  try {
    const storagePath = getStoragePath();
    if (!storagePath) throw new Error('Storage path not configured');

    const dbToCopy = resolveDbPath();
    if (!dbToCopy) {
      throw new Error('SQLite database file not found. Please ensure the database exists.');
    }

    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    const backupFileName = `backup_${yyyy}${mm}${dd}_${hh}${min}${ss}.db`;

    const backupFolder = path.join(storagePath, 'Backups');
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    const destBackupPath = path.join(backupFolder, backupFileName);
    fs.copyFileSync(dbToCopy, destBackupPath);
    console.log('Database backed up to:', destBackupPath);
    return destBackupPath;
  } catch (err) {
    console.error('Error backing up database:', err);
    throw err;
  }
});

ipcMain.handle('open-storage-folder', async () => {
  try {
    const storagePath = getStoragePath();
    if (!storagePath) throw new Error('Storage path not configured');

    if (fs.existsSync(storagePath)) {
      await shell.openPath(storagePath);
      return true;
    } else {
      throw new Error('Storage folder does not exist');
    }
  } catch (err) {
    console.error('Error opening storage folder:', err);
    throw err;
  }
});

ipcMain.handle('get-storage-stats', async () => {
  try {
    const storagePath = getStoragePath();
    const billsDir = storagePath ? path.join(storagePath, 'Bills') : null;
    const backupsDir = storagePath ? path.join(storagePath, 'Backups') : null;
    const dbPath = resolveDbPath();

    const totalBills = billsDir ? countFilesRecursive(billsDir) : 0;
    // Images = PNG/JPEG files in Bills folder
    const totalImages = totalBills; // each bill image = 1 file
    const dbSizeBytes = dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const backupSizeBytes = backupsDir ? dirSizeBytes(backupsDir) : 0;

    return {
      totalBills,
      totalImages,
      dbSizeBytes,
      backupSizeBytes,
      dbPath: dbPath || 'Not found',
      backupPath: backupsDir || 'Not configured',
    };
  } catch (err) {
    console.error('Error getting storage stats:', err);
    return {
      totalBills: 0,
      totalImages: 0,
      dbSizeBytes: 0,
      backupSizeBytes: 0,
      dbPath: 'Error',
      backupPath: 'Error',
    };
  }
});

ipcMain.handle('select-backup-file', async (event) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  } catch (err) {
    console.error('Error selecting backup file:', err);
    return null;
  }
});

ipcMain.handle('restore-database', async (event, backupFilePath) => {
  try {
    if (!backupFilePath || !fs.existsSync(backupFilePath)) {
      throw new Error('Backup file not found: ' + backupFilePath);
    }
    const dbPath = resolveDbPath();
    if (!dbPath) throw new Error('Cannot determine live database path');

    // Make a safety backup before overwriting
    const safetyBackup = dbPath + '.pre-restore.' + Date.now();
    fs.copyFileSync(dbPath, safetyBackup);
    console.log('Safety backup created at:', safetyBackup);

    fs.copyFileSync(backupFilePath, dbPath);
    console.log('Database restored from:', backupFilePath, '->', dbPath);
    return true;
  } catch (err) {
    console.error('Error restoring database:', err);
    throw err;
  }
});

ipcMain.handle('format-storage-folders', async () => {
  try {
    const storagePath = getStoragePath();
    if (!storagePath) return false;

    const foldersToWipe = ['Bills', 'BillImages', 'Reports', 'Logs'];
    for (const folder of foldersToWipe) {
      const folderPath = path.join(storagePath, folder);
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
      fs.mkdirSync(folderPath, { recursive: true });
    }
    console.log('Storage folders wiped and recreated.');
    return true;
  } catch (err) {
    console.error('Error formatting storage folders:', err);
    return false;
  }
});

module.exports = {
  ensureFolders
};
