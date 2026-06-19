import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Save, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductSearch } from '@/components/billing/ProductSearch';
import { BillCart } from '@/components/billing/BillCart';
import { BillingGrid } from '@/components/billing/BillingGrid';
import { BillLayout } from '@/components/billing/BillLayout';
import { CustomerSelector } from '@/components/billing/CustomerSelector';

import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { User as UserIcon, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { useBilling } from '@/contexts/BillingContext';
import { useToast } from '@/hooks/use-toast';
import { useBlocker } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getProducts,
  saveBill,
  getNextBillNumber,
  peekNextBillNumber,
  saveCustomer,
  savePendingDue,
  savePayment,
  getSettings,
} from '@/lib/storage';
import { Product, BillItem, Bill, BillPage, Customer, PaymentMethod } from '@/types';
import { cn } from '@/lib/utils';

// Capture a DOM element as a Base64 PNG
async function captureBillImage(el: HTMLElement): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  return canvas.toDataURL('image/png');
}

const ITEMS_PER_PAGE = 10;

export default function Billing() {
  const { user } = useAuth();
  const { connectionStatus } = useSystem();
  const { toast } = useToast();

  const {
    cartItems,
    selectedCustomer,
    isNewCustomer,
    addItem: handleAddItem,
    updateItem: handleUpdateItem,
    removeItem: handleRemoveItemByIndex,
    clearCart: handleClearCart,
    setCustomer: handleCustomerSelect
  } = useBilling();

  const [currentPage, setCurrentPage] = useState(1);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<BillItem | null>(null);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [printingBill, setPrintingBill] = useState<Bill | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Blocker for navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      cartItems.length > 0 && currentLocation.pathname !== nextLocation.pathname
  );

  // Load products
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    setProducts(getProducts());
  }, []);

  // Calculate total pages
  const totalPages = Math.ceil(cartItems.length / ITEMS_PER_PAGE);


  // Clear cart
  const onClearCartClick = useCallback(() => {
    handleClearCart();
    setCurrentPage(1);
  }, [handleClearCart]);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

  // Handle payment confirmation
  const handlePaymentConfirm = useCallback(async (
    method: PaymentMethod,
    paidAmount: number,
    isDelivery: boolean,
    dueDate?: Date
  ) => {
    if (!selectedCustomer || !user) return;

    // Check stock one last time before saving
    const products = getProducts();
    const insufficientItem = cartItems.find(item => {
      const product = products.find(p => p.id === item.productId);
      return product && item.quantity > product.stockQuantity;
    });

    if (insufficientItem) {
      toast({
        title: 'Insufficient Stock',
        description: `Cannot save bill. ${insufficientItem.productName} exceeds available stock.`,
        variant: 'destructive',
      });
      return;
    }

    // 1. Sort all items by category before creating the bill
    const sortedItems = [...cartItems].sort((a, b) => a.category.localeCompare(b.category));

    const settings = getSettings();
    const billNumber = getNextBillNumber();
    const pendingAmount = subtotal - paidAmount;

    // 2. Create bill pages with 10 items per page and calculate totals
    const createBillPages = (): BillPage[] => {
      const pages: BillPage[] = [];
      let currentCumulativeTotal = 0;

      for (let i = 0; i < sortedItems.length; i += ITEMS_PER_PAGE) {
        const pageItems = sortedItems.slice(i, i + ITEMS_PER_PAGE);
        const pageTotal = pageItems.reduce((sum, item) => sum + item.totalPrice, 0);
        currentCumulativeTotal += pageTotal;

        pages.push({
          pageNumber: Math.floor(i / ITEMS_PER_PAGE) + 1,
          items: pageItems,
          pageTotal: pageTotal,
          cumulativeTotal: currentCumulativeTotal,
        });
      }
      return pages;
    };

    // Create temp bill
    const tempBill: Bill = {
      id: `bill-${Date.now()}`,
      billNumber,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerNameTamil: selectedCustomer.nameTamil,
      customerPhone: selectedCustomer.phone,
      isNewCustomer,
      items: sortedItems,
      pages: createBillPages(),
      subtotal,
      discount: 0,
      totalAmount: subtotal,
      paidAmount,
      pendingAmount,
      paymentMethod: method,
      status: pendingAmount > 0 ? 'pending' : 'completed',
      employeeId: user.id,
      employeeName: user.name,
      employeeBarcode: user.barcode,
      dueDate,
      isDelivery,
      upiQrData: isDelivery || method === 'upi' ? settings.upiId : undefined,
      createdAt: new Date(),
      syncedToCloud: false,
      isOfflineBill: true,
    };

    // Set printing state to render the hidden preview
    setPrintingBill(tempBill);
    // Allow hidden print area to render
    await new Promise(r => setTimeout(r, 300));

    let imgBase64: string | undefined = undefined;
    try {
      if (printRef.current) {
        imgBase64 = await captureBillImage(printRef.current);
      }
    } catch (err) {
      console.error('Failed to capture bill image on pay & save:', err);
    } finally {
      setPrintingBill(null);
    }

    const finalBill: Bill = {
      ...tempBill,
      billImageBase64: imgBase64,
      syncedToCloud: false,          // will be set true by saveBill after Supabase confirms
      isOfflineBill: connectionStatus === 'offline',
    };

    // Save bill
    saveBill(finalBill);

    // Update customer
    const updatedCustomer: Customer = {
      ...selectedCustomer,
      totalPurchases: selectedCustomer.totalPurchases + subtotal,
      pendingDues: selectedCustomer.pendingDues + pendingAmount,
      lastVisit: new Date(),
      isRegular: (selectedCustomer.totalPurchases + subtotal) >= 5000,
    };
    saveCustomer(updatedCustomer);

    // Create pending due if applicable
    if (pendingAmount > 0 && dueDate) {
      savePendingDue({
        id: `due-${Date.now()}`,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        billId: finalBill.id,
        billNumber,
        totalAmount: subtotal,
        paidAmount,
        pendingAmount,
        dueDate,
        createdAt: new Date(),
        isOverdue: false,
      });
    }

    // Save payment record
    savePayment({
      id: `pay-${Date.now()}`,
      billId: finalBill.id,
      amount: paidAmount,
      method,
      receivedBy: user.name,
      createdAt: new Date(),
    });

    // Show success
    toast({
      title: 'Bill Created',
      description: `Bill ${billNumber} saved successfully. ${sortedItems.length} items sorted by category across ${Math.ceil(sortedItems.length / ITEMS_PER_PAGE)} pages.`,
    });

    // Clear cart for next bill
    handleClearCart();
    setShowPaymentDialog(false);
  }, [selectedCustomer, user, subtotal, cartItems, isNewCustomer, connectionStatus, toast, handleClearCart]);

  const handlePrint = useCallback(() => {
    if (cartItems.length === 0) return;
    window.print();
  }, [cartItems]);

  const hasInsufficientStock = cartItems.some(item => {
    const product = products.find(p => p.id === item.productId);
    return product && item.quantity > product.stockQuantity;
  });

  const canProceed = cartItems.length > 0 && selectedCustomer && !hasInsufficientStock;
  const settings = getSettings();

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-slate-800">New Bill</h1>
        <div className="flex items-center gap-4">
          <CustomerSelector
            selectedCustomer={selectedCustomer}
            onCustomerSelect={handleCustomerSelect}
            onClear={() => handleCustomerSelect(null)}
          />
          {cartItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClearCartClick} className="text-destructive border-destructive/20 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Bill
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto no-print">
        <BillingGrid
          items={cartItems}
          products={products}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItemByIndex}
          onAddItem={handleAddItem}
        />
      </div>

      <div className="mt-6 flex items-end justify-between border-t pt-6 bg-slate-50 -mx-6 px-6 -mb-6 pb-6 no-print">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 no-print cursor-pointer select-none mb-1" onClick={() => setIsDelivery(!isDelivery)}>
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              isDelivery ? "bg-accent border-accent text-white" : "border-slate-300 bg-white"
            )}>
              {isDelivery && <Check className="h-3 w-3" />}
            </div>
            <span className="text-sm font-medium text-slate-700">Delivery Order</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Items: {cartItems.length}</p>
            <p className="text-sm text-slate-500">Customer: {selectedCustomer?.name || 'Not Selected'}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Amount</p>
            <p className="text-4xl font-bold text-slate-900 font-mono">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8"
              disabled={!canProceed}
              onClick={handlePrint}
            >
              <Printer className="h-5 w-5 mr-2" />
              Print
            </Button>
            <Button
              size="lg"
              className="h-14 px-10 bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20"
              disabled={!canProceed}
              onClick={() => setShowPaymentDialog(true)}
            >
              <Save className="h-5 w-5 mr-2" />
              Pay & Save
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Bill Section */}
      <div className="hidden print:block">
        {(() => {
          // Sort items by category for the bill
          const sortedItems = [...cartItems].sort((a, b) => a.category.localeCompare(b.category));

          // Create temp bill object for BillLayout
          const tempBill: Bill = {
            id: 'temp-print',
            billNumber: peekNextBillNumber(),
            customerId: selectedCustomer?.id || 'cash',
            customerName: selectedCustomer?.name || 'Cash',
            customerNameTamil: selectedCustomer?.nameTamil || '',
            customerPhone: selectedCustomer?.phone || '',
            isNewCustomer: false,
            items: sortedItems,
            pages: [], // Will be handled by logic below if needed, but BillLayout typically expects pages
            subtotal,
            discount: 0,
            totalAmount: subtotal,
            paidAmount: 0,
            pendingAmount: subtotal,
            paymentMethod: 'cash',
            status: 'pending',
            employeeId: user?.id || '',
            employeeName: user?.name || '',
            isDelivery,
            createdAt: new Date(),
            syncedToCloud: false,
            isOfflineBill: false,
          };

          // Group into pages for the layout
          const ITEMS_PER_PAGE = 10;
          const pages: BillPage[] = [];
          let currentCumulativeTotal = 0;
          for (let i = 0; i < sortedItems.length; i += ITEMS_PER_PAGE) {
            const pageItems = sortedItems.slice(i, i + ITEMS_PER_PAGE);
            const pageTotal = pageItems.reduce((sum, item) => sum + item.totalPrice, 0);
            currentCumulativeTotal += pageTotal;
            pages.push({
              pageNumber: Math.floor(i / ITEMS_PER_PAGE) + 1,
              items: pageItems,
              pageTotal,
              cumulativeTotal: currentCumulativeTotal,
            });
          }
          tempBill.pages = pages;

          return <BillLayout bill={tempBill} isPrinting={true} />;
        })()}
      </div>


      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        totalAmount={subtotal}
        customerName={selectedCustomer?.name || 'Customer'}
        onConfirmPayment={handlePaymentConfirm}
        isDelivery={isDelivery}
        onDeliveryChange={setIsDelivery}
      />

      {/* Hidden printable area — captured by html2canvas */}
      <div className="fixed -left-[9999px] top-0 w-[794px]" aria-hidden>
        <div ref={printRef}>
          {printingBill && <BillLayout bill={printingBill} isPrinting={true} />}
        </div>
      </div>

      {/* Persistence / Navigation Guard Dialog */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Leave Billing Area?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have {cartItems.length} items in your current bill. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                handleClearCart();
                blocker.proceed?.();
              }}
              className="mt-0"
            >
              Leave & Clear Bill
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blocker.proceed?.()}
              className="bg-accent hover:bg-accent/90"
            >
              Keep My Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
