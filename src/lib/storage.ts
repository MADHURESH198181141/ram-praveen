// Local Storage Manager - Handles offline data persistence
import storageService from '@/services/storageService';
import { supabase } from '@/lib/supabase';

import { Bill, BillItem, Customer, Product, Category, User, PendingDue, Payment, PurchaseVoucher, PurchaseVoucherItem, Supplier, StockLedgerEntry, EmployeeTask, EmployeePerformance, AttendanceRecord, DailySalesReport, RecycleBinItem, RecycleBinEntityType } from '@/types';

const STORAGE_KEYS = {
  BILLS: 'pos_bills',
  CUSTOMERS: 'pos_customers',
  PRODUCTS: 'pos_products',
  CATEGORIES: 'pos_categories',
  USERS: 'pos_users',
  PENDING_DUES: 'pos_pending_dues',
  PAYMENTS: 'pos_payments',
  SETTINGS: 'pos_settings',
  LAST_SYNC: 'pos_last_sync',
  BILL_COUNTER: 'pos_bill_counter',
  DRAFT_BILL: 'pos_draft_bill',
  PURCHASE_VOUCHERS: 'pos_purchase_vouchers',
  VOUCHER_COUNTER: 'pos_voucher_counter',
  SUPPLIERS: 'pos_suppliers',
  SUPPLIER_COUNTER: 'pos_supplier_counter',
  STOCK_LEDGER: 'pos_stock_ledger',
  EMPLOYEE_TASKS: 'pos_employee_tasks',
  ATTENDANCE: 'pos_attendance',
  PASSWORDS: 'pos_passwords',
  SALES_REPORTS: 'pos_sales_reports',
  RECYCLE_BIN: 'pos_recycle_bin',
} as const;

// Generic storage functions
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
    console.error('Storage error:', error);
  }
}

const AUTH_STORAGE_KEY = 'pos_auth_state';
function getCurrentUser(): User | null {
  try {
     const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
     return auth?.user || null;
  } catch { return null; }
}

// ─── Password Management ──────────────────────────────────────────────────────
// Simple non-cryptographic hash for localStorage (not for production auth)
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function getUserPassword(userId: string): string | null {
  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
  return passwords[userId] || null;
}

export function setUserPassword(userId: string, plainPassword: string): void {
  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
  passwords[userId] = simpleHash(plainPassword);
  setItem(STORAGE_KEYS.PASSWORDS, passwords);
}

export function verifyUserPassword(userId: string, plainPassword: string, fallback?: string): boolean {
  const stored = getUserPassword(userId);
  if (!stored) {
    // No password set yet — fall back to the demo default
    return fallback !== undefined ? plainPassword === fallback : false;
  }
  return stored === simpleHash(plainPassword);
}

// Bills
export function getBills(): Bill[] {
  return getItem<Bill[]>(STORAGE_KEYS.BILLS, []);
}

// Helper: serialize a Bill for Supabase upsert (convert Date objects to ISO strings)
function serializeBillForCloud(bill: Bill): Record<string, unknown> {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    customerId: bill.customerId,
    customerName: bill.customerName,
    customerNameTamil: bill.customerNameTamil,
    customerPhone: bill.customerPhone,
    isNewCustomer: bill.isNewCustomer,
    items: bill.items,
    pages: bill.pages,
    subtotal: bill.subtotal,
    discount: bill.discount,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    pendingAmount: bill.pendingAmount,
    paymentMethod: bill.paymentMethod,
    status: bill.status,
    employeeId: bill.employeeId,
    employeeName: bill.employeeName,
    employeeBarcode: bill.employeeBarcode,
    dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString() : null,
    isDelivery: bill.isDelivery,
    upiQrData: bill.upiQrData,
    createdAt: bill.createdAt ? new Date(bill.createdAt).toISOString() : new Date().toISOString(),
    syncedToCloud: true,
    isOfflineBill: bill.isOfflineBill,
    billImageBase64: bill.billImageBase64 ?? null,
  };
}

