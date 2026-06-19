// Realtime Sync Manager — Supabase two-way live synchronization
// Subscribes to INSERT / UPDATE / DELETE events on all key tables and
// keeps localStorage in sync with the cloud automatically.

import { supabase } from '@/lib/supabase';

// ─── Internal helpers ────────────────────────────────────────────────────────

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Realtime sync storage error:', error);
  }
}

function emitUpdate(table: string) {
  window.dispatchEvent(new CustomEvent('storage-updated', { detail: { table } }));
}

// ─── Table → localStorage key mapping ────────────────────────────────────────

const TABLE_KEY_MAP: Record<string, string> = {
  bills: 'pos_bills',
  customers: 'pos_customers',
  products: 'pos_products',
  categories: 'pos_categories',
  users: 'pos_users',
  payments: 'pos_payments',
  pending_dues: 'pos_pending_dues',
  purchase_vouchers: 'pos_purchase_vouchers',
  stock_ledger: 'pos_stock_ledger',
  employee_tasks: 'pos_employee_tasks',
  attendance: 'pos_attendance',
  suppliers: 'pos_suppliers',
};

// ─── Handle a realtime event for a given table ────────────────────────────────

function handleRealtimeEvent(
  table: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  newRecord: Record<string, unknown> | null,
  oldRecord: Record<string, unknown> | null
) {
  const storageKey = TABLE_KEY_MAP[table];
  if (!storageKey) return;

  const records = getItem<Record<string, unknown>[]>(storageKey, []);

  if (eventType === 'DELETE') {
    const id = oldRecord?.id as string | undefined;
    if (!id) return;
    const filtered = records.filter((r) => r.id !== id);
    setItem(storageKey, filtered);
    console.log(`[Realtime] DELETE ${table}#${id}`);
  } else if (eventType === 'INSERT') {
    if (!newRecord) return;
    // Only add if not already present locally
    const exists = records.some((r) => r.id === newRecord.id);
    if (!exists) {
      records.push(newRecord);
      setItem(storageKey, records);
      console.log(`[Realtime] INSERT ${table}#${newRecord.id}`);
    }
  } else if (eventType === 'UPDATE') {
    if (!newRecord) return;
    const idx = records.findIndex((r) => r.id === newRecord.id);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...newRecord };
    } else {
      records.push(newRecord);
    }
    setItem(storageKey, records);
    console.log(`[Realtime] UPDATE ${table}#${newRecord.id}`);
  }

  emitUpdate(table);
}

// ─── Channel storage ──────────────────────────────────────────────────────────

let activeChannel: ReturnType<typeof supabase.channel> | null = null;

// ─── Start realtime subscriptions ────────────────────────────────────────────

export function startRealtimeSync(): void {
  if (activeChannel) return; // already running

  const tables = Object.keys(TABLE_KEY_MAP);

  activeChannel = supabase.channel('pos-realtime-all');

  tables.forEach((table) => {
    activeChannel!
      .on(
        // @ts-ignore — Supabase types require explicit table generic
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          handleRealtimeEvent(
            table,
            payload.eventType,
            payload.new ?? null,
            payload.old ?? null
          );
        }
      );
  });

  activeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] Connected — watching all tables');
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      console.warn('[Realtime] Connection closed or errored:', status);
    }
  });
}

// ─── Stop realtime subscriptions ─────────────────────────────────────────────

export function stopRealtimeSync(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    console.log('[Realtime] Disconnected');
  }
}
