import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BillItem, Product } from '@/types';
import { getProducts } from '@/lib/storage';

interface PriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BillItem | null;
  onConfirm: (itemId: string, newPrice: number) => void;
}

export function PriceEditDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
}: PriceEditDialogProps) {
  const [newPrice, setNewPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (item) {
      setNewPrice(item.unitPrice.toString());
      const products = getProducts();
      const found = products.find(p => p.id === item.productId);
      setProduct(found || null);
      setError(null);
    }
  }, [item]);

  const handleConfirm = () => {
    if (!item || !product) return;

    const price = parseFloat(newPrice);
    
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid price');
      return;
    }

    // Check threshold
    if (price < product.minPrice) {
      setError(`Price cannot be below minimum threshold (₹${product.minPrice.toFixed(2)})`);
      return;
    }

    if (price > product.maxPrice) {
      setError(`Price cannot exceed maximum threshold (₹${product.maxPrice.toFixed(2)})`);
      return;
    }

    onConfirm(item.id, price);
    onOpenChange(false);
  };

  if (!item || !product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Price</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="font-medium">{item.productName}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Current Price: <span className="font-mono">₹{item.unitPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Unit Price</Label>
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => {
                setNewPrice(e.target.value);
                setError(null);
              }}
              className="font-mono"
              step="0.01"
              min={product.minPrice}
              max={product.maxPrice}
            />
          </div>

          {/* Price Threshold Info */}
          <div className="text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Min Price:</span>
              <span className="font-mono">₹{product.minPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Max Price:</span>
              <span className="font-mono">₹{product.maxPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Update Price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
