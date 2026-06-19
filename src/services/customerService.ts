/**
 * Customers service for managing customer data and payment history.
 */

import { apiRequest } from './api';

export interface Customer {
  id: number;
  customer_id: string;
  name: string;
  mobile_number?: string;
  email?: string;
  address?: string;
  customer_type: 'new' | 'regular';
  pending_amount: number;
  total_purchase: number;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  bills: Array<{ bill_id: number; bill_number: string; amount: number }>;
  payments: any[];
}

export interface CreateCustomerRequest {
  name: string;
  mobile_number?: string;
  email?: string;
  address?: string;
  customer_type?: 'new' | 'regular';
}

export interface UpdateCustomerRequest {
  name?: string;
  mobile_number?: string;
  email?: string;
  address?: string;
  customer_type?: 'new' | 'regular';
}

class CustomersService {
  /**
   * Create a new customer
   */
  async createCustomer(
    customer: CreateCustomerRequest,
    storeId: number
  ): Promise<Customer> {
    return apiRequest<Customer>(
      'POST',
      '/api/customers/',
      customer,
      { store_id: storeId }
    );
  }

  /**
   * Get all customers for a store
   */
  async getCustomers(
    storeId: number,
    search?: string,
    skip = 0,
    limit = 100
  ): Promise<Customer[]> {
    const params: Record<string, any> = { store_id: storeId, skip, limit };
    if (search) params.search = search;

    return apiRequest<Customer[]>(
      'GET',
      '/api/customers/',
      undefined,
      params
    );
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: number, storeId: number): Promise<CustomerDetail> {
    return apiRequest<CustomerDetail>(
      'GET',
      `/api/customers/${customerId}`,
      undefined,
      { store_id: storeId }
    );
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: number,
    updates: UpdateCustomerRequest,
    storeId: number
  ): Promise<Customer> {
    return apiRequest<Customer>(
      'PUT',
      `/api/customers/${customerId}`,
      updates,
      { store_id: storeId }
    );
  }

  /**
   * Search customer by mobile number
   */
  async searchByMobile(
    mobileNumber: string,
    storeId: number
  ): Promise<{ found: boolean; customer?: Customer }> {
    return apiRequest(
      'GET',
      '/api/customers/search/by-mobile',
      undefined,
      { mobile_number: mobileNumber, store_id: storeId }
    );
  }

  /**
   * Get customer payment history
   */
  async getPaymentHistory(customerId: number, storeId: number): Promise<any[]> {
    const customer = await this.getCustomerById(customerId, storeId);
    return customer.payments || [];
  }

  /**
   * Get customer bills
   */
  async getCustomerBills(customerId: number, storeId: number): Promise<any[]> {
    const customer = await this.getCustomerById(customerId, storeId);
    return customer.bills || [];
  }
}

export default new CustomersService();
