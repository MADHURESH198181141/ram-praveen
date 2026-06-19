// User & Auth Types
export type UserRole = 'admin' | 'employee' | 'tracker';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  barcode?: string;
  phone?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loginTime: Date | null;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  nameTamil?: string;
  category: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  unit: string; // Keeping for compatibility, but will use uom
  uom: string;
  sku: string;
  stock: number; // Keeping for compatibility, but will use stockQuantity
  stockQuantity: number;
  costPrice: number;
  division?: string;
  conversionFactor: number;
  barcode?: string;
  hsnCode?: string;
  gstPercentage?: number;
  lastPurchaseDate?: Date;
  productImage?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  quantity: number;
  referenceId: string;
  date: Date;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  nameTamil?: string;
  phone: string;
  isRegular: boolean;
  totalPurchases: number;
  pendingDues: number;
  createdAt: Date;
  lastVisit: Date;
}

export interface Supplier {
  id: string;
  name: string;
  supplierCode: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  zip?: string;
  state?: string;
  country?: string;
  openingBalance?: number;
  creditLimit?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Billing Types
export interface BillItem {
  id: string;
  productId: string;
  productName: string;
  nameTamil?: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  hsnCode?: string;
}

export interface BillPage {
  pageNumber: number;
  items: BillItem[];
  pageTotal: number;
  cumulativeTotal: number;
}

export type PaymentMethod = 'cash' | 'upi' | 'mixed';
export type BillStatus = 'completed' | 'pending' | 'cancelled';

export interface Bill {
  id: string;
  billNumber: string;
  customerId: string;
  customerName: string;
  customerNameTamil?: string;
  customerPhone: string;
  isNewCustomer: boolean;
  items: BillItem[];
  pages: BillPage[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentMethod: PaymentMethod;
  status: BillStatus;
  employeeId: string;
  employeeName: string;
  employeeBarcode?: string;
  dueDate?: Date;
  isDelivery: boolean;
  upiQrData?: string;
  createdAt: Date;
  syncedToCloud: boolean;
  isOfflineBill: boolean;
  billImageBase64?: string; // Base64-encoded PNG snapshot of the printed bill
  billImagePath?: string; // Local storage path of the bill's PNG screenshot
}

// Payment Types
export interface Payment {
  id: string;
  billId: string;
  amount: number;
  method: PaymentMethod;
  receivedBy: string;
  createdAt: Date;
}

export interface PendingDue {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  billId: string;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: Date;
  createdAt: Date;
  isOverdue: boolean;
}

// System Types
export type ConnectionStatus = 'online' | 'offline';

export interface SystemState {
  connectionStatus: ConnectionStatus;
  lastSyncTime: Date | null;
  pendingSyncCount: number;
}

// Report Types
export interface DailySummary {
  date: Date;
  totalBills: number;
  totalSales: number;
  cashSales: number;
  upiSales: number;
  pendingDues: number;
  newCustomers: number;
}

export interface InventoryAlert {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
}

// Purchase Voucher Types
export interface PurchaseVoucherItem {
  id: string;
  voucherId: string;
  productId: string;
  productName: string;
  sku: string;
  uom: string;
  conversionFactor: number;
  quantity: number;
  quantityInSku: number;
  unitRate: number;
  grossAmount: number;
  discount: number;
  tax: number;
  netAmount: number;
  category: string;
  hsnCode?: string;
  gstPercentage?: number;
  description?: string;
  image?: string; // Optional temporary image for auto-creation
}

export interface PurchaseVoucher {
  id: string;
  voucherNumber: string;
  supplierId: string;
  supplierName: string;
  date: Date;
  branch: string;
  location: string;
  purchaseAccount?: string;
  executive?: string;
  remarks?: string;
  totalAmount: number;
  items: PurchaseVoucherItem[];
  createdAt: Date;
  updatedAt: Date;
}
// Task Tracker Types
export interface EmployeeTask {
  id: string;
  employeeId: string;
  employeeName: string;
  billNumber: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  status: 'active' | 'completed';
}

export interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  totalBills: number;
  totalTime: number; // in seconds
  averageTime: number; // in seconds
}

// Attendance Types
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkIn: string; // ISO timestamp
  checkOut?: string; // ISO timestamp
  totalHours?: number; // decimal hours
}

// Daily Sales Report (maps to Supabase daily_sales_reports table)
export interface DailySalesReport {
  id: string;
  store_id?: string;
  report_date: string; // YYYY-MM-DD
  report_type: 'daily' | 'monthly'; // distinguish daily vs monthly
  total_bills: number;
  total_amount: number;
  total_tax: number;
  total_discount: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  pending_amount: number;
  created_at?: string;
}

// Recycle Bin Types
export type RecycleBinEntityType =
  | 'customer'
  | 'bill'
  | 'product'
  | 'purchase_voucher'
  | 'pending_due'
  | 'payment'
  | 'employee';

export interface RecycleBinItem {
  id: string; // unique recycle bin entry id
  entityId: string; // original record id
  entityType: RecycleBinEntityType;
  entityLabel: string; // human-readable description e.g. "Rajesh Patel" or "INV-20260602-0001"
  data: unknown; // serialized original record(s)
  deletedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp (deletedAt + 30 days)
  restoreStock?: boolean; // for bills: whether stock was NOT restored on delete (can still restore)
}
