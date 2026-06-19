/**
 * Billing service for creating and managing bills.
 */

import { apiRequest } from './api';

export interface BillItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_percent: number;
}

export interface CreateBillRequest {
  customer_id?: number;
  customer_name?: string;
  mobile_number?: string;
  items: BillItem[];
  payment_method: string;
  discount?: number;
}

export interface Bill {
  id: number;
  bill_id: string;
  bill_number: string;
  customer_id?: number;
  employee_id: number;
  subtotal: number;
  total_tax: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  payment_method: string;
  created_at: string;
  items: any[];
}

class BillingService {
  /**
   * Create a new bill
   */
  async createBill(bill: CreateBillRequest, storeId: number): Promise<Bill> {
    return apiRequest<Bill>(
      'POST',
      '/api/billing/create',
      bill,
      { store_id: storeId }
    );
  }

  /**
   * Get bills for current user/store
   */
  async getBills(storeId: number, skip = 0, limit = 50): Promise<Bill[]> {
    return apiRequest<Bill[]>(
      'GET',
      '/api/billing/bills',
      undefined,
      { store_id: storeId, skip, limit }
    );
  }

  /**
   * Get specific bill by ID
   */
  async getBillById(billId: number, storeId: number): Promise<Bill> {
    return apiRequest<Bill>(
      'GET',
      `/api/billing/${billId}`,
      undefined,
      { store_id: storeId }
    );
  }

  /**
   * Get bill by bill number
   */
  async getBillByNumber(billNumber: string, storeId: number): Promise<Bill> {
    return apiRequest<Bill>(
      'GET',
      '/api/billing/search/by-number',
      undefined,
      { bill_number: billNumber, store_id: storeId }
    );
  }

  /**
   * Print bill (generate PDF)
   */
  async printBill(billId: number, storeId: number): Promise<Blob> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/billing/${billId}/print?store_id=${storeId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate bill PDF');
    }

    return response.blob();
  }

  /**
   * Calculate bill totals
   */
  calculateBillTotals(items: BillItem[], discount = 0) {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const lineSubtotal = item.quantity * item.unit_price;
      const discountAmount = (lineSubtotal * (item.discount_percent || 0)) / 100;
      const taxableAmount = lineSubtotal - discountAmount;
      const taxAmount = (taxableAmount * item.tax_percent) / 100;

      subtotal += lineSubtotal - discountAmount;
      totalTax += taxAmount;
    });

    const total = subtotal + totalTax - discount;

    return {
      subtotal,
      totalTax,
      discount,
      total,
    };
  }
}

export default new BillingService();
