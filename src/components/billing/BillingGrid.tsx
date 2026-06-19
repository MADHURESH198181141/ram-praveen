import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Search, AlertTriangle, PackageSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Product, BillItem } from '@/types';
import { cn } from '@/lib/utils';

interface BillingGridProps {
  items: BillItem[];
  products: Product[];
  onUpdateItem: (index: number, updates: Partial<BillItem>) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: (product: Product) => void;
}

export function BillingGrid({ items, products, onUpdateItem, onRemoveItem, onAddItem }: BillingGridProps) {
  const { toast } = useToast();
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const inputRefs = useRef<Array<Array<HTMLInputElement | null>>>([]);

  // Filter products for the active search
  const filteredProducts = products.filter(p =>
    p.isActive && (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery)
    )
  ).slice(0, 10);

  // Reset suggestion index when search query changes
  useEffect(() => {
    setSuggestionIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    // Handle suggestion navigation if search is active
    if (activeSearchIndex === rowIndex && colIndex === 0 && searchQuery && filteredProducts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % filteredProducts.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleProductSelect(filteredProducts[suggestionIndex], rowIndex);
        // After selection, handleProductSelect already moves focus to Qty
        return;
      } else if (e.key === 'Escape') {
        setActiveSearchIndex(null);
        setSearchQuery('');
        return;
      }
    }

    // Normal grid navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(rowIndex + 1, colIndex);
    } else if (e.key === 'ArrowUp') {
      // If suggestions are active and we are not at the top of suggestions, 
      // the first handleKeyDown block will handle it.
      // Otherwise, we navigate to the previous row.
      if (!(activeSearchIndex === rowIndex && colIndex === 0 && searchQuery && filteredProducts.length > 0 && suggestionIndex > 0)) {
        e.preventDefault();
        focusCell(rowIndex - 1, colIndex);
      }
    } else if (e.key === 'ArrowRight') {
      const isAtEnd = (e.target as HTMLInputElement).selectionEnd === (e.target as HTMLInputElement).value.length;
      if (isAtEnd || (e.target as HTMLInputElement).type === 'number') {
        focusCell(rowIndex, colIndex + 1);
      }
    } else if (e.key === 'ArrowLeft') {
      const isAtStart = (e.target as HTMLInputElement).selectionStart === 0;
      if (isAtStart || (e.target as HTMLInputElement).type === 'number') {
        focusCell(rowIndex, colIndex - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === 0) {
        // From Product Description, move to Qty in the same row
        focusCell(rowIndex, 1);
      } else if (colIndex === 1) {
        // From Qty, validate value from the input field directly
        const val = Number((e.target as HTMLInputElement).value);
        const product = products.find(p => p.id === items[rowIndex].productId);

        if (product && val > product.stockQuantity) {
          toast({
            title: 'Insufficient Stock',
            description: `Only ${product.stockQuantity} ${product.uom} available for ${product.name}`,
            variant: 'destructive',
          });
          return;
        }

        if (val > 0) {
          // Move to next row item description and open search
          if (rowIndex < items.length - 1) {
            focusCell(rowIndex + 1, 0, true);
          } else {
            // Last existing row, move to "New Item Row"
            focusCell(items.length, 0, true);
          }
        }
      }
    }
  };


  const handleProductSelect = (product: Product, index: number) => {
    if (index === items.length) {
      onAddItem(product);
    } else {
      onUpdateItem(index, {
        productId: product.id,
        productName: product.name,
        category: product.category,
        unitPrice: product.price,
        totalPrice: (items[index]?.quantity || 0) * product.price
      });
    }

    if (product.stockQuantity <= 0) {
      toast({
        title: 'Out of Stock',
        description: `${product.name} is currently out of stock.`,
        variant: 'destructive',
      });
    }

    setActiveSearchIndex(null);
    setSearchQuery('');
    setSuggestionIndex(0);
    // Focus quantity cell after selection
    setTimeout(() => focusCell(index, 1), 0);
  };

  const handleSearchChange = (val: string, index: number) => {
    setSearchQuery(val);
    setActiveSearchIndex(index);
    if (!val) {
      setSuggestionIndex(0);
    }
  };

  const setInputRef = (rowIndex: number, colIndex: number, el: HTMLInputElement | null) => {
    if (!inputRefs.current[rowIndex]) {
      inputRefs.current[rowIndex] = [];
    }
    inputRefs.current[rowIndex][colIndex] = el;
  };

  const focusCell = useCallback((row: number, col: number, openSearch: boolean = false) => {
    // Small delay to ensure refs are populated after render
    setTimeout(() => {
      const targetRow = inputRefs.current[row];
      if (targetRow && targetRow[col]) {
        const el = targetRow[col];
        el?.focus();
        setFocusedCell({ row, col });

        if (col === 0 && openSearch) {
          setActiveSearchIndex(row);
          setSearchQuery('');
        }
      }
    }, 50);
  }, []);


  return (
    <div className="w-full border rounded-lg bg-white shadow-sm overflow-visible">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="w-12 py-2 px-3 text-left font-semibold text-slate-600 border-r">#</th>
            <th className="py-2 px-3 text-left font-semibold text-slate-600 border-r">Item Description</th>
            <th className="w-24 py-2 px-3 text-center font-semibold text-slate-600 border-r">Qty</th>
            <th className="w-32 py-2 px-3 text-right font-semibold text-slate-600 border-r">Price</th>
            <th className="w-32 py-2 px-3 text-right font-semibold text-slate-600 border-r">Total</th>
            <th className="w-10 py-2 px-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="border-b hover:bg-slate-50 group">
              <td className="py-1 px-3 text-slate-400 font-mono border-r">{index + 1}</td>
              <td className="py-0 px-0 relative border-r">
                <input
                  ref={el => setInputRef(index, 0, el)}
                  className="w-full h-9 px-3 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                  value={activeSearchIndex === index ? searchQuery : item.productName}
                  onChange={(e) => handleSearchChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index, 0)}
                  onFocus={() => {
                    setFocusedCell({ row: index, col: 0 });
                    setActiveSearchIndex(index);
                  }}
                  onBlur={() => {
                    // Slight delay to allow clicks on suggestions
                    setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200);
                  }}
                  placeholder="Type item name..."
                />
                {activeSearchIndex === index && searchQuery && (
                  <div className="absolute left-0 top-full w-full bg-white border shadow-xl z-50 rounded-b-md overflow-hidden">
                    {filteredProducts.map((p, pIndex) => (
                      <button
                        key={p.id}
                        className={cn(
                          "w-full text-left px-3 py-2 border-b last:border-0 flex justify-between gap-4 transition-colors",
                          suggestionIndex === pIndex ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-slate-700"
                        )}
                        onMouseDown={() => handleProductSelect(p, index)}
                        onMouseEnter={() => setSuggestionIndex(pIndex)}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className={cn(
                          "font-mono",
                          suggestionIndex === pIndex ? "text-blue-100" : "text-slate-500"
                        )}>₹{p.price.toFixed(2)}</span>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="px-3 py-2 text-slate-400">No products found</div>
                    )}
                  </div>
                )}
              </td>
              <td className="py-0 px-0 border-r text-center">
                <input
                  ref={el => setInputRef(index, 1, el)}
                  className="w-full h-9 px-2 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none text-center font-mono"
                  type="number"
                  value={item.quantity === 0 ? '' : item.quantity}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    onUpdateItem(index, { quantity: val, totalPrice: val * item.unitPrice });
                  }}
                  onKeyDown={(e) => handleKeyDown(e, index, 1)}
                  onFocus={() => {
                    setFocusedCell({ row: index, col: 1 });
                    (inputRefs.current[index]?.[1] as HTMLInputElement)?.select();
                  }}
                />
                {(() => {
                  const product = products.find(p => p.id === item.productId);
                  if (product && item.quantity > product.stockQuantity) {
                    return (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 group/warning">
                        <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
                        <div className="hidden group-hover/warning:block absolute bottom-full right-0 mb-2 px-2 py-1 bg-destructive text-white text-[10px] rounded shadow-lg whitespace-nowrap z-[100]">
                          Insufficient Stock ({product.stockQuantity} avail.)
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </td>
              <td className="py-0 px-0 border-r text-right">
                <input
                  ref={el => setInputRef(index, 2, el)}
                  className="w-full h-9 px-2 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none text-right font-mono"
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => onUpdateItem(index, { unitPrice: Number(e.target.value), totalPrice: item.quantity * Number(e.target.value) })}
                  onKeyDown={(e) => handleKeyDown(e, index, 2)}
                  onFocus={() => setFocusedCell({ row: index, col: 2 })}
                />
              </td>
              <td className="py-1 px-3 text-right font-mono font-medium border-r text-slate-700">
                ₹{item.totalPrice.toFixed(2)}
              </td>
              <td className="py-1 px-1 text-center">
                <button
                  onClick={() => onRemoveItem(index)}
                  className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}

          {/* New Item Row */}
          <tr className="border-b hover:bg-slate-50">
            <td className="py-1 px-3 text-slate-300 font-mono border-r">{items.length + 1}</td>
            <td className="py-0 px-0 relative border-r">
              <div className="flex items-center px-3">
                <Search className="h-4 w-4 text-slate-400 mr-2" />
                <input
                  ref={el => setInputRef(items.length, 0, el)}
                  className="flex-1 h-9 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                  value={activeSearchIndex === items.length ? searchQuery : ''}
                  onChange={(e) => handleSearchChange(e.target.value, items.length)}
                  onFocus={() => {
                    setFocusedCell({ row: items.length, col: 0 });
                    setActiveSearchIndex(items.length);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, items.length, 0)}
                  onBlur={() => {
                    setTimeout(() => { if (activeSearchIndex === items.length) setActiveSearchIndex(null); }, 200);
                  }}
                  placeholder="Add new item..."
                />
              </div>
              {activeSearchIndex === items.length && searchQuery && (
                <div className="absolute left-0 top-full w-full bg-white border shadow-xl z-50 rounded-b-md overflow-hidden">
                  {filteredProducts.map((p, pIndex) => (
                    <button
                      key={p.id}
                      className={cn(
                        "w-full text-left px-3 py-2 border-b last:border-0 flex justify-between gap-4 transition-colors",
                        suggestionIndex === pIndex ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-slate-700"
                      )}
                      onMouseDown={() => handleProductSelect(p, items.length)}
                      onMouseEnter={() => setSuggestionIndex(pIndex)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className={cn(
                        "font-mono",
                        suggestionIndex === pIndex ? "text-blue-100" : "text-slate-500"
                      )}>₹{p.price.toFixed(2)}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-3 py-2 text-slate-400">No products found</div>
                  )}
                </div>
              )}
            </td>
            <td className="bg-slate-50/50 border-r"></td>
            <td className="bg-slate-50/50 border-r"></td>
            <td className="bg-slate-50/50 border-r"></td>
            <td className="bg-slate-50/50"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
