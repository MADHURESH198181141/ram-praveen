/**
 * Products service for managing products, categories, and inventory.
 */

import { apiRequest } from './api';

export interface Product {
  id: number;
  product_id: string;
  name: string;
  hsn_code?: string;
  description?: string;
  price: number;
  cost_price?: number;
  category_id: number;
  unit: string;
  gst_rate: number;
  is_active: boolean;
  inventory?: {
    quantity: number;
    last_updated: string;
  };
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface CreateProductRequest {
  name: string;
  hsn_code?: string;
  description?: string;
  category_id: number;
  price: number;
  cost_price?: number;
  unit?: string;
  gst_rate?: number;
  initial_quantity?: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  cost_price?: number;
  unit?: string;
  gst_rate?: number;
  is_active?: boolean;
}

class ProductsService {
  /**
   * Get all categories for a store
   */
  async getCategories(storeId: number): Promise<Category[]> {
    return apiRequest<Category[]>(
      'GET',
      '/api/products/categories',
      undefined,
      { store_id: storeId }
    );
  }

  /**
   * Create a new category
   */
  async createCategory(
    name: string,
    description: string | undefined,
    storeId: number
  ): Promise<Category> {
    return apiRequest<Category>(
      'POST',
      '/api/products/categories',
      { name, description },
      { store_id: storeId }
    );
  }

  /**
   * Get all products for a store
   */
  async getProducts(
    storeId: number,
    categoryId?: number,
    search?: string
  ): Promise<Product[]> {
    const params: Record<string, any> = { store_id: storeId };
    if (categoryId) params.category_id = categoryId;
    if (search) params.search = search;

    return apiRequest<Product[]>(
      'GET',
      '/api/products',
      undefined,
      params
    );
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: number, storeId: number): Promise<Product> {
    return apiRequest<Product>(
      'GET',
      `/api/products/${productId}`,
      undefined,
      { store_id: storeId }
    );
  }

  /**
   * Create a new product
   */
  async createProduct(
    product: CreateProductRequest,
    storeId: number
  ): Promise<Product> {
    return apiRequest<Product>(
      'POST',
      '/api/products',
      product,
      { store_id: storeId }
    );
  }

  /**
   * Update a product
   */
  async updateProduct(
    productId: number,
    updates: UpdateProductRequest,
    storeId: number
  ): Promise<Product> {
    return apiRequest<Product>(
      'PUT',
      `/api/products/${productId}`,
      updates,
      { store_id: storeId }
    );
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: number, storeId: number): Promise<void> {
    await apiRequest(
      'DELETE',
      `/api/products/${productId}`,
      undefined,
      { store_id: storeId }
    );
  }

  /**
   * Search products by name or HSN code
   */
  async searchProducts(
    query: string,
    storeId: number,
    categoryId?: number
  ): Promise<Product[]> {
    return this.getProducts(storeId, categoryId, query);
  }
}

export default new ProductsService();
