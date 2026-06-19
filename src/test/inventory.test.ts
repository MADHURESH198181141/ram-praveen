import { describe, it, expect, beforeEach, vi } from 'vitest';
import { savePurchaseVoucher, getProducts, initializeSampleData, saveCategory } from '../lib/storage';
import { PurchaseVoucher, Product, Category } from '../types';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Inventory Logic', () => {
    beforeEach(() => {
        localStorage.clear();
        // Initialize sample data to have some products
        initializeSampleData();
    });

    it('should update stock and weighted average cost correctly', () => {
        const products = getProducts();
        const product = products[0]; // Rice Premium 5kg, Stock: 50, Cost: 400

        expect(product.stockQuantity).toBe(50);
        expect(product.costPrice).toBe(400);

        const voucher: PurchaseVoucher = {
            id: 'v-1',
            voucherNumber: 'PV-001',
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            date: new Date(),
            branch: 'Main',
            location: 'Warehouse',
            totalAmount: 2000,
            items: [
                {
                    id: 'item-1',
                    voucherId: 'v-1',
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    uom: product.uom,
                    conversionFactor: 1,
                    quantity: 10,
                    quantityInSku: 10,
                    unitRate: 500, // Higher than current cost
                    grossAmount: 5000,
                    discount: 0,
                    tax: 0,
                    netAmount: 5000,
                    category: 'Groceries'
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        savePurchaseVoucher(voucher);

        const updatedProducts = getProducts();
        const updatedProduct = updatedProducts.find(p => p.id === product.id)!;

        // New Stock = 50 + 10 = 60
        expect(updatedProduct.stockQuantity).toBe(60);
        // New Cost = (50 * 400 + 10 * 500) / 60 = (20000 + 5000) / 60 = 25000 / 60 = 416.666...
        expect(updatedProduct.costPrice).toBeCloseTo(416.67, 1);
    });

    it('should reverse stock changes when editing a voucher', () => {
        const products = getProducts();
        const product = products[0]; // Rice Premium 5kg, Stock: 50, Cost: 400

        const voucher: PurchaseVoucher = {
            id: 'v-edit',
            voucherNumber: 'PV-EDIT',
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            date: new Date(),
            branch: 'Main',
            location: 'Warehouse',
            totalAmount: 1000,
            items: [
                {
                    id: 'item-1',
                    voucherId: 'v-edit',
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    uom: product.uom,
                    conversionFactor: 1,
                    quantity: 20,
                    quantityInSku: 20,
                    unitRate: 400,
                    grossAmount: 8000,
                    discount: 0,
                    tax: 0,
                    netAmount: 8000,
                    category: 'Groceries'
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Save initial
        savePurchaseVoucher(voucher);
        let p = getProducts().find(x => x.id === product.id)!;
        expect(p.stockQuantity).toBe(70);

        // Edit: change quantity from 20 to 10
        const editedVoucher: PurchaseVoucher = {
            ...voucher,
            items: [
                {
                    ...voucher.items[0],
                    quantity: 10,
                    quantityInSku: 10,
                    netAmount: 4000
                }
            ]
        };

        savePurchaseVoucher(editedVoucher);
        p = getProducts().find(x => x.id === product.id)!;
        // (70 - 20) + 10 = 60
        expect(p.stockQuantity).toBe(60);
    });

    it('should create a new product from purchase voucher if it does not exist', () => {
        const newProductName = 'New Exotic Fruit';
        const voucher: PurchaseVoucher = {
            id: 'v-new-prod',
            voucherNumber: 'PV-NEW',
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            date: new Date(),
            branch: 'Main',
            location: 'Warehouse',
            totalAmount: 1000,
            items: [
                {
                    id: 'item-new',
                    voucherId: 'v-new-prod',
                    productId: '', // Empty ID to trigger creation
                    productName: newProductName,
                    sku: 'EXOTIC-01',
                    uom: 'Nos',
                    conversionFactor: 1,
                    quantity: 10,
                    quantityInSku: 10,
                    unitRate: 100,
                    grossAmount: 1000,
                    discount: 0,
                    tax: 0,
                    netAmount: 1000,
                    category: 'Fruits'
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        savePurchaseVoucher(voucher);

        const products = getProducts();
        const newProduct = products.find(p => p.name === newProductName);

        expect(newProduct).toBeDefined();
        expect(newProduct?.name).toBe(newProductName);
        expect(newProduct?.category).toBe('Fruits');
        expect(newProduct?.stockQuantity).toBe(10);
        expect(newProduct?.costPrice).toBe(100);
    });
});