export function saveBill(bill: Bill): void {
  const bills = getBills();
  const products = getProducts();
  const ledger = getStockLedger();

  // Deduct stock and create ledger entries
  bill.items.forEach(item => {
    const productIndex = products.findIndex(p => p.id === item.productId);
    if (productIndex >= 0) {
      const product = products[productIndex];
      product.stockQuantity = (product.stockQuantity || 0) - item.quantity;
      product.stock = product.stockQuantity;
      product.updatedAt = new Date();

      // Create ledger entry
      const entry: StockLedgerEntry = {
        id: `sle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        type: 'SALE',
        quantity: -item.quantity,
        referenceId: bill.id,
        date: new Date()
      };
      ledger.push(entry);
    }
  });

  const existingIndex = bills.findIndex(b => b.id === bill.id);
  if (existingIndex >= 0) {
    bills[existingIndex] = bill;
  } else {
    bills.push(bill);
  }

  setItem(STORAGE_KEYS.BILLS, bills);
  setItem(STORAGE_KEYS.PRODUCTS, products);
  setItem(STORAGE_KEYS.STOCK_LEDGER, ledger);

  // Save bill image locally in desktop mode, then sync to Supabase
  if (bill.billImageBase64 && bill.billImageBase64.startsWith('data:image/png;base64,')) {
    storageService.saveBillImage(bill.billNumber, bill.createdAt, bill.billImageBase64)
      .then(filePath => {
        console.log('Bill image saved locally at:', filePath);
        // Store path and remove base64 from localStorage to save space
        const currentBills = getBills();
        const idx = currentBills.findIndex(b => b.id === bill.id);
        if (idx >= 0) {
          currentBills[idx].billImagePath = filePath;
          currentBills[idx].billImageBase64 = undefined;
          currentBills[idx].syncedToCloud = true;
          setItem(STORAGE_KEYS.BILLS, currentBills);
        }
        // Sync bill to Supabase (without heavy base64 image)
        const billForCloud = serializeBillForCloud({ ...bill, billImageBase64: undefined });
        supabase.from('bills').upsert([billForCloud], { onConflict: 'id' }).then(({ error }) => {
          if (error) console.error('Failed to sync bill to cloud:', error);
          else console.log('Bill synced to cloud:', bill.billNumber);
        });
      })
      .catch(err => {
        console.error('Failed to save bill image locally:', err);
      });
  } else {
    // Sync bill to Supabase in background
    const billForCloud = serializeBillForCloud(bill);
    supabase.from('bills').upsert([billForCloud], { onConflict: 'id' }).then(({ error }) => {
      if (error) {
        console.error('Failed to sync bill to cloud:', error);
        // Mark as not synced so it can be retried later
        const updatedBills = getBills().map(b =>
          b.id === bill.id ? { ...b, syncedToCloud: false } : b
        );
        setItem(STORAGE_KEYS.BILLS, updatedBills);
      } else {
        console.log('Bill synced to cloud:', bill.billNumber);
        const updatedBills = getBills().map(b =>
          b.id === bill.id ? { ...b, syncedToCloud: true } : b
        );
        setItem(STORAGE_KEYS.BILLS, updatedBills);
      }
    });
  }
}

export async function syncBillsFromCloud(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return; // Don't sync if no one is logged in

  let query = supabase.from('bills').select('*');

  // If employee, only get their own bills
  if (user.role === 'employee') {
    query = query.eq('employeeId', user.id);
  }

  const { data, error } = await query;

  if (data && !error) {
    const localBills = getBills();
    // Build a map from local bills keyed by id
    const billMap = new Map(localBills.map(b => [b.id, b]));
    // Merge in remote bills (remote wins for syncedToCloud status)
    data.forEach(remoteBill => {
      billMap.set(remoteBill.id, { ...remoteBill, syncedToCloud: true });
    });
    setItem(STORAGE_KEYS.BILLS, Array.from(billMap.values()));
  } else if (error) {
    console.error('Error fetching bills from cloud:', error);
  }
}


export function getNextBillNumber(): string {
  const counter = getItem<number>(STORAGE_KEYS.BILL_COUNTER, 0) + 1;
  setItem(STORAGE_KEYS.BILL_COUNTER, counter);
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `INV-${dateStr}-${String(counter).padStart(4, '0')}`;
}

export function peekNextBillNumber(): string {
  const counter = getItem<number>(STORAGE_KEYS.BILL_COUNTER, 0) + 1;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `INV-${dateStr}-${String(counter).padStart(4, '0')}`;
}

// Customers
export function getCustomers(): Customer[] {
  return getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
}

export function saveCustomer(customer: Customer): void {
  const customers = getCustomers();
  const existingIndex = customers.findIndex(c => c.id === customer.id);
  if (existingIndex >= 0) {
    customers[existingIndex] = customer;
  } else {
    customers.push(customer);
  }
  setItem(STORAGE_KEYS.CUSTOMERS, customers);

  // Background Cloud Sync for Customers
  supabase.from('customers').upsert([customer], { onConflict: 'id' }).then(({ error }) => {
    if (error) {
      console.error('Failed to sync customer to cloud:', error);
    } else {
      console.log('Customer synced to cloud:', customer.name);
    }
  });
}

export async function syncCustomersFromCloud(): Promise<void> {
  const { data, error } = await supabase.from('customers').select('*');
  if (data && !error) {
    const localCustomers = getCustomers();
    const customerMap = new Map(localCustomers.map(c => [c.id, c]));
    data.forEach(remoteCustomer => {
      customerMap.set(remoteCustomer.id, remoteCustomer);
    });
    setItem(STORAGE_KEYS.CUSTOMERS, Array.from(customerMap.values()));
  } else if (error) {
    console.error('Error fetching customers from cloud:', error);
  }
}

export function findCustomerByPhone(phone: string): Customer | undefined {
  return getCustomers().find(c => c.phone === phone);
}

// Products
export function getProducts(): Product[] {
  return getItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
}

export function saveProduct(product: Product): void {
  const products = getProducts();
  const existingIndex = products.findIndex(p => p.id === product.id);
  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products.push(product);
  }
  setItem(STORAGE_KEYS.PRODUCTS, products);

  // Background Cloud Sync
  const cloudProduct = {
    ...product,
    lastPurchaseDate: product.lastPurchaseDate ? new Date(product.lastPurchaseDate).toISOString() : null,
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  supabase.from('products').upsert([cloudProduct], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync product to cloud:', error);
  });
}

export function saveProducts(newProducts: Product[]): void {
  const products = getProducts();
  const productMap = new Map(products.map(p => [p.id, p]));
  
  newProducts.forEach(np => {
    productMap.set(np.id, np);
  });
  
  setItem(STORAGE_KEYS.PRODUCTS, Array.from(productMap.values()));

  // Background Cloud Sync
  const cloudProducts = newProducts.map(p => ({
    ...p,
    lastPurchaseDate: p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toISOString() : null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  supabase.from('products').upsert(cloudProducts, { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync products to cloud:', error);
  });
}

export function deleteProduct(productId: string): void {
  const products = getProducts().filter(p => p.id !== productId);
  setItem(STORAGE_KEYS.PRODUCTS, products);

  // Background Cloud Sync
  supabase.from('products').delete().eq('id', productId).then(({ error }) => {
    if (error) console.error('Failed to delete product from cloud:', error);
  });
}

// Categories
export function getCategories(): Category[] {
  return getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
}

export function saveCategory(category: Category): void {
  const categories = getCategories();
  const existingIndex = categories.findIndex(c => c.id === category.id);
  if (existingIndex >= 0) {
    categories[existingIndex] = category;
  } else {
    categories.push(category);
  }
  setItem(STORAGE_KEYS.CATEGORIES, categories);

  // Background Cloud Sync
  supabase.from('categories').upsert([category], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync category to cloud:', error);
  });
}

// Users
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.USERS, []);
}

export function saveUser(user: User): void {
  const users = getUsers();
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  setItem(STORAGE_KEYS.USERS, users);

  // Background Cloud Sync (includes password_hash if set)
  const cloudUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    barcode: user.barcode,
    phone: user.phone,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    isActive: user.isActive,
    password_hash: getUserPassword(user.id)
  };
  supabase.from('users').upsert([cloudUser], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync user to cloud:', error);
  });
}

// Pending Dues
export function getPendingDues(): PendingDue[] {
  return getItem<PendingDue[]>(STORAGE_KEYS.PENDING_DUES, []);
}

export function savePendingDue(due: PendingDue): void {
  const dues = getPendingDues();
  const existingIndex = dues.findIndex(d => d.id === due.id);
  if (existingIndex >= 0) {
    dues[existingIndex] = due;
  } else {
    dues.push(due);
  }
  setItem(STORAGE_KEYS.PENDING_DUES, dues);
}

export function clearPendingDue(dueId: string): void {
  const dues = getPendingDues().filter(d => d.id !== dueId);
  setItem(STORAGE_KEYS.PENDING_DUES, dues);
}

// Payments
export function getPayments(): Payment[] {
  return getItem<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
}

export function savePayment(payment: Payment): void {
  const payments = getPayments();
  payments.push(payment);
  setItem(STORAGE_KEYS.PAYMENTS, payments);

  // Background Cloud Sync
  const cloudPayment = {
    ...payment,
    createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString()
  };
  supabase.from('payments').upsert([cloudPayment], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync payment to cloud:', error);
  });
}

// Purchase Vouchers
export function getPurchaseVouchers(): PurchaseVoucher[] {
  const vouchers = getItem<PurchaseVoucher[]>(STORAGE_KEYS.PURCHASE_VOUCHERS, []);
  // Ensure dates are actual Date objects
  return vouchers.map(v => ({
    ...v,
    date: new Date(v.date),
    createdAt: new Date(v.createdAt),
    updatedAt: new Date(v.updatedAt)
  }));
}

export function getNextVoucherNumber(): string {
  const counter = getItem<number>(STORAGE_KEYS.VOUCHER_COUNTER, 0) + 1;
  setItem(STORAGE_KEYS.VOUCHER_COUNTER, counter);
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `PV-${dateStr}-${String(counter).padStart(4, '0')}`;
}

export function savePurchaseVoucher(voucher: PurchaseVoucher): void {
  const vouchers = getPurchaseVouchers();
  const products = getProducts();
  const ledger = getStockLedger();
  const existingVoucherIndex = vouchers.findIndex(v => v.id === voucher.id);
  const oldVoucher = existingVoucherIndex >= 0 ? vouchers[existingVoucherIndex] : null;

  // 1. Reverse old stock updates and ledger entries if editing
  if (oldVoucher) {
    oldVoucher.items.forEach(oldItem => {
      const productIndex = products.findIndex(p => p.id === oldItem.productId);
      if (productIndex >= 0) {
        const product = products[productIndex];
        // Reverse stock increase
        product.stockQuantity = (product.stockQuantity || 0) - oldItem.quantityInSku;
        product.stock = product.stockQuantity;
      }
    });
    // Remove old ledger entries for this voucher
    const filteredLedger = ledger.filter(entry => entry.referenceId !== voucher.id);
    ledger.length = 0;
    ledger.push(...filteredLedger);
  }

  // 2. Apply new stock updates, auto-create products, and weighted average cost
  voucher.items.forEach(newItem => {
    let productIndex = products.findIndex(p => p.id === newItem.productId);

    // Auto-create product if it doesn't exist
    if (productIndex < 0 && newItem.productName) {
      // Check for name match (case-insensitive) to avoid duplicates
      const nameMatchIndex = products.findIndex(p => p.name.toLowerCase() === newItem.productName.toLowerCase());
      if (nameMatchIndex >= 0) {
        productIndex = nameMatchIndex;
        newItem.productId = products[productIndex].id; // Update item with existing ID
      } else {
        const newProduct: Product = {
          id: newItem.productId || `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: newItem.productName,
          category: newItem.category || 'Uncategorized',
          price: newItem.unitRate * 1.2, // Default 20% markup
          minPrice: newItem.unitRate,
          maxPrice: newItem.unitRate * 1.5,
          unit: newItem.uom || 'Nos',
          uom: newItem.uom || 'Nos',
          sku: newItem.sku || `SKU-${Date.now()}`,
          stock: 0,
          stockQuantity: 0,
          costPrice: newItem.unitRate,
          conversionFactor: newItem.conversionFactor || 1,
          hsnCode: newItem.hsnCode,
          gstPercentage: newItem.gstPercentage,
          productImage: newItem.image,
          description: newItem.description,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        products.push(newProduct);
        productIndex = products.length - 1;
        newItem.productId = newProduct.id;
      }
    }

    if (productIndex >= 0) {
      const product = products[productIndex];
      const oldStock = product.stockQuantity || 0;
      const oldCost = product.costPrice || 0;
      const newQty = newItem.quantityInSku;
      const newRate = newItem.unitRate;

      // Update product image if provided in voucher
      if (newItem.image) {
        product.productImage = newItem.image;
      }
      if (newItem.description) {
        product.description = newItem.description;
      }

      // Weighted Average Formula: (Old Stock * Old Cost + New Quantity * New Unit Rate) / (Old Stock + New Quantity)
      if (oldStock + newQty > 0) {
        product.costPrice = ((oldStock * oldCost) + (newQty * newRate)) / (oldStock + newQty);
      } else {
        product.costPrice = newRate;
      }

      product.stockQuantity = oldStock + newQty;
      product.stock = product.stockQuantity; // Maintain compatibility
      product.lastPurchaseDate = voucher.date;
      product.updatedAt = new Date();

      // Create ledger entry
      ledger.push({
        id: `sle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: product.id,
        type: 'PURCHASE',
        quantity: newQty,
        referenceId: voucher.id,
        date: new Date(voucher.date)
      });
    }
  });

  // 3. Save products
  setItem(STORAGE_KEYS.PRODUCTS, products);
  setItem(STORAGE_KEYS.STOCK_LEDGER, ledger);

  // 4. Save voucher
  if (existingVoucherIndex >= 0) {
    vouchers[existingVoucherIndex] = voucher;
  } else {
    vouchers.push(voucher);
  }
  setItem(STORAGE_KEYS.PURCHASE_VOUCHERS, vouchers);

  // 5. Cloud sync for all updated elements
  const cloudVoucher = {
    ...voucher,
    date: voucher.date ? new Date(voucher.date).toISOString() : new Date().toISOString(),
    createdAt: voucher.createdAt ? new Date(voucher.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  supabase.from('purchase_vouchers').upsert([cloudVoucher], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync purchase voucher:', error);
  });

  const cloudProducts = products.map(p => ({
    ...p,
    lastPurchaseDate: p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toISOString() : null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  supabase.from('products').upsert(cloudProducts, { onConflict: 'id' }).then(({ error }) => { if (error) console.error(error); });

  const cloudLedger = ledger.map(entry => ({
    ...entry,
    date: entry.date ? new Date(entry.date).toISOString() : new Date().toISOString()
  }));
  supabase.from('stock_ledger').upsert(cloudLedger, { onConflict: 'id' }).then(({ error }) => { if (error) console.error(error); });
}

export function deletePurchaseVoucher(voucherId: string): void {
  const vouchers = getPurchaseVouchers();
  const voucher = vouchers.find(v => v.id === voucherId);
  let products: Product[] = [];
  let ledger: StockLedgerEntry[] = [];

  if (voucher) {
    products = getProducts();
    ledger = getStockLedger().filter(entry => entry.referenceId !== voucherId);

    // Reverse stock updates
    voucher.items.forEach(item => {
      const productIndex = products.findIndex(p => p.id === item.productId);
      if (productIndex >= 0) {
        const product = products[productIndex];
        product.stockQuantity = (product.stockQuantity || 0) - item.quantityInSku;
        product.stock = product.stockQuantity;
        product.updatedAt = new Date();
      }
    });
    setItem(STORAGE_KEYS.PRODUCTS, products);
    setItem(STORAGE_KEYS.STOCK_LEDGER, ledger);
  }

  const filteredVouchers = vouchers.filter(v => v.id !== voucherId);
  setItem(STORAGE_KEYS.PURCHASE_VOUCHERS, filteredVouchers);

  // Background Cloud Sync - delete/update elements
  supabase.from('purchase_vouchers').delete().eq('id', voucherId).then(({ error }) => { if (error) console.error(error); });
  supabase.from('stock_ledger').delete().eq('referenceId', voucherId).then(({ error }) => { if (error) console.error(error); });
  
  if (products.length > 0) {
    const cloudProducts = products.map(p => ({
      ...p,
      lastPurchaseDate: p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toISOString() : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    supabase.from('products').upsert(cloudProducts, { onConflict: 'id' }).then(({ error }) => { if (error) console.error(error); });
  }
}

// Stock Ledger
export function getStockLedger(): StockLedgerEntry[] {
  const ledger = getItem<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  return ledger.map(entry => ({
    ...entry,
    date: new Date(entry.date)
  }));
}

export function saveStockLedgerEntry(entry: StockLedgerEntry): void {
  const ledger = getStockLedger();
  ledger.push(entry);
  setItem(STORAGE_KEYS.STOCK_LEDGER, ledger);
}

// Settings
export interface AppSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  upiId: string;
  upiQrImageBase64?: string;
  taxRate: number;
  defaultDueDays: number;
  billFooterMessage: string;
  billFooterSubMessage: string;
  showQrOnBill: boolean;
  fastGstApiKey: string;
}

const defaultSettings: AppSettings = {
  storeName: 'Smart Retail Store',
  storeAddress: '123 Main Street, City',
  storePhone: '+91 9876543210',
  upiId: 'store@upi',
  taxRate: 0,
  defaultDueDays: 7,
  billFooterMessage: '*** நன்றி மீண்டும் வருக ***',
  billFooterSubMessage: 'வரும் ஞாயிற்றுக்கிழமை கடை மாலை 6 மணி வரை உண்டு',
  showQrOnBill: true,
  fastGstApiKey: 'FGST_LIVE_DK2G96S3B53SENSV8AO0URLT',
};

export function getSettings(): AppSettings {
  const saved = getItem<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  const settings = { ...defaultSettings, ...saved };
  if (!settings.fastGstApiKey) settings.fastGstApiKey = defaultSettings.fastGstApiKey;
  return settings;
}

export function saveSettings(settings: AppSettings): void {
  setItem(STORAGE_KEYS.SETTINGS, settings);

  // Background Cloud Sync
  const cloudSettings = {
    id: 'default',
    ...settings,
    updatedAt: new Date().toISOString()
  };
  supabase.from('settings').upsert([cloudSettings], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync settings to cloud:', error);
  });
}

// Sync status
export function getLastSyncTime(): Date | null {
  const time = getItem<string | null>(STORAGE_KEYS.LAST_SYNC, null);
  return time ? new Date(time) : null;
}

export function setLastSyncTime(time: Date): void {
  setItem(STORAGE_KEYS.LAST_SYNC, time.toISOString());
}

export function getUnsyncedBills(): Bill[] {
  return getBills().filter(b => !b.syncedToCloud);
}

// Draft Bill
export interface DraftBill {
  items: BillItem[];
  customer: Customer | null;
  isNewCustomer: boolean;
}

export function getDraftBill(): DraftBill | null {
  return getItem<DraftBill | null>(STORAGE_KEYS.DRAFT_BILL, null);
}

export function saveDraftBill(draft: DraftBill): void {
  setItem(STORAGE_KEYS.DRAFT_BILL, draft);
}

export function clearDraftBill(): void {
  localStorage.removeItem(STORAGE_KEYS.DRAFT_BILL);
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

export function getRecycleBin(): RecycleBinItem[] {
  return getItem<RecycleBinItem[]>(STORAGE_KEYS.RECYCLE_BIN, []);
}

export function addToRecycleBin(
  entityId: string,
  entityType: RecycleBinEntityType,
  entityLabel: string,
  data: unknown
): void {
  const bin = getRecycleBin();
  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt);
  expiresAt.setDate(expiresAt.getDate() + 30);
  bin.push({
    id: `rb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    entityId,
    entityType,
    entityLabel,
    data,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  setItem(STORAGE_KEYS.RECYCLE_BIN, bin);
}

export function removeFromRecycleBin(recycleBinId: string): void {
  const bin = getRecycleBin().filter(i => i.id !== recycleBinId);
  setItem(STORAGE_KEYS.RECYCLE_BIN, bin);
}

export function purgeExpiredRecycleBinItems(): void {
  const now = new Date();
  const bin = getRecycleBin().filter(i => new Date(i.expiresAt) > now);
  setItem(STORAGE_KEYS.RECYCLE_BIN, bin);
}

export function emptyRecycleBin(): void {
  setItem(STORAGE_KEYS.RECYCLE_BIN, []);
}

// ─── Cascading Delete: Customer ────────────────────────────────────────────────

export function deleteCustomer(customerId: string): void {
  const customers = getCustomers();
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;

  // Collect related bills
  const allBills = getBills();
  const customerBills = allBills.filter(b => b.customerId === customerId);
  const customerBillIds = new Set(customerBills.map(b => b.id));

  // Collect related pending dues
  const allDues = getPendingDues();
  const customerDues = allDues.filter(d => d.customerId === customerId);

  // Collect related payments
  const allPayments = getPayments();
  const customerPayments = allPayments.filter(p => customerBillIds.has(p.billId));

  // Archive to recycle bin
  addToRecycleBin(customerId, 'customer', customer.name, {
    customer,
    bills: customerBills,
    dues: customerDues,
    payments: customerPayments,
  });

  // Remove from localStorage
  setItem(STORAGE_KEYS.CUSTOMERS, customers.filter(c => c.id !== customerId));
  setItem(STORAGE_KEYS.BILLS, allBills.filter(b => b.customerId !== customerId));
  setItem(STORAGE_KEYS.PENDING_DUES, allDues.filter(d => d.customerId !== customerId));
  setItem(STORAGE_KEYS.PAYMENTS, allPayments.filter(p => !customerBillIds.has(p.billId)));

  // Sync deletions to Supabase
  supabase.from('customers').delete().eq('id', customerId).then(({ error }) => {
    if (error) console.error('Failed to delete customer from cloud:', error);
  });
  customerBillIds.forEach(billId => {
    supabase.from('bills').delete().eq('id', billId).then(({ error }) => {
      if (error) console.error('Failed to delete bill from cloud:', error);
    });
    supabase.from('payments').delete().eq('billId', billId).then(({ error }) => {
      if (error) console.error('Failed to delete payments from cloud:', error);
    });
  });
  customerDues.forEach(d => {
    supabase.from('pending_dues').delete().eq('id', d.id).then(({ error }) => {
      if (error) console.error('Failed to delete pending due from cloud:', error);
    });
  });

  // Emit event for realtime UI update
  window.dispatchEvent(new CustomEvent('storage-updated', { detail: { table: 'customers' } }));
}

// ─── Cascading Delete: Bill ────────────────────────────────────────────────────

export function deleteBill(billId: string, restoreStock: boolean = false): void {
  const allBills = getBills();
  const bill = allBills.find(b => b.id === billId);
  if (!bill) return;

  // Collect related pending dues
  const allDues = getPendingDues();
  const billDues = allDues.filter(d => d.billId === billId);

  // Collect related payments
  const allPayments = getPayments();
  const billPayments = allPayments.filter(p => p.billId === billId);

  // Archive to recycle bin
  addToRecycleBin(billId, 'bill', bill.billNumber, {
    bill,
    dues: billDues,
    payments: billPayments,
    stockRestored: restoreStock,
  });

  // Optionally restore stock
  if (restoreStock) {
    const products = getProducts();
    const ledger = getStockLedger().filter(e => e.referenceId !== billId);
    bill.items.forEach(item => {
      const idx = products.findIndex(p => p.id === item.productId);
      if (idx >= 0) {
        products[idx].stockQuantity = (products[idx].stockQuantity || 0) + item.quantity;
        products[idx].stock = products[idx].stockQuantity;
        products[idx].updatedAt = new Date();
      }
    });
    setItem(STORAGE_KEYS.PRODUCTS, products);
    setItem(STORAGE_KEYS.STOCK_LEDGER, ledger);
  }

  // Delete bill image file if present
  if (bill.billImagePath) {
    storageService.deleteBillImage(bill.billImagePath).catch(err =>
      console.error('Failed to delete bill image file:', err)
    );
  }

  // Update customer pending dues balance
  if (bill.pendingAmount > 0) {
    const customers = getCustomers();
    const custIdx = customers.findIndex(c => c.id === bill.customerId);
    if (custIdx >= 0) {
      customers[custIdx].pendingDues = Math.max(0, customers[custIdx].pendingDues - bill.pendingAmount);
      setItem(STORAGE_KEYS.CUSTOMERS, customers);
      supabase.from('customers').upsert([customers[custIdx]], { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error('Failed to sync customer after bill delete:', error);
      });
    }
  }

  // Remove from localStorage
  setItem(STORAGE_KEYS.BILLS, allBills.filter(b => b.id !== billId));
  setItem(STORAGE_KEYS.PENDING_DUES, allDues.filter(d => d.billId !== billId));
  setItem(STORAGE_KEYS.PAYMENTS, allPayments.filter(p => p.billId !== billId));

  // Sync deletions to Supabase
  supabase.from('bills').delete().eq('id', billId).then(({ error }) => {
    if (error) console.error('Failed to delete bill from cloud:', error);
  });
  supabase.from('payments').delete().eq('billId', billId).then(({ error }) => {
    if (error) console.error('Failed to delete payments from cloud:', error);
  });
  billDues.forEach(d => {
    supabase.from('pending_dues').delete().eq('id', d.id).then(({ error }) => {
      if (error) console.error('Failed to delete pending due from cloud:', error);
    });
  });

  // Emit event
  window.dispatchEvent(new CustomEvent('storage-updated', { detail: { table: 'bills' } }));
}

// ─── Delete: PendingDue ────────────────────────────────────────────────────────

export function deletePendingDueRecord(dueId: string): void {
  const allDues = getPendingDues();
  const due = allDues.find(d => d.id === dueId);
  if (!due) return;

  addToRecycleBin(dueId, 'pending_due', `${due.customerName} – ${due.billNumber}`, { due });
  setItem(STORAGE_KEYS.PENDING_DUES, allDues.filter(d => d.id !== dueId));

  supabase.from('pending_dues').delete().eq('id', dueId).then(({ error }) => {
    if (error) console.error('Failed to delete pending due from cloud:', error);
  });
}

// ─── Update: PendingDue (for partial payments) ─────────────────────────────────

export function updatePendingDue(due: PendingDue): void {
  const dues = getPendingDues();
  const idx = dues.findIndex(d => d.id === due.id);
  if (idx >= 0) {
    dues[idx] = due;
  } else {
    dues.push(due);
  }
  setItem(STORAGE_KEYS.PENDING_DUES, dues);

  // Sync to Supabase
  const cloudDue = {
    ...due,
    dueDate: due.dueDate ? new Date(due.dueDate).toISOString() : null,
    createdAt: due.createdAt ? new Date(due.createdAt).toISOString() : new Date().toISOString(),
  };
  supabase.from('pending_dues').upsert([cloudDue], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync pending due to cloud:', error);
  });
}

// ─── Restore from Recycle Bin ──────────────────────────────────────────────────

export function restoreFromRecycleBin(recycleBinId: string): boolean {
  const bin = getRecycleBin();
  const item = bin.find(i => i.id === recycleBinId);
  if (!item) return false;

  try {
    const d = item.data as Record<string, unknown>;

    if (item.entityType === 'customer') {
      const { customer, bills, dues, payments } = d as {
        customer: Customer;
        bills: Bill[];
        dues: PendingDue[];
        payments: Payment[];
      };
      saveCustomer(customer);
      bills.forEach(b => {
        const allBills = getBills();
        if (!allBills.find(x => x.id === b.id)) {
          allBills.push(b);
          setItem(STORAGE_KEYS.BILLS, allBills);
        }
      });
      dues.forEach(d2 => savePendingDue(d2));
      payments.forEach(p => {
        const allPay = getPayments();
        if (!allPay.find(x => x.id === p.id)) {
          allPay.push(p);
          setItem(STORAGE_KEYS.PAYMENTS, allPay);
        }
      });
    } else if (item.entityType === 'bill') {
      const { bill, dues, payments } = d as {
        bill: Bill;
        dues: PendingDue[];
        payments: Payment[];
      };
      const allBills = getBills();
      if (!allBills.find(x => x.id === bill.id)) {
        allBills.push(bill);
        setItem(STORAGE_KEYS.BILLS, allBills);
      }
      dues.forEach(d2 => savePendingDue(d2));
      payments.forEach(p => {
        const allPay = getPayments();
        if (!allPay.find(x => x.id === p.id)) {
          allPay.push(p);
          setItem(STORAGE_KEYS.PAYMENTS, allPay);
        }
      });
    } else if (item.entityType === 'product') {
      saveProduct(d.product as Product);
    } else if (item.entityType === 'pending_due') {
      savePendingDue((d.due as PendingDue));
    }

    removeFromRecycleBin(recycleBinId);
    return true;
  } catch (err) {
    console.error('Failed to restore from recycle bin:', err);
    return false;
  }
}

// ─── Format Application ───────────────────────────────────────────────────────

export async function formatApplication(): Promise<void> {
  console.warn('FORMAT APPLICATION: Clearing all data...');

  // 1. Clear all Supabase tables
  const tables = [
    'bills', 'customers', 'products', 'categories',
    'users', 'payments', 'pending_dues', 'purchase_vouchers',
    'stock_ledger', 'employee_tasks', 'attendance', 'suppliers',
    'settings', 'daily_sales_reports',
  ];
  for (const table of tables) {
    try {
      // Delete all rows — filter on a column that exists in all tables
      await supabase.from(table).delete().neq('id', '');
    } catch (err) {
      console.error(`Failed to clear Supabase table ${table}:`, err);
    }
  }

  // 2. Clear all localStorage keys
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));

  // 3. Tell Electron to wipe storage folders
  try {
    await storageService.formatStorageFolders();
  } catch (err) {
    console.error('Failed to format storage folders:', err);
  }

  console.warn('FORMAT APPLICATION: Complete. Reloading...');
  setTimeout(() => window.location.reload(), 500);
}

// ─── Ensure Admin User on first boot (replaces sample data init) ───────────────

export function ensureAdminUser(): void {
  const users = getUsers();
  if (users.length === 0) {
    const admin: User = {
      id: 'user-admin',
      name: 'Admin',
      role: 'admin',
      phone: '',
      createdAt: new Date(),
      isActive: true,
    };
    saveUser(admin);
    console.log('Default admin user created.');
  }
}

// Initialize with sample data — NOW A NO-OP (production mode)
export function initializeSampleData(): void {
  const tamilTranslations: Record<string, string> = {
    'Rice Premium 5kg': 'பிரிமியம் அரிசி 5kg',
    'Rice Basmati 1kg': 'பாசுமதி அரிசி 1kg',
    'Wheat Flour 10kg': 'கோதுமை மாவு 10kg',
    'Sugar 5kg': 'சர்க்கரை 5kg',
    'Salt 1kg': 'உப்பு 1kg',
    'Milk Full Cream 1L': 'முழு கிரீம் பால் 1L',
    'Milk Toned 500ml': 'பதப்படுத்தப்பட்ட பால் 500ml',
    'Butter 100g': 'வெண்ணெய் 100g',
    'Cheese Slice 200g': 'சீஸ் 200g',
    'Curd 400g': 'தயிர் 400g',
    'Coca Cola 2L': 'கோகோ கோலா 2L',
    'Pepsi 750ml': 'பெப்சி 750ml',
    'Mango Juice 1L': 'மாம்பழ சாறு 1L',
    'Green Tea 25 bags': 'க்ரீன் டீ 25',
    'Coffee 200g': 'காபி தூள் 200g',
    'Chips Classic 100g': 'சிப்ஸ் 100g',
    'Biscuits Cream 300g': 'பிஸ்கட் 300g',
    'Chocolate Bar 50g': 'சாக்லேட் 50g',
    'Namkeen Mix 200g': 'மிக்ஸர் 200g',
    'Popcorn 80g': 'பாப்கார்ன் 80g',
    'Shampoo 400ml': 'ஷாம்பு 400ml',
    'Soap Bar 100g': 'சோப்பு 100g',
    'Toothpaste 200g': 'பற்பசை 200g',
    'Face Wash 150ml': 'ஃபேஸ் வாஷ் 150ml',
    'Detergent 1kg': 'சலவைத் தூள் 1kg',
    'Dish Wash 500ml': 'பாத்திரம் கழுவும் திரவம் 500ml',
    'Floor Cleaner 1L': 'நிலா துடைப்பான் 1L',
    'Tissue Roll Pack': 'டிஷ்யூ பேப்பர்',
  };

  const existingProducts = getProducts();
  let needsPatch = false;

  const patchedProducts = existingProducts.map(p => {
    if (!p.nameTamil && tamilTranslations[p.name]) {
      needsPatch = true;
      return { ...p, nameTamil: tamilTranslations[p.name] };
    }
    return p;
  });

  if (needsPatch) {
    setItem(STORAGE_KEYS.PRODUCTS, patchedProducts);
  }

  // Check if already initialized
  if (existingProducts.length > 0) return;

  // Sample categories
  const categories: Category[] = [
    { id: 'cat-1', name: 'Groceries', sortOrder: 1 },
    { id: 'cat-2', name: 'Dairy', sortOrder: 2 },
    { id: 'cat-3', name: 'Beverages', sortOrder: 3 },
    { id: 'cat-4', name: 'Snacks', sortOrder: 4 },
    { id: 'cat-5', name: 'Personal Care', sortOrder: 5 },
    { id: 'cat-6', name: 'Household', sortOrder: 6 },
  ];
  categories.forEach(saveCategory);

  // Sample products
  const products: Product[] = [
    { id: 'p-1', name: 'Rice Premium 5kg', nameTamil: tamilTranslations['Rice Premium 5kg'], category: 'Groceries', price: 450, minPrice: 420, maxPrice: 480, unit: 'bag', uom: 'bag', sku: 'RP5KG', stock: 50, stockQuantity: 50, costPrice: 400, conversionFactor: 1, hsnCode: '1006', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-2', name: 'Rice Basmati 1kg', nameTamil: tamilTranslations['Rice Basmati 1kg'], category: 'Groceries', price: 180, minPrice: 160, maxPrice: 200, unit: 'pack', uom: 'pack', sku: 'RB1KG', stock: 100, stockQuantity: 100, costPrice: 150, conversionFactor: 1, hsnCode: '1006', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-3', name: 'Wheat Flour 10kg', nameTamil: tamilTranslations['Wheat Flour 10kg'], category: 'Groceries', price: 520, minPrice: 480, maxPrice: 560, unit: 'bag', uom: 'bag', sku: 'WF10KG', stock: 40, stockQuantity: 40, costPrice: 480, conversionFactor: 1, hsnCode: '1001', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-4', name: 'Sugar 5kg', nameTamil: tamilTranslations['Sugar 5kg'], category: 'Groceries', price: 280, minPrice: 260, maxPrice: 300, unit: 'bag', uom: 'bag', sku: 'S5KG', stock: 60, stockQuantity: 60, costPrice: 240, conversionFactor: 1, hsnCode: '1701', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-5', name: 'Salt 1kg', nameTamil: tamilTranslations['Salt 1kg'], category: 'Groceries', price: 25, minPrice: 22, maxPrice: 28, unit: 'pack', uom: 'pack', sku: 'SALT1KG', stock: 200, stockQuantity: 200, costPrice: 18, conversionFactor: 1, hsnCode: '2501', gstPercentage: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-6', name: 'Milk Full Cream 1L', nameTamil: tamilTranslations['Milk Full Cream 1L'], category: 'Dairy', price: 68, minPrice: 65, maxPrice: 72, unit: 'packet', uom: 'packet', sku: 'MFC1L', stock: 30, stockQuantity: 30, costPrice: 60, conversionFactor: 1, hsnCode: '0401', gstPercentage: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-7', name: 'Milk Toned 500ml', nameTamil: tamilTranslations['Milk Toned 500ml'], category: 'Dairy', price: 30, minPrice: 28, maxPrice: 35, unit: 'packet', uom: 'packet', sku: 'MT500ML', stock: 50, stockQuantity: 50, costPrice: 25, conversionFactor: 1, hsnCode: '0401', gstPercentage: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-8', name: 'Butter 100g', nameTamil: tamilTranslations['Butter 100g'], category: 'Dairy', price: 58, minPrice: 54, maxPrice: 65, unit: 'pack', uom: 'pack', sku: 'B100G', stock: 25, stockQuantity: 25, costPrice: 50, conversionFactor: 1, hsnCode: '0405', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-9', name: 'Cheese Slice 200g', nameTamil: tamilTranslations['Cheese Slice 200g'], category: 'Dairy', price: 120, minPrice: 110, maxPrice: 135, unit: 'pack', uom: 'pack', sku: 'CS200G', stock: 20, stockQuantity: 20, costPrice: 100, conversionFactor: 1, hsnCode: '0406', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-10', name: 'Curd 400g', nameTamil: tamilTranslations['Curd 400g'], category: 'Dairy', price: 45, minPrice: 40, maxPrice: 50, unit: 'pack', uom: 'pack', sku: 'CURD400G', stock: 40, stockQuantity: 40, costPrice: 35, conversionFactor: 1, hsnCode: '0403', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-11', name: 'Coca Cola 2L', nameTamil: tamilTranslations['Coca Cola 2L'], category: 'Beverages', price: 95, minPrice: 90, maxPrice: 100, unit: 'bottle', uom: 'bottle', sku: 'CC2L', stock: 48, stockQuantity: 48, costPrice: 80, conversionFactor: 1, hsnCode: '2202', gstPercentage: 28, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-12', name: 'Pepsi 750ml', nameTamil: tamilTranslations['Pepsi 750ml'], category: 'Beverages', price: 42, minPrice: 38, maxPrice: 45, unit: 'bottle', uom: 'bottle', sku: 'P750ML', stock: 72, stockQuantity: 72, costPrice: 35, conversionFactor: 1, hsnCode: '2202', gstPercentage: 28, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-13', name: 'Mango Juice 1L', nameTamil: tamilTranslations['Mango Juice 1L'], category: 'Beverages', price: 120, minPrice: 110, maxPrice: 130, unit: 'pack', uom: 'pack', sku: 'MJ1L', stock: 35, stockQuantity: 35, costPrice: 90, conversionFactor: 1, hsnCode: '2202', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-14', name: 'Green Tea 25 bags', nameTamil: tamilTranslations['Green Tea 25 bags'], category: 'Beverages', price: 180, minPrice: 165, maxPrice: 195, unit: 'box', uom: 'box', sku: 'GT25B', stock: 28, stockQuantity: 28, costPrice: 140, conversionFactor: 1, hsnCode: '0902', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-15', name: 'Coffee 200g', nameTamil: tamilTranslations['Coffee 200g'], category: 'Beverages', price: 350, minPrice: 320, maxPrice: 380, unit: 'jar', uom: 'jar', sku: 'C200G', stock: 22, stockQuantity: 22, costPrice: 300, conversionFactor: 1, hsnCode: '0901', gstPercentage: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-16', name: 'Chips Classic 100g', nameTamil: tamilTranslations['Chips Classic 100g'], category: 'Snacks', price: 30, minPrice: 28, maxPrice: 35, unit: 'pack', uom: 'pack', sku: 'CHIPS100G', stock: 100, stockQuantity: 100, costPrice: 22, conversionFactor: 1, hsnCode: '1905', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-17', name: 'Biscuits Cream 300g', nameTamil: tamilTranslations['Biscuits Cream 300g'], category: 'Snacks', price: 45, minPrice: 40, maxPrice: 50, unit: 'pack', uom: 'pack', sku: 'BISC300G', stock: 80, stockQuantity: 80, costPrice: 35, conversionFactor: 1, hsnCode: '1905', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-18', name: 'Chocolate Bar 50g', nameTamil: tamilTranslations['Chocolate Bar 50g'], category: 'Snacks', price: 55, minPrice: 50, maxPrice: 60, unit: 'piece', uom: 'piece', sku: 'CHOC50G', stock: 60, stockQuantity: 60, costPrice: 40, conversionFactor: 1, hsnCode: '1806', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-19', name: 'Namkeen Mix 200g', nameTamil: tamilTranslations['Namkeen Mix 200g'], category: 'Snacks', price: 65, minPrice: 58, maxPrice: 72, unit: 'pack', uom: 'pack', sku: 'NAM200G', stock: 45, stockQuantity: 45, costPrice: 50, conversionFactor: 1, hsnCode: '2106', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-20', name: 'Popcorn 80g', nameTamil: tamilTranslations['Popcorn 80g'], category: 'Snacks', price: 25, minPrice: 22, maxPrice: 30, unit: 'pack', uom: 'pack', sku: 'POP80G', stock: 90, stockQuantity: 90, costPrice: 18, conversionFactor: 1, hsnCode: '2008', gstPercentage: 12, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-21', name: 'Shampoo 400ml', nameTamil: tamilTranslations['Shampoo 400ml'], category: 'Personal Care', price: 280, minPrice: 260, maxPrice: 300, unit: 'bottle', uom: 'bottle', sku: 'SH400ML', stock: 35, stockQuantity: 35, costPrice: 220, conversionFactor: 1, hsnCode: '3305', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-22', name: 'Soap Bar 100g', nameTamil: tamilTranslations['Soap Bar 100g'], category: 'Personal Care', price: 45, minPrice: 40, maxPrice: 50, unit: 'piece', uom: 'piece', sku: 'SOAP100G', stock: 120, stockQuantity: 120, costPrice: 35, conversionFactor: 1, hsnCode: '3401', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-23', name: 'Toothpaste 200g', nameTamil: tamilTranslations['Toothpaste 200g'], category: 'Personal Care', price: 120, minPrice: 110, maxPrice: 135, unit: 'tube', uom: 'tube', sku: 'TP200G', stock: 55, stockQuantity: 55, costPrice: 90, conversionFactor: 1, hsnCode: '3306', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-24', name: 'Face Wash 150ml', nameTamil: tamilTranslations['Face Wash 150ml'], category: 'Personal Care', price: 180, minPrice: 165, maxPrice: 200, unit: 'tube', uom: 'tube', sku: 'FW150ML', stock: 30, stockQuantity: 30, costPrice: 150, conversionFactor: 1, hsnCode: '3304', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-25', name: 'Detergent 1kg', nameTamil: tamilTranslations['Detergent 1kg'], category: 'Household', price: 220, minPrice: 200, maxPrice: 240, unit: 'pack', uom: 'pack', sku: 'DET1KG', stock: 45, stockQuantity: 45, costPrice: 180, conversionFactor: 1, hsnCode: '3402', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-26', name: 'Dish Wash 500ml', nameTamil: tamilTranslations['Dish Wash 500ml'], category: 'Household', price: 95, minPrice: 85, maxPrice: 105, unit: 'bottle', uom: 'bottle', sku: 'DW500ML', stock: 40, stockQuantity: 40, costPrice: 75, conversionFactor: 1, hsnCode: '3402', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-27', name: 'Floor Cleaner 1L', nameTamil: tamilTranslations['Floor Cleaner 1L'], category: 'Household', price: 150, minPrice: 135, maxPrice: 165, unit: 'bottle', uom: 'bottle', sku: 'FC1L', stock: 32, stockQuantity: 32, costPrice: 120, conversionFactor: 1, hsnCode: '3808', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'p-28', name: 'Tissue Roll Pack', nameTamil: tamilTranslations['Tissue Roll Pack'], category: 'Household', price: 80, minPrice: 72, maxPrice: 90, unit: 'pack', uom: 'pack', sku: 'TRPACK', stock: 60, stockQuantity: 60, costPrice: 60, conversionFactor: 1, hsnCode: '4818', gstPercentage: 18, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  products.forEach(saveProduct);

  // Sample users (admin and employee)
  const users: User[] = [
    { id: 'user-admin', name: 'Admin', role: 'admin', phone: '9999999999', createdAt: new Date(), isActive: true },
    { id: 'user-emp-1', name: 'Rahul Kumar', role: 'employee', barcode: 'EMP001', phone: '9876543210', createdAt: new Date(), isActive: true },
    { id: 'user-emp-2', name: 'Priya Sharma', role: 'employee', barcode: 'EMP002', phone: '9876543211', createdAt: new Date(), isActive: true },
  ];
  users.forEach(saveUser);

  // Sample customers
  const customers: Customer[] = [
    { id: 'cust-1', name: 'Rajesh Patel', phone: '9898989898', isRegular: true, totalPurchases: 15420, pendingDues: 0, createdAt: new Date(), lastVisit: new Date() },
    { id: 'cust-2', name: 'Sunita Devi', phone: '9797979797', isRegular: true, totalPurchases: 8750, pendingDues: 250, createdAt: new Date(), lastVisit: new Date() },
    { id: 'cust-3', name: 'Amit Singh', phone: '9696969696', isRegular: false, totalPurchases: 1200, pendingDues: 0, createdAt: new Date(), lastVisit: new Date() },
  ];
  customers.forEach(saveCustomer);

  // Sample suppliers
  const suppliers: Supplier[] = [
    {
      id: 'sup-1',
      name: 'Global Distributors',
      supplierCode: 'SUP-0001',
      phone: '9000000001',
      email: 'sales@global.com',
      address1: 'Warehouse A1, industrial Estate',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'sup-2',
      name: 'City Wholesale',
      supplierCode: 'SUP-0002',
      phone: '9000000002',
      email: 'orders@citywholesale.com',
      address1: 'Market Road, City',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      createdAt: new Date(),
      updatedAt: new Date()
    },
  ];
  suppliers.forEach(s => {
    const existing = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    if (!existing.find(ex => ex.id === s.id)) {
      existing.push(s);
      setItem(STORAGE_KEYS.SUPPLIERS, existing);
    }
  });

  if (getItem<number>(STORAGE_KEYS.SUPPLIER_COUNTER, 0) === 0) {
    setItem(STORAGE_KEYS.SUPPLIER_COUNTER, suppliers.length);
  }

  // Production mode: no sample data seeded.
  // Call ensureAdminUser() from App.tsx instead.
  return;
}

export function getSuppliers(): Supplier[] {
  const suppliers = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  return suppliers.map(s => ({
    ...s,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt)
  }));
}

export function getNextSupplierCode(): string {
  const counter = getItem<number>(STORAGE_KEYS.SUPPLIER_COUNTER, 0) + 1;
  setItem(STORAGE_KEYS.SUPPLIER_COUNTER, counter);
  return `SUP-${String(counter).padStart(4, '0')}`;
}

export function saveSupplier(supplier: Supplier): void {
  const suppliers = getSuppliers();
  const existingIndex = suppliers.findIndex(s => s.id === supplier.id);
  let updatedSupplier: Supplier;
  if (existingIndex >= 0) {
    updatedSupplier = { ...supplier, updatedAt: new Date() };
    suppliers[existingIndex] = updatedSupplier;
  } else {
    updatedSupplier = { ...supplier, createdAt: new Date(), updatedAt: new Date() };
    suppliers.push(updatedSupplier);
  }
  setItem(STORAGE_KEYS.SUPPLIERS, suppliers);

  // Background Cloud Sync
  const cloudSupplier = {
    ...updatedSupplier,
    createdAt: updatedSupplier.createdAt ? new Date(updatedSupplier.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: updatedSupplier.updatedAt ? new Date(updatedSupplier.updatedAt).toISOString() : new Date().toISOString(),
  };
  supabase.from('suppliers').upsert([cloudSupplier], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync supplier to cloud:', error);
  });
}

export function deleteSupplier(supplierId: string): void {
  const suppliers = getSuppliers().filter(s => s.id !== supplierId);
  setItem(STORAGE_KEYS.SUPPLIERS, suppliers);

  // Background Cloud Sync
  supabase.from('suppliers').delete().eq('id', supplierId).then(({ error }) => {
    if (error) console.error('Failed to delete supplier from cloud:', error);
  });
}
export function getEmployeeTasks(): EmployeeTask[] {
  const tasks = getItem<EmployeeTask[]>(STORAGE_KEYS.EMPLOYEE_TASKS, []);
  return tasks.map(t => ({
    ...t,
    startTime: new Date(t.startTime),
    endTime: t.endTime ? new Date(t.endTime) : undefined,
  }));
}

export function saveEmployeeTask(task: EmployeeTask): void {
  const tasks = getEmployeeTasks();
  const existingIndex = tasks.findIndex(t => t.id === task.id);
  if (existingIndex >= 0) {
    tasks[existingIndex] = task;
  } else {
    tasks.push(task);
  }
  setItem(STORAGE_KEYS.EMPLOYEE_TASKS, tasks);

  // Background Cloud Sync
  const cloudTask = {
    ...task,
    startTime: task.startTime ? new Date(task.startTime).toISOString() : new Date().toISOString(),
    endTime: task.endTime ? new Date(task.endTime).toISOString() : null,
  };
  supabase.from('employee_tasks').upsert([cloudTask], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync employee task to cloud:', error);
  });
}

export function getActiveTask(employeeId: string): EmployeeTask | undefined {
  return getEmployeeTasks().find(t => t.employeeId === employeeId && t.status === 'active');
}

export function clockIn(employeeId: string, employeeName: string, billNumber: string): EmployeeTask {
  const activeTask = getActiveTask(employeeId);
  if (activeTask) {
    throw new Error('Employee already has an active task');
  }

  const newTask: EmployeeTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    employeeId,
    employeeName,
    billNumber,
    startTime: new Date(),
    status: 'active',
  };

  saveEmployeeTask(newTask);
  return newTask;
}

export function clockOut(taskId: string): EmployeeTask {
  const tasks = getEmployeeTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex < 0) {
    throw new Error('Task not found');
  }

  const task = tasks[taskIndex];
  if (task.status === 'completed') {
    throw new Error('Task already completed');
  }

  const endTime = new Date();
  const duration = Math.floor((endTime.getTime() - task.startTime.getTime()) / 1000);

  const updatedTask: EmployeeTask = {
    ...task,
    endTime,
    duration,
    status: 'completed',
  };

  saveEmployeeTask(updatedTask);
  return updatedTask;
}

