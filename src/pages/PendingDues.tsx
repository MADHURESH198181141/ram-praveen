import React, { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Phone, Calendar, DollarSign, Check, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getPendingDues,
  updatePendingDue,
  deletePendingDueRecord,
  clearPendingDue,
  savePayment,
  getCustomers,
  saveCustomer,
  getBills,
  saveBill,
} from '@/lib/storage';
import { PendingDue, PaymentMethod } from '@/types';
import { Navigate } from 'react-router-dom';
import { format, isAfter, isSameDay } from 'date-fns';

export default function PendingDues() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [dues, setDues] = useState<PendingDue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedDue, setSelectedDue] = useState<PendingDue | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  const loadDues = useCallback(() => {
    let allDues = getPendingDues();
    const now = new Date();
    allDues = allDues.map(due => ({
      ...due,
      isOverdue: isAfter(now, new Date(due.dueDate)),
    }));
    allDues.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    setDues(allDues);
  }, []);

  useEffect(() => {
    loadDues();
    const handler = () => loadDues();
    window.addEventListener('storage-updated', handler);
    return () => window.removeEventListener('storage-updated', handler);
  }, [loadDues]);

  const filteredDues = dues.filter(d => {
    const matchesSearch =
      d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.customerPhone.includes(searchQuery) ||
      d.billNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !selectedDate || isSameDay(new Date(d.createdAt), selectedDate);
    return matchesSearch && matchesDate;
  });

  const totalDue = dues.reduce((sum, d) => sum + d.pendingAmount, 0);
  const overdueDues = dues.filter(d => d.isOverdue);
  const overdueAmount = overdueDues.reduce((sum, d) => sum + d.pendingAmount, 0);

  const handleClearDue = () => {
    if (!selectedDue || !user) return;

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedDue.pendingAmount) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid payment amount (between ₹0.01 and ₹' + selectedDue.pendingAmount.toFixed(2) + ')',
        variant: 'destructive',
      });
      return;
    }

    // Record payment
    savePayment({
      id: `pay-${Date.now()}`,
      billId: selectedDue.billId,
      amount,
      method: 'cash' as PaymentMethod,
      receivedBy: user.name,
      createdAt: new Date(),
    });

    // Update bill
    const bills = getBills();
    const bill = bills.find(b => b.id === selectedDue.billId);
    if (bill) {
      bill.paidAmount += amount;
      bill.pendingAmount = Math.max(0, bill.pendingAmount - amount);
      if (bill.pendingAmount <= 0) {
        bill.status = 'completed';
      }
      saveBill(bill);
    }

    // Update customer
    const customers = getCustomers();
    const customer = customers.find(c => c.id === selectedDue.customerId);
    if (customer) {
      customer.pendingDues = Math.max(0, customer.pendingDues - amount);
      saveCustomer(customer);
    }

    const newPending = selectedDue.pendingAmount - amount;

    if (newPending <= 0) {
      // Fully paid — clear the due record
      clearPendingDue(selectedDue.id);
      toast({
        title: '✅ Due cleared!',
        description: `Full payment of ₹${amount.toFixed(2)} received from ${selectedDue.customerName}. Due is now cleared.`,
      });
    } else {
      // Partial payment — update in place (BUG FIX: was deleting without re-saving)
      const updatedDue: PendingDue = {
        ...selectedDue,
        paidAmount: selectedDue.paidAmount + amount,
        pendingAmount: newPending,
      };
      updatePendingDue(updatedDue);
      toast({
        title: 'Partial payment recorded',
        description: `₹${amount.toFixed(2)} received. Remaining balance: ₹${newPending.toFixed(2)}`,
      });
    }

    setSelectedDue(null);
    setPayAmount('');
    loadDues();
  };

  const handleDeleteDue = () => {
    if (!deleteTargetId) return;
    const due = dues.find(d => d.id === deleteTargetId);
    deletePendingDueRecord(deleteTargetId);
    loadDues();
    setDeleteTargetId(null);
    toast({
      title: 'Record deleted',
      description: `Pending record for ${due?.customerName} moved to Recycle Bin.`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pending Dues</h1>
        <p className="text-muted-foreground">Track and collect pending payments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pending/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-pending" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">₹{totalDue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueDues.length > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{overdueDues.length}</div>
                <div className="text-sm text-muted-foreground">Overdue Bills</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-destructive">
                  ₹{overdueAmount.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Overdue Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, phone, or bill number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-[240px]",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Filter by date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarUI
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {selectedDate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(undefined)}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dues Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Bill No.</TableHead>
                <TableHead className="text-right">Bill Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDues.map((due) => (
                <TableRow key={due.id} className={due.isOverdue ? 'bg-destructive/5' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{due.customerName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {due.customerPhone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{due.billNumber}</TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{due.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-success">
                    ₹{due.paidAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-pending">
                    ₹{due.pendingAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(due.dueDate), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {due.isOverdue ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Overdue
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Clear Due (full amount preset) */}
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDue(due);
                          setPayAmount(due.pendingAmount.toString());
                        }}
                        title="Collect payment"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Collect
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTargetId(due.id)}
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No pending dues found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Collect Payment Dialog */}
      <Dialog open={!!selectedDue} onOpenChange={() => setSelectedDue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
          </DialogHeader>

          {selectedDue && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="font-medium">{selectedDue.customerName}</div>
                <div className="text-sm text-muted-foreground">{selectedDue.customerPhone}</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Bill: {selectedDue.billNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Pending Amount</div>
                  <div className="text-xl font-bold font-mono text-pending">
                    ₹{selectedDue.pendingAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due Date</div>
                  <div className="font-medium">
                    {format(new Date(selectedDue.dueDate), 'dd MMM yyyy')}
                  </div>
                </div>
              </div>

              <div>
                <Label>Amount Received (₹)</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="font-mono text-lg mt-1"
                  max={selectedDue.pendingAmount}
                  min={0.01}
                  step={0.01}
                />
                {/* Show remaining balance preview */}
                {payAmount && !isNaN(parseFloat(payAmount)) && parseFloat(payAmount) > 0 && parseFloat(payAmount) < selectedDue.pendingAmount && (
                  <div className="mt-1 text-sm text-amber-600 font-medium">
                    Remaining balance after payment: ₹{(selectedDue.pendingAmount - parseFloat(payAmount)).toFixed(2)}
                  </div>
                )}
                {payAmount && parseFloat(payAmount) >= selectedDue.pendingAmount && (
                  <div className="mt-1 text-sm text-success font-medium">
                    ✅ This will fully clear the due
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  {/* Clear Due — full amount shortcut */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setPayAmount(selectedDue.pendingAmount.toString())}
                  >
                    Clear Due (₹{selectedDue.pendingAmount.toFixed(0)})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPayAmount((selectedDue.pendingAmount / 2).toFixed(2))}
                  >
                    Half
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDue(null)}>
              Cancel
            </Button>
            <Button onClick={handleClearDue}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pending Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the pending due record for{' '}
              <strong>{dues.find(d => d.id === deleteTargetId)?.customerName}</strong>{' '}
              (Bill: {dues.find(d => d.id === deleteTargetId)?.billNumber}).
              <span className="block mt-1 text-xs">
                Note: The original bill will remain intact. Only the due record is deleted.
                It will be kept in Recycle Bin for 30 days.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteDue}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
