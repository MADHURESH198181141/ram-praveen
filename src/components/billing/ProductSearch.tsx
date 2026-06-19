import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Product } from '@/types';
import { LetterSearch } from './LetterSearch';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

export function ProductSearch({ products, onProductSelect }: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    products.forEach(p => {
      if (p.isActive && p.name.length > 0) {
        letters.add(p.name[0].toUpperCase());
      }
    });
    return Array.from(letters);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.isActive) return false;
      
      // Letter filter
      if (selectedLetter && !p.name.toUpperCase().startsWith(selectedLetter)) {
        return false;
      }
      
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.barcode?.includes(query)
        );
      }
      
      return true;
    });
  }, [products, selectedLetter, searchQuery]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category].push(p);
    });
    return groups;
  }, [filteredProducts]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, category, or barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Letter Search */}
      <LetterSearch
        selectedLetter={selectedLetter}
        onLetterSelect={setSelectedLetter}
        availableLetters={availableLetters}
      />

      {/* Products Grid */}
      <div className="max-h-[400px] overflow-y-auto space-y-4">
        {Object.entries(groupedProducts).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No products found
          </div>
        ) : (
          Object.entries(groupedProducts).map(([category, categoryProducts]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {category}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {categoryProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => onProductSelect(product)}
                    className="product-card text-left"
                  >
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-semibold text-primary">
                        ₹{product.price.toFixed(2)}
                      </span>
                      <span className={cn(
                        'text-xs',
                        product.stock <= 5 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        Stock: {product.stock}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