export function getEmployeePerformanceMetrics(): EmployeePerformance[] {
  const tasks = getEmployeeTasks().filter(t => t.status === 'completed');
  const performanceMap: Record<string, EmployeePerformance> = {};

  tasks.forEach(task => {
    if (!performanceMap[task.employeeId]) {
      performanceMap[task.employeeId] = {
        employeeId: task.employeeId,
        employeeName: task.employeeName,
        totalBills: 0,
        totalTime: 0,
        averageTime: 0,
      };
    }

    const p = performanceMap[task.employeeId];
    p.totalBills += 1;
    p.totalTime += task.duration || 0;
  });

  return Object.values(performanceMap).map(p => ({
    ...p,
    averageTime: p.totalBills > 0 ? Math.round(p.totalTime / p.totalBills) : 0,
  }));
}

// Attendance
export function getAttendance(): AttendanceRecord[] {
  return getItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
}

export function getTodaysAttendance(employeeId: string): AttendanceRecord | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getAttendance().find(a => a.employeeId === employeeId && a.date === today);
}

export function checkInEmployee(employeeId: string, employeeName: string): AttendanceRecord {
  const existing = getTodaysAttendance(employeeId);
  if (existing) throw new Error('Already checked in today');

  const today = new Date().toISOString().split('T')[0];
  const record: AttendanceRecord = {
    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    employeeId,
    employeeName,
    date: today,
    checkIn: new Date().toISOString(),
  };

  const all = getAttendance();
  all.push(record);
  setItem(STORAGE_KEYS.ATTENDANCE, all);

  // Background Cloud Sync
  supabase.from('attendance').upsert([record], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync check-in to cloud:', error);
  });

  return record;
}

