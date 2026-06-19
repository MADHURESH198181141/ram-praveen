import React, { useState, useEffect, useCallback } from 'react';
import { Database, FolderOpen, RefreshCw, HardDrive, ShieldCheck, AlertCircle, FileImage, FileBarChart, History, UploadCloud, BarChart2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import storageService from '@/services/storageService';

export default function StorageSettings() {
  const { toast } = useToast();
  const [storagePath, setStoragePath] = useState<string>('Loading...');
  const [folderExists, setFolderExists] = useState<boolean>(true);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [stats, setStats] = useState<{
    totalBills: number;
    totalImages: number;
    dbSizeBytes: number;
    backupSizeBytes: number;
    dbPath: string;
    backupPath: string;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load current settings
  const loadSettings = useCallback(async () => {
    try {
      const settings = await storageService.getStorageSettings();
      setStoragePath(settings.storagePath);
      const exists = await storageService.checkStorageFolderExists(settings.storagePath);
      setFolderExists(exists);
    } catch (err) {
      console.error('Failed to load storage settings:', err);
      toast({
        title: 'Error loading settings',
        description: 'Could not communicate with the desktop process.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const s = await storageService.getStorageStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, [loadSettings, loadStats]);

  // Handle Select Folder
  const handleChangeFolder = async () => {
    setIsChanging(true);
    try {
      const selectedFolder = await storageService.selectStorageFolder();
      if (selectedFolder) {
        const success = await storageService.saveStorageSettings({ storagePath: selectedFolder });
        if (success) {
          await storageService.ensureStorageFolders(selectedFolder);
          setStoragePath(selectedFolder);
          setFolderExists(true);
          toast({
            title: 'Storage Path Updated',
            description: `All data will now be stored in: ${selectedFolder}`,
          });
        } else {
          throw new Error('Failed to save settings');
        }
      }
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Folder selection failed',
        description: error.message || 'Could not select the folder.',
        variant: 'destructive',
      });
    } finally {
      setIsChanging(false);
    }
  };

  // Handle Reset to Default
  const handleResetDefault = async () => {
    try {
      const success = await storageService.resetStorageSettings();
      if (success) {
        const settings = await storageService.getStorageSettings();
        await storageService.ensureStorageFolders(settings.storagePath);
        setStoragePath(settings.storagePath);
        setFolderExists(true);
        toast({
          title: 'Reset Completed',
          description: 'Storage path has been reset to default Documents folder.',
        });
      }
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Reset failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Handle Open Folder
  const handleOpenFolder = async () => {
    try {
      await storageService.openStorageFolder();
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Could not open folder',
        description: error.message || 'Folder might not exist.',
        variant: 'destructive',
      });
    }
  };

  // Handle Backup Database
  const handleBackupDatabase = async () => {
    setIsBackingUp(true);
    try {
      const backupPath = await storageService.backupDatabase();
      toast({
        title: '✅ Database Backup Created',
        description: `Saved to: ${backupPath}`,
      });
      loadStats();
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Backup failed',
        description: error.message || 'Database could not be backed up.',
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle Restore Database
  const handleRestoreDatabase = async () => {
    if (!storageService.isElectron()) {
      toast({ title: 'Not available', description: 'Restore is only available in Desktop mode.', variant: 'destructive' });
      return;
    }
    try {
      const filePath = await storageService.selectBackupFile();
      if (!filePath) return;
      setIsRestoring(true);
      const success = await storageService.restoreDatabase(filePath);
      if (success) {
        toast({
          title: '✅ Database Restored',
          description: `Restored from: ${filePath}. Please restart the application to reload data.`,
        });
      } else {
        throw new Error('Restore returned false');
      }
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Restore failed',
        description: error.message || 'Could not restore the backup.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="h-6 w-6 text-primary" />
          Storage Settings
        </h1>
        <p className="text-muted-foreground">Manage where data, reports, backups, and invoices are saved on this PC</p>
      </div>

      {/* Warning Banner if folder is missing */}
      {!folderExists && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive-foreground">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Storage Folder Missing</div>
            <div className="text-xs opacity-90">The configured storage path does not exist. Please change the location or reset to defaults.</div>
          </div>
        </div>
      )}

      {/* Current Storage Path Card */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader>
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Storage Location Configuration</CardTitle>
              <CardDescription>All billing records and generated assets will reside in this folder</CardDescription>
            </div>
            <Badge variant={folderExists ? 'default' : 'destructive'} className={folderExists ? 'bg-success/15 text-success border-0' : ''}>
              {folderExists ? 'Folder Connected' : 'Offline / Disconnected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-xl border bg-muted/40 font-mono text-sm break-all flex items-center justify-between gap-3">
            <span className="text-slate-700 dark:text-slate-300 select-all">{storagePath}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleChangeFolder} disabled={isChanging} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Change Storage Location
            </Button>
            <Button variant="outline" onClick={handleOpenFolder} disabled={!folderExists} className="gap-2">
              <FolderOpen className="h-4 w-4 text-amber-500" />
              Open Storage Folder
            </Button>
            <Button variant="ghost" onClick={handleResetDefault} className="text-muted-foreground hover:text-destructive">
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Statistics Card */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Storage Statistics
            </CardTitle>
            <button
              onClick={loadStats}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              title="Refresh stats"
            >
              {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
          <CardDescription>Live metrics from your storage folder and database</CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-blue-500/5 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalBills.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Bill Images Saved</div>
              </div>
              <div className="p-4 rounded-xl border bg-violet-500/5 text-center">
                <div className="text-2xl font-bold text-violet-600">
                  {stats.dbSizeBytes < 1024 ? `${stats.dbSizeBytes} B`
                    : stats.dbSizeBytes < 1024 * 1024 ? `${(stats.dbSizeBytes / 1024).toFixed(1)} KB`
                    : `${(stats.dbSizeBytes / 1024 / 1024).toFixed(1)} MB`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Database Size</div>
              </div>
              <div className="p-4 rounded-xl border bg-amber-500/5 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {stats.backupSizeBytes < 1024 ? `${stats.backupSizeBytes} B`
                    : stats.backupSizeBytes < 1024 * 1024 ? `${(stats.backupSizeBytes / 1024).toFixed(1)} KB`
                    : `${(stats.backupSizeBytes / 1024 / 1024).toFixed(1)} MB`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Backup Size</div>
              </div>
              <div className="p-4 rounded-xl border bg-emerald-500/5 text-center">
                <div className="text-xs font-mono text-emerald-700 break-all">
                  {stats.dbPath !== 'Not found' ? '✅ Found' : '❌ Not found'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">DB Status</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {isLoadingStats ? 'Loading statistics...' : 'Statistics not available in browser mode.'}
            </div>
          )}
          {stats?.dbPath && stats.dbPath !== 'Not found' && (
            <div className="mt-3 text-xs font-mono text-muted-foreground/80 bg-muted/40 rounded px-3 py-2 break-all">
              DB: {stats.dbPath}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Backup Section */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            Database Backup &amp; Recovery
          </CardTitle>
          <CardDescription>Backup and restore the SQLite database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Backups are stored inside the <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Backups/</code> subfolder.
            Each backup filename is timestamped as <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">backup_YYYYMMDD_HHmmss.db</code>.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleBackupDatabase} disabled={isBackingUp || !folderExists} className="bg-success hover:bg-success/90 text-white gap-2">
              {isBackingUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Backup Database Now
            </Button>
            <Button onClick={handleRestoreDatabase} disabled={isRestoring} variant="outline" className="gap-2">
              {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Restore from Backup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Restoring will overwrite the current database. A safety backup is automatically created before restore.
          </p>
        </CardContent>
      </Card>

      {/* Storage Information Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-violet-500" />
            Folder Structure Overview
          </CardTitle>
          <CardDescription>Below is the subfolder structure automatically generated in your storage path</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Bills & BillImages</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Invoices saved as PNG screenshots. Structured in daily/monthly folders for easy retrieval.</p>
                <div className="text-[10px] font-mono text-muted-foreground/80 mt-1.5">/Bills/YYYY/MM/*.png</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 bg-violet-500/10 text-violet-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Database (SQLite)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Core relational SQLite database file where products, transactions, and settings are stored locally.</p>
                <div className="text-[10px] font-mono text-muted-foreground/80 mt-1.5">/Database/billing.db</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileBarChart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Reports</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tax and billing reports exported to PDF/Excel files for business bookkeeping.</p>
                <div className="text-[10px] font-mono text-muted-foreground/80 mt-1.5">/Reports/*.pdf</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Backups & Logs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">System activity logs and date-stamped backup databases to protect against PC failures.</p>
                <div className="text-[10px] font-mono text-muted-foreground/80 mt-1.5">/Backups/*.db  |  /Logs/*.log</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
