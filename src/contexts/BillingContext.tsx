import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BillItem, Customer, Product } from '@/types';
import { getDraftBill, saveDraftBill, clearDraftBill } from '@/lib/storage';

interface BillingContextType {
    cartItems: BillItem[];
    selectedCustomer: Customer | null;
    isNewCustomer: boolean;
    setItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
    setCustomer: (customer: Customer | null, isNew?: boolean) => void;
    addItem: (product: Product) => void;
    addBulkItems: (items: BillItem[]) => void;
    updateItem: (index: number, updates: Partial<BillItem>) => void;
    removeItem: (index: number) => void;
    clearCart: () => void;
    hasDraft: boolean;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
    const [cartItems, setCartItems] = useState<BillItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load draft on mount
    useEffect(() => {
        const draft = getDraftBill();
        if (draft) {
            setCartItems(draft.items);
            setSelectedCustomer(draft.customer);
            setIsNewCustomer(draft.isNewCustomer);
        }
        setIsLoaded(true);
    }, []);

    // Save draft on changes
    useEffect(() => {
        if (!isLoaded) return;
        if (cartItems.length > 0 || selectedCustomer) {
            saveDraftBill({
                items: cartItems,
                customer: selectedCustomer,
                isNewCustomer
            });
        } else {
            clearDraftBill();
        }
    }, [cartItems, selectedCustomer, isNewCustomer, isLoaded]);

    const addItem = useCallback((product: Product) => {
        const newItem: BillItem = {
            id: `item-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            nameTamil: product.nameTamil,
            category: product.category,
            quantity: 0,
            unitPrice: product.price,
            totalPrice: 0,
        };
        setCartItems(prev => [...prev, newItem]);
    }, []);

    const addBulkItems = useCallback((items: BillItem[]) => {
        setCartItems(prev => [...prev, ...items]);
    }, []);

    const updateItem = useCallback((index: number, updates: Partial<BillItem>) => {
        setCartItems(prev => {
            const newItems = [...prev];
            if (newItems[index]) {
                newItems[index] = { ...newItems[index], ...updates };
            }
            return newItems;
        });
    }, []);

    const removeItem = useCallback((index: number) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
        setSelectedCustomer(null);
        setIsNewCustomer(false);
        clearDraftBill();
    }, []);

    const setCustomer = useCallback((customer: Customer | null, isNew: boolean = false) => {
        setSelectedCustomer(customer);
        setIsNewCustomer(isNew);
    }, []);

    return (
        <BillingContext.Provider value={{
            cartItems,
            selectedCustomer,
            isNewCustomer,
            setItems: setCartItems,
            setCustomer,
            addItem,
            addBulkItems,
            updateItem,
            removeItem,
            clearCart,
            hasDraft: cartItems.length > 0
        }}>
            {children}
        </BillingContext.Provider>
    );
}

export function useBilling() {
    const context = useContext(BillingContext);
    if (context === undefined) {
        throw new Error('useBilling must be used within a BillingProvider');
    }
    return context;
}
