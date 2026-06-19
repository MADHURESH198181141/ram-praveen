/**
 * Sync service for managing offline-online data synchronization.
 * Handles local SQLite database and cloud PostgreSQL sync.
 */

import { apiRequest } from './api';

export interface SyncItem {
  id?: string;
  entity_type: 'bill' | 'payment' | 'customer' | 'product';
  entity_id: string;
  data: any;
  timestamp?: number;
  synced?: boolean;
}

class SyncService {
  private dbName = 'retail_billing_local';
  private storeName = 'sync_queue';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB for offline storage
   */
  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { autoIncrement: true });
        }
      };
    });
  }

  /**
   * Add item to sync queue (for offline storage)
   */
  async addToQueue(item: SyncItem): Promise<void> {
    const db = this.db || (await this.initDB());
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.add({
        ...item,
        timestamp: Date.now(),
        synced: false,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all items in sync queue
   */
  async getQueue(): Promise<SyncItem[]> {
    const db = this.db || (await this.initDB());
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Remove item from sync queue after successful sync
   */
  async removeFromQueue(id: number): Promise<void> {
    const db = this.db || (await this.initDB());
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Sync queue with cloud database
   */
  async syncQueue(storeId: number): Promise<{ success: number; failed: number }> {
    try {
      const queue = await this.getQueue();
      let success = 0;
      let failed = 0;

      for (const item of queue) {
        try {
          // Send to backend for sync
          await apiRequest(
            'POST',
            '/api/sync/sync-item',
            item,
            { store_id: storeId }
          );
          
          success++;
          // Remove from queue after successful sync
          if (item.id) {
            await this.removeFromQueue(parseInt(item.id));
          }
        } catch (error) {
          console.error(`Failed to sync ${item.entity_type}:`, error);
          failed++;
        }
      }

      return { success, failed };
    } catch (error) {
      console.error('Sync queue error:', error);
      throw error;
    }
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Setup online/offline listeners
   */
  setupListeners(onSyncReady?: () => void): void {
    window.addEventListener('online', async () => {
      console.log('Back online - syncing data...');
      if (onSyncReady) onSyncReady();
    });

    window.addEventListener('offline', () => {
      console.log('Offline - using local database');
    });
  }

  /**
   * Save bill to local storage for offline access
   */
  async saveBillLocally(bill: any): Promise<void> {
    await this.addToQueue({
      entity_type: 'bill',
      entity_id: bill.bill_id,
      data: bill,
    });
  }

  /**
   * Get local bills
   */
  async getLocalBills(): Promise<any[]> {
    const queue = await this.getQueue();
    return queue
      .filter((item) => item.entity_type === 'bill' && !item.synced)
      .map((item) => item.data);
  }

  /**
   * Clear all local data
   */
  async clearQueue(): Promise<void> {
    const db = this.db || (await this.initDB());
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export default new SyncService();
