import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ConnectionStatus, SystemState } from '@/types';
import { getUnsyncedBills, getLastSyncTime, syncAllFromCloud } from '@/lib/storage';

interface SystemContextType extends SystemState {
  checkConnection: () => void;
  syncPendingData: () => Promise<void>;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systemState, setSystemState] = useState<SystemState>({
    connectionStatus: 'online',
    lastSyncTime: getLastSyncTime(),
    pendingSyncCount: getUnsyncedBills().length,
  });

  const checkConnection = useCallback(() => {
    const isOnline = navigator.onLine;
    setSystemState(prev => ({
      ...prev,
      connectionStatus: isOnline ? 'online' : 'offline',
      pendingSyncCount: getUnsyncedBills().length,
    }));
  }, []);

  const syncPendingData = useCallback(async () => {
    if (systemState.connectionStatus === 'offline') return;
    
    console.log('SystemContext: Triggering cloud data sync...');
    try {
      await syncAllFromCloud();
      
      setSystemState(prev => ({
        ...prev,
        lastSyncTime: getLastSyncTime(),
        pendingSyncCount: getUnsyncedBills().length,
      }));
    } catch (error) {
      console.error('SystemContext: Sync failed', error);
    }
  }, [systemState.connectionStatus]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSystemState(prev => ({
        ...prev,
        connectionStatus: 'online',
      }));
      // Auto-sync when coming back online
      syncPendingData();
    };

    const handleOffline = () => {
      setSystemState(prev => ({
        ...prev,
        connectionStatus: 'offline',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnection();

    // Periodic sync check (every 5 minutes)
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncPendingData();
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [checkConnection, syncPendingData]);

  // Update pending count when it changes
  useEffect(() => {
    const updatePendingCount = () => {
      setSystemState(prev => ({
        ...prev,
        pendingSyncCount: getUnsyncedBills().length,
      }));
    };

    // Check every 30 seconds
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const value: SystemContextType = {
    ...systemState,
    checkConnection,
    syncPendingData,
  };

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
