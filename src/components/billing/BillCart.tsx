import React from 'react';
import { Minus, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BillItem } from '@/types';
import { cn } from '@/lib/utils';

interface BillCartProps {
  items: BillItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditPrice: (itemId: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ITEMS_PER_PAGE = 10;

export function BillCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onEditPrice,
  currentPage,
  totalPages,
  onPageChange,
}: BillCartProps) {
  // Calculate page items
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageItems = items.slice(startIndex, endIndex);
  
  // Calculate totals
  const pageTotal = pageItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const cumulativeTotal = items.slice(0, endIndex).reduce((sum, item) => sum + item.totalPrice, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Group items by category for display
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, BillItem[]> = {};
    pageItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [pageItems]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-6xl mb-4">🛒</div>
        <p>Cart is empty</p>
        <p className="text-sm">Add products to start billing</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pagination Header */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pb-3 border-b mb-3">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Items List - Grouped by Category */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {category}
            </div>
            <div className="space-y-1">
              {categoryItems.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    'bill-item',
                    index % 2 === 0 ? 'bg-muted/30' : ''
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.productName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>₹{item.unitPrice.toFixed(2)} × {item.quantity}</span>
                      <button
                        onClick={() => onEditPrice(item.id)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-mono text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Item Total */}
                    <span className="font-mono font-semibold text-sm w-20 text-right">
                      ₹{item.totalPrice.toFixed(2)}
                    </span>
                    
                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Totals Footer */}
      <div className="mt-4 pt-4 border-t space-y-2">
        {totalPages > 1 && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Page Total</span>
              <span className="font-mono font-medium">₹{pageTotal.toFixed(2)}</span>
            </div>
            {currentPage < totalPages && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cumulative Total</span>
                <span className="font-mono font-medium">₹{cumulativeTotal.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <span>Grand Total</span>
          <span className="pos-amount">₹{grandTotal.toFixed(2)}</span>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {items.length} item{items.length !== 1 ? 's' : ''} in cart
        </div>
      </div>
    </div>
  );
}
