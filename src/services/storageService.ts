interface ElectronWindow extends Window {
  require?: (module: string) => {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  };
}

const win = typeof window !== 'undefined' ? (window as unknown as ElectronWindow) : null;
const electron = win && win.require ? win.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export interface StorageSettings {
  storagePath: string;
}

export interface StorageStats {
  totalBills: number;
  totalImages: number;
  dbSizeBytes: number;
  backupSizeBytes: number;
  dbPath: string;
  backupPath: string;
}

class StorageService {
  isElectron(): boolean {
    return ipcRenderer !== null;
  }

  async getStorageSettings(): Promise<StorageSettings> {
    if (!this.isElectron()) {
      return { storagePath: localStorage.getItem('pos_storage_path') || 'Local Browser Storage' };
    }
    return (ipcRenderer!).invoke('get-storage-settings') as Promise<StorageSettings>;
  }

  async saveStorageSettings(settings: StorageSettings): Promise<boolean> {
    if (!this.isElectron()) {
      localStorage.setItem('pos_storage_path', settings.storagePath);
      return true;
    }
    return (ipcRenderer!).invoke('save-storage-settings', settings) as Promise<boolean>;
  }

  async resetStorageSettings(): Promise<boolean> {
    if (!this.isElectron()) {
      localStorage.removeItem('pos_storage_path');
      return true;
    }
    return (ipcRenderer!).invoke('reset-storage-settings') as Promise<boolean>;
  }

  async selectStorageFolder(): Promise<string | null> {
    if (!this.isElectron()) {
      return null;
    }
    return (ipcRenderer!).invoke('select-storage-folder') as Promise<string | null>;
  }

  async ensureStorageFolders(customPath?: string): Promise<boolean> {
    if (!this.isElectron()) {
      return true;
    }
    return (ipcRenderer!).invoke('ensure-storage-folders', customPath) as Promise<boolean>;
  }

  async checkStorageFolderExists(customPath?: string): Promise<boolean> {
    if (!this.isElectron()) {
      return true;
    }
    return (ipcRenderer!).invoke('check-storage-folder-exists', customPath) as Promise<boolean>;
  }

  async saveBillImage(billNumber: string, createdAt: Date | string, base64Image: string): Promise<string> {
    if (!this.isElectron()) {
      return 'browser_storage';
    }
    return (ipcRenderer!).invoke('save-bill-image', { billNumber, createdAt, base64Image }) as Promise<string>;
  }

  async readBillImage(filePath: string): Promise<string | null> {
    if (!this.isElectron()) {
      return null;
    }
    return (ipcRenderer!).invoke('read-bill-image', filePath) as Promise<string | null>;
  }

  async deleteBillImage(filePath: string): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }
    return (ipcRenderer!).invoke('delete-bill-image', filePath) as Promise<boolean>;
  }

  async backupDatabase(): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Database backup is only available in Desktop mode.');
    }
    return (ipcRenderer!).invoke('backup-database') as Promise<string>;
  }

  async openStorageFolder(): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }
    return (ipcRenderer!).invoke('open-storage-folder') as Promise<boolean>;
  }

  async getStorageStats(): Promise<StorageStats> {
    if (!this.isElectron()) {
      return {
        totalBills: 0,
        totalImages: 0,
        dbSizeBytes: 0,
        backupSizeBytes: 0,
        dbPath: 'N/A',
        backupPath: 'N/A',
      };
    }
    return (ipcRenderer!).invoke('get-storage-stats') as Promise<StorageStats>;
  }

  async restoreDatabase(backupFilePath: string): Promise<boolean> {
    if (!this.isElectron()) {
      throw new Error('Database restore is only available in Desktop mode.');
    }
    return (ipcRenderer!).invoke('restore-database', backupFilePath) as Promise<boolean>;
  }

  async selectBackupFile(): Promise<string | null> {
    if (!this.isElectron()) {
      return null;
    }
    return (ipcRenderer!).invoke('select-backup-file') as Promise<string | null>;
  }

  async formatStorageFolders(): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }
    return (ipcRenderer!).invoke('format-storage-folders') as Promise<boolean>;
  }
}

export default new StorageService();