export function checkOutEmployee(employeeId: string): AttendanceRecord {
  const all = getAttendance();
  const idx = all.findIndex(a => a.employeeId === employeeId && !a.checkOut);
  if (idx < 0) throw new Error('No active check-in found');

  const record = all[idx];
  const checkOut = new Date().toISOString();
  const totalHours = (new Date(checkOut).getTime() - new Date(record.checkIn).getTime()) / 3600000;
  const updatedRecord = { ...record, checkOut, totalHours: parseFloat(totalHours.toFixed(2)) };
  all[idx] = updatedRecord;
  setItem(STORAGE_KEYS.ATTENDANCE, all);

  // Background Cloud Sync
  supabase.from('attendance').upsert([updatedRecord], { onConflict: 'id' }).then(({ error }) => {
    if (error) console.error('Failed to sync check-out to cloud:', error);
  });

  return all[idx];
}

// ─── Push ALL local data to Supabase (upload) ─────────────────────────────────
export async function pushAllToCloud(): Promise<void> {
  console.log('Pushing all local data to Supabase cloud...');

  try {
    // 1. Push Categories
    const localCategories = getCategories();
    if (localCategories.length > 0) {
      const { error } = await supabase.from('categories').upsert(localCategories, { onConflict: 'id' });
      if (error) console.error('Push categories failed:', error);
      else console.log(`Pushed ${localCategories.length} categories`);
    }

    // 2. Push Products
    const localProducts = getProducts();
    if (localProducts.length > 0) {
      const cloudProducts = localProducts.map(p => ({
        ...p,
        lastPurchaseDate: p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toISOString() : null,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('products').upsert(cloudProducts, { onConflict: 'id' });
      if (error) console.error('Push products failed:', error);
      else console.log(`Pushed ${localProducts.length} products`);
    }

    // 3. Push Customers
    const localCustomers = getCustomers();
    if (localCustomers.length > 0) {
      const cloudCustomers = localCustomers.map(c => ({
        ...c,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        lastVisit: c.lastVisit ? new Date(c.lastVisit).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('customers').upsert(cloudCustomers, { onConflict: 'id' });
      if (error) console.error('Push customers failed:', error);
      else console.log(`Pushed ${localCustomers.length} customers`);
    }

    // 4. Push Users (with password hashes)
    const localUsers = getUsers();
    if (localUsers.length > 0) {
      const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
      const cloudUsers = localUsers.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        barcode: u.barcode,
        phone: u.phone,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        isActive: u.isActive,
        password_hash: passwords[u.id] || null,
      }));
      const { error } = await supabase.from('users').upsert(cloudUsers, { onConflict: 'id' });
      if (error) console.error('Push users failed:', error);
      else console.log(`Pushed ${localUsers.length} users`);
    }

    // 5. Push Suppliers
    const localSuppliers = getSuppliers();
    if (localSuppliers.length > 0) {
      const cloudSuppliers = localSuppliers.map(s => ({
        ...s,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('suppliers').upsert(cloudSuppliers, { onConflict: 'id' });
      if (error) console.error('Push suppliers failed:', error);
      else console.log(`Pushed ${localSuppliers.length} suppliers`);
    }

    // 6. Push Payments
    const localPayments = getPayments();
    if (localPayments.length > 0) {
      const cloudPayments = localPayments.map(p => ({
        ...p,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('payments').upsert(cloudPayments, { onConflict: 'id' });
      if (error) console.error('Push payments failed:', error);
      else console.log(`Pushed ${localPayments.length} payments`);
    }

    // 7. Push Purchase Vouchers
    const localVouchers = getPurchaseVouchers();
    if (localVouchers.length > 0) {
      const cloudVouchers = localVouchers.map(v => ({
        ...v,
        date: v.date ? new Date(v.date).toISOString() : new Date().toISOString(),
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('purchase_vouchers').upsert(cloudVouchers, { onConflict: 'id' });
      if (error) console.error('Push purchase vouchers failed:', error);
      else console.log(`Pushed ${localVouchers.length} purchase vouchers`);
    }

    // 8. Push Stock Ledger
    const localLedger = getStockLedger();
    if (localLedger.length > 0) {
      const cloudLedger = localLedger.map(l => ({
        ...l,
        date: l.date ? new Date(l.date).toISOString() : new Date().toISOString(),
      }));
      const { error } = await supabase.from('stock_ledger').upsert(cloudLedger, { onConflict: 'id' });
      if (error) console.error('Push stock ledger failed:', error);
      else console.log(`Pushed ${localLedger.length} stock ledger entries`);
    }

    // 9. Push Employee Tasks
    const localTasks = getEmployeeTasks();
    if (localTasks.length > 0) {
      const cloudTasks = localTasks.map(t => ({
        ...t,
        startTime: t.startTime ? new Date(t.startTime).toISOString() : new Date().toISOString(),
        endTime: t.endTime ? new Date(t.endTime).toISOString() : null,
      }));
      const { error } = await supabase.from('employee_tasks').upsert(cloudTasks, { onConflict: 'id' });
      if (error) console.error('Push employee tasks failed:', error);
      else console.log(`Pushed ${localTasks.length} employee tasks`);
    }

    // 10. Push Attendance
    const localAttendance = getAttendance();
    if (localAttendance.length > 0) {
      const { error } = await supabase.from('attendance').upsert(localAttendance, { onConflict: 'id' });
      if (error) console.error('Push attendance failed:', error);
      else console.log(`Pushed ${localAttendance.length} attendance records`);
    }

    // 11. Push Settings
    const localSettings = getSettings();
    const cloudSettings = {
      id: 'default',
      ...localSettings,
      updatedAt: new Date().toISOString(),
    };
    const { error: settingsErr } = await supabase.from('settings').upsert([cloudSettings], { onConflict: 'id' });
    if (settingsErr) console.error('Push settings failed:', settingsErr);
    else console.log('Pushed settings');

    // 12. Push Bills — strip base64 images to avoid payload size limits
    const localBills = getBills();
    if (localBills.length > 0) {
      const cloudBills = localBills.map(b => serializeBillForCloud({ ...b, billImageBase64: undefined }));
      let allBillsPushedOk = true;
      // Upsert in batches of 50 to avoid payload limits
      for (let i = 0; i < cloudBills.length; i += 50) {
        const batch = cloudBills.slice(i, i + 50);
        const { error } = await supabase.from('bills').upsert(batch, { onConflict: 'id' });
        if (error) { console.error(`Push bills batch ${i} failed:`, error); allBillsPushedOk = false; }
      }
      if (allBillsPushedOk) {
        // Mark all bills as synced in localStorage
        const updatedBills = localBills.map(b => ({ ...b, syncedToCloud: true }));
        setItem(STORAGE_KEYS.BILLS, updatedBills);
        console.log(`Pushed and marked ${localBills.length} bills as synced`);
      }
    }

    // 13. Push Pending Dues (store as part of bills/customers, no separate table needed)

    // 14. Push Daily Sales Reports (Tax Database Reports)
    const localReports = getItem<DailySalesReport[]>(STORAGE_KEYS.SALES_REPORTS, []);
    if (localReports.length > 0) {
      const { error } = await supabase.from('daily_sales_reports').upsert(localReports, { onConflict: 'id' });
      if (error) console.error('Push daily sales reports failed:', error);
      else console.log(`Pushed ${localReports.length} daily sales reports`);
    }

    console.log('All local data pushed to cloud successfully.');
  } catch (error) {
    console.error('Error pushing data to cloud:', error);
  }
}

/**
 * Push only the bills that are not yet synced to Supabase.
 * Faster than a full sync — called opportunistically after each bill save.
 */
export async function syncUnsyncedBills(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  const unsynced = getBills().filter(b => !b.syncedToCloud);
  if (unsynced.length === 0) return;
  console.log(`Pushing ${unsynced.length} unsynced bills to Supabase...`);
  const cloudBills = unsynced.map(b => serializeBillForCloud({ ...b, billImageBase64: undefined }));
  for (let i = 0; i < cloudBills.length; i += 50) {
    const batch = cloudBills.slice(i, i + 50);
    const { error } = await supabase.from('bills').upsert(batch, { onConflict: 'id' });
    if (!error) {
      // Mark this batch as synced
      const batchIds = new Set(batch.map(b => b.id as string));
      const all = getBills();
      setItem(STORAGE_KEYS.BILLS, all.map(b => batchIds.has(b.id) ? { ...b, syncedToCloud: true } : b));
    } else {
      console.error('Failed to push unsynced bills batch:', error);
    }
  }
}

// Full bidirectional sync for all entities
export async function syncAllFromCloud(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return; // Don't sync if not logged in

  console.log('Starting full bidirectional cloud data sync...');

  try {
    // ── STEP 1: Push all local data TO the cloud first ──────────────────────
    await pushAllToCloud();

    // ── STEP 2: Pull data FROM the cloud and merge ──────────────────────────
    // 1. Sync Categories
    const { data: categories, error: catErr } = await supabase.from('categories').select('*');
    if (categories && !catErr) {
      const local = getCategories();
      const map = new Map(local.map(c => [c.id, c]));
      categories.forEach(c => map.set(c.id, c));
      setItem(STORAGE_KEYS.CATEGORIES, Array.from(map.values()));
    }

    // 2. Sync Products
    const { data: products, error: prodErr } = await supabase.from('products').select('*');
    if (products && !prodErr) {
      const local = getProducts();
      const map = new Map(local.map(p => [p.id, p]));
      products.forEach(p => {
        map.set(p.id, {
          ...p,
          lastPurchaseDate: p.lastPurchaseDate ? new Date(p.lastPurchaseDate) : undefined,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        });
      });
      setItem(STORAGE_KEYS.PRODUCTS, Array.from(map.values()));
    }

    // 3. Sync Customers
    await syncCustomersFromCloud();

    // 4. Sync Bills
    await syncBillsFromCloud();

    // 5. Sync Users & Passwords
    const { data: users, error: userErr } = await supabase.from('users').select('*');
    if (users && !userErr) {
      const local = getUsers();
      const map = new Map(local.map(u => [u.id, u]));
      const passwords = getItem<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
      
      users.forEach(u => {
        const { password_hash, ...userObj } = u;
        map.set(userObj.id, {
          ...userObj,
          createdAt: userObj.createdAt ? new Date(userObj.createdAt) : new Date(),
        });
        if (password_hash) {
          passwords[userObj.id] = password_hash;
        }
      });
      setItem(STORAGE_KEYS.USERS, Array.from(map.values()));
      setItem(STORAGE_KEYS.PASSWORDS, passwords);
    }

    // 6. Sync Suppliers
    const { data: suppliers, error: supErr } = await supabase.from('suppliers').select('*');
    if (suppliers && !supErr) {
      const local = getSuppliers();
      const map = new Map(local.map(s => [s.id, s]));
      suppliers.forEach(s => {
        map.set(s.id, {
          ...s,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        });
      });
      setItem(STORAGE_KEYS.SUPPLIERS, Array.from(map.values()));
    }

    // 7. Sync Payments
    const { data: payments, error: payErr } = await supabase.from('payments').select('*');
    if (payments && !payErr) {
      const local = getPayments();
      const map = new Map(local.map(p => [p.id, p]));
      payments.forEach(p => {
        map.set(p.id, {
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        });
      });
      setItem(STORAGE_KEYS.PAYMENTS, Array.from(map.values()));
    }

    // 8. Sync Purchase Vouchers
    const { data: vouchers, error: vouchErr } = await supabase.from('purchase_vouchers').select('*');
    if (vouchers && !vouchErr) {
      const local = getPurchaseVouchers();
      const map = new Map(local.map(v => [v.id, v]));
      vouchers.forEach(v => {
        map.set(v.id, {
          ...v,
          date: v.date ? new Date(v.date) : new Date(),
          createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
        });
      });
      setItem(STORAGE_KEYS.PURCHASE_VOUCHERS, Array.from(map.values()));
    }

    // 9. Sync Stock Ledger
    const { data: ledger, error: ledgErr } = await supabase.from('stock_ledger').select('*');
    if (ledger && !ledgErr) {
      const local = getStockLedger();
      const map = new Map(local.map(l => [l.id, l]));
      ledger.forEach(l => {
        map.set(l.id, {
          ...l,
          date: l.date ? new Date(l.date) : new Date(),
        });
      });
      setItem(STORAGE_KEYS.STOCK_LEDGER, Array.from(map.values()));
    }

    // 10. Sync Employee Tasks
    const { data: tasks, error: taskErr } = await supabase.from('employee_tasks').select('*');
    if (tasks && !taskErr) {
      const local = getEmployeeTasks();
      const map = new Map(local.map(t => [t.id, t]));
      tasks.forEach(t => {
        map.set(t.id, {
          ...t,
          startTime: t.startTime ? new Date(t.startTime) : new Date(),
          endTime: t.endTime ? new Date(t.endTime) : undefined,
        });
      });
      setItem(STORAGE_KEYS.EMPLOYEE_TASKS, Array.from(map.values()));
    }

    // 11. Sync Attendance
    const { data: attendance, error: attErr } = await supabase.from('attendance').select('*');
    if (attendance && !attErr) {
      const local = getAttendance();
      const map = new Map(local.map(a => [a.id, a]));
      attendance.forEach(a => map.set(a.id, a));
      setItem(STORAGE_KEYS.ATTENDANCE, Array.from(map.values()));
    }

    // 12. Sync Settings
    const { data: settingsData, error: setErr } = await supabase.from('settings').select('*').eq('id', 'default').maybeSingle();
    if (settingsData && !setErr) {
      const { id, updatedAt, ...settingsObj } = settingsData;
      setItem(STORAGE_KEYS.SETTINGS, settingsObj);
    }

    // 13. Sync Daily Sales Reports
    const { data: reportsData, error: repErr } = await supabase.from('daily_sales_reports').select('*');
    if (reportsData && !repErr) {
      const local = getItem<DailySalesReport[]>(STORAGE_KEYS.SALES_REPORTS, []);
      const map = new Map(local.map(r => [r.id, r]));
      reportsData.forEach(r => map.set(r.id, r));
      setItem(STORAGE_KEYS.SALES_REPORTS, Array.from(map.values()));
    }

    console.log('Cloud data sync completed successfully.');
    setLastSyncTime(new Date());
  } catch (error) {
    console.error('Error during full sync from cloud:', error);
  }
}


// ─── Daily / Monthly Tax Reports ─────────────────────────────────────────────

/**
 * Compute a daily tax summary for a given date (defaults to today)
 */
export function computeDailyTaxReport(targetDate?: Date): DailySalesReport {
  const date = targetDate || new Date();
  // Use local date to avoid UTC offset issues
  const localDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const bills = getBills().filter(b => {
    const d = new Date(b.createdAt);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dStr === localDateStr;
  });

  const total_bills    = bills.length;
  const total_amount   = bills.reduce((s, b) => s + b.totalAmount, 0);
  const total_discount = bills.reduce((s, b) => s + b.discount, 0);
  const pending_amount = bills.reduce((s, b) => s + b.pendingAmount, 0);
  const cash_sales     = bills.filter(b => b.paymentMethod === 'cash').reduce((s, b) => s + b.paidAmount, 0);
  const upi_sales      = bills.filter(b => b.paymentMethod === 'upi').reduce((s, b) => s + b.paidAmount, 0);
  const card_sales     = 0; // card not currently used

  // Compute total GST from bill items
  const products = getProducts();
  const productMap = new Map(products.map(p => [p.id, p]));
  let total_tax = 0;
  bills.forEach(bill => {
    bill.items.forEach(item => {
      const product = productMap.get(item.productId);
      const gstPct = (product?.gstPercentage ?? (item as any).gstPercentage) ?? 0;
      if (gstPct > 0) {
        const baseAmount = item.totalPrice / (1 + gstPct / 100);
        total_tax += item.totalPrice - baseAmount;
      }
    });
  });

  return {
    id: `daily-${localDateStr}`,
    report_date: localDateStr,
    report_type: 'daily',
    total_bills,
    total_amount,
    total_tax,
    total_discount,
    cash_sales,
    upi_sales,
    card_sales,
    pending_amount,
    created_at: new Date().toISOString(),
  };
}

/**
 * Compute a monthly tax summary for a given year-month (defaults to current month)
 */
export function computeMonthlyTaxReport(year?: number, month?: number): DailySalesReport {
  const now = new Date();
  const y = year  ?? now.getFullYear();
  const m = month ?? now.getMonth(); // 0-indexed
  const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

  const bills = getBills().filter(b => {
    const d = new Date(b.createdAt);
    const dMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return dMonth === monthStr;
  });

  const total_bills    = bills.length;
  const total_amount   = bills.reduce((s, b) => s + b.totalAmount, 0);
  const total_discount = bills.reduce((s, b) => s + b.discount, 0);
  const pending_amount = bills.reduce((s, b) => s + b.pendingAmount, 0);
  const cash_sales     = bills.filter(b => b.paymentMethod === 'cash').reduce((s, b) => s + b.paidAmount, 0);
  const upi_sales      = bills.filter(b => b.paymentMethod === 'upi').reduce((s, b) => s + b.paidAmount, 0);
  const card_sales     = 0;

  const products = getProducts();
  const productMap = new Map(products.map(p => [p.id, p]));
  let total_tax = 0;
  bills.forEach(bill => {
    bill.items.forEach(item => {
      const product = productMap.get(item.productId);
      const gstPct = (product?.gstPercentage ?? (item as any).gstPercentage) ?? 0;
      if (gstPct > 0) {
        const baseAmount = item.totalPrice / (1 + gstPct / 100);
        total_tax += item.totalPrice - baseAmount;
      }
    });
  });

  return {
    id: `monthly-${monthStr}`,
    report_date: `${monthStr}-01`,
    report_type: 'monthly',
    total_bills,
    total_amount,
    total_tax,
    total_discount,
    cash_sales,
    upi_sales,
    card_sales,
    pending_amount,
    created_at: new Date().toISOString(),
  };
}

/**
 * Upsert a DailySalesReport into the Supabase daily_sales_reports table.
 * The table now has a TEXT primary key and a report_type column.
 */
export async function saveTaxReportToCloud(report: DailySalesReport): Promise<{ error: string | null }> {
  try {
    const reports = getItem<DailySalesReport[]>(STORAGE_KEYS.SALES_REPORTS, []);
    const idx = reports.findIndex(r => r.id === report.id);
    if (idx >= 0) {
      reports[idx] = report;
    } else {
      reports.push(report);
    }
    setItem(STORAGE_KEYS.SALES_REPORTS, reports);

    // Sync to Supabase cloud
    const { error } = await supabase
      .from('daily_sales_reports')
      .upsert([report], { onConflict: 'id' });

    if (error) {
      console.error('Failed to sync tax report to cloud:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Fetch all saved tax reports from localStorage.
 * Derives report_type from the id prefix (daily-* vs monthly-*).
 */
export async function getDailySalesReports(): Promise<DailySalesReport[]> {
  try {
    const reports = getItem<DailySalesReport[]>(STORAGE_KEYS.SALES_REPORTS, []);
    // Sort descending by date
    return reports.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
  } catch (err) {
    console.error('Failed to fetch daily sales reports:', err);
    return [];
  }
}
