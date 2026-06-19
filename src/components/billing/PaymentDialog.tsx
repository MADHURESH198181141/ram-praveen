import React, { useState } from 'react';
import { CreditCard, Banknote, QrCode, Calendar, AlertCircle } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { PaymentMethod } from '@/types';
import { cn } from '@/lib/utils';
import { getSettings } from '@/lib/storage';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  customerName: string;
  onConfirmPayment: (
    method: PaymentMethod,
    paidAmount: number,
    isDelivery: boolean,
    dueDate?: Date
  ) => void;
  isDelivery?: boolean;
  onDeliveryChange?: (checked: boolean) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  customerName,
  onConfirmPayment,
  isDelivery: externalIsDelivery,
  onDeliveryChange,
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState(totalAmount.toString());
  const [internalIsDelivery, setInternalIsDelivery] = useState(false);

  const isDelivery = externalIsDelivery !== undefined ? externalIsDelivery : internalIsDelivery;
  const setIsDelivery = onDeliveryChange || setInternalIsDelivery;

  const [dueDays, setDueDays] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const settings = getSettings();
  const paid = parseFloat(paidAmount) || 0;
  const pending = totalAmount - paid;
  const hasPartialPayment = pending > 0;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dueDate = hasPartialPayment
        ? new Date(Date.now() + parseInt(dueDays) * 24 * 60 * 60 * 1000)
        : undefined;

      await onConfirmPayment(paymentMethod, paid, isDelivery, dueDate);

      // Reset state
      setPaidAmount(totalAmount.toString());
      setPaymentMethod('cash');
      setIsDelivery(false);
      setDueDays('7');
    } catch (err) {
      console.error('Payment confirmation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [
    totalAmount,
    Math.ceil(totalAmount / 100) * 100, // Round up to nearest 100
    Math.ceil(totalAmount / 500) * 500, // Round up to nearest 500
    0, // Zero for full pending
  ].filter((v, i, a) => a.indexOf(v) === i && v >= 0); // Unique values

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Total Display */}
          <div className="text-center bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Amount</div>
            <div className="pos-amount-large">₹{totalAmount.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground mt-1">for {customerName}</div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cash')}
                className="flex-col h-auto py-3"
              >
                <Banknote className="h-5 w-5 mb-1" />
                <span className="text-xs">Cash</span>
              </Button>
              <Button
                variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('upi')}
                className="flex-col h-auto py-3"
              >
                <QrCode className="h-5 w-5 mb-1" />
                <span className="text-xs">UPI</span>
              </Button>
              <Button
                variant={paymentMethod === 'mixed' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('mixed')}
                className="flex-col h-auto py-3"
              >
                <CreditCard className="h-5 w-5 mb-1" />
                <span className="text-xs">Mixed</span>
              </Button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount Received</Label>
            <Input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="text-lg font-mono"
              min="0"
              max={totalAmount}
              step="0.01"
            />
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setPaidAmount(amount.toString())}
                  className={cn(
                    'text-xs',
                    parseFloat(paidAmount) === amount && 'border-primary'
                  )}
                >
                  ₹{amount.toFixed(0)}
                </Button>
              ))}
            </div>
          </div>

          {/* Pending Amount Warning */}
          {hasPartialPayment && (
            <div className="bg-pending/10 border border-pending/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-pending shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-pending">Partial Payment</div>
                  <div className="text-sm text-muted-foreground">
                    Pending balance: <span className="font-mono font-semibold">₹{pending.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Due in</Label>
                <Input
                  type="number"
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  className="w-20 h-8"
                  min="1"
                  max="90"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}

          {/* Delivery Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="delivery"
              checked={isDelivery}
              onCheckedChange={(checked) => setIsDelivery(checked as boolean)}
            />
            <Label htmlFor="delivery" className="text-sm cursor-pointer">
              This is a delivery order (include UPI QR on bill)
            </Label>
          </div>

          {/* UPI ID Display */}
          {(isDelivery || paymentMethod === 'upi') && (
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">UPI ID</div>
              <div className="font-mono font-medium">{settings.upiId}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
            {isSubmitting ? 'Processing...' : (hasPartialPayment ? 'Confirm Partial Payment' : 'Complete Payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
