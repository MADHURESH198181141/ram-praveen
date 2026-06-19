import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Calendar, Printer, Eye, Cloud, CloudOff, RefreshCw, ImageIcon, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BillLayout } from '@/components/billing/BillLayout';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAuth } from '@/contexts/AuthContext';
import { getBills, syncAllFromCloud, saveBill, deleteBill } from '@/lib/storage';
import { Bill } from '@/types';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import storageService from '@/services/storageService';

// ─── Capture a DOM element as a Base64 PNG ───────────────────────────────────
async function captureBillImage(el: HTMLElement): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  return canvas.toDataURL('image/png');
}

export default function Bills() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [loadedBillImage, setLoadedBillImage] = useState<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deleteTargetBill, setDeleteTargetBill] = useState<Bill | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Load bill image dynamically from disk when selectedBill changes
  useEffect(() => {
    const loadImage = async () => {
      if (selectedBill?.billImagePath) {
        try {
          const base64 = await storageService.readBillImage(selectedBill.billImagePath);
          setLoadedBillImage(base64);
        } catch (err) {
          console.error('Failed to load bill image from disk:', err);
          setLoadedBillImage(null);
        }
      } else if (selectedBill?.billImageBase64) {
        setLoadedBillImage(selectedBill.billImageBase64);
      } else {
        setLoadedBillImage(null);
      }
    };
    loadImage();
    setShowSnapshot(false); // Reset accordion to collapsed when switching bills
  }, [selectedBill]);

  // ── Load bills from localStorage ──────────────────────────────────────────
  const loadLocalBills = useCallback(() => {
    let allBills = getBills();
    if (!isAdmin && user) {
      allBills = allBills.filter(b => b.employeeId === user.id);
    }
    allBills.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setBills(allBills);
  }, [isAdmin, user]);

  // Listen for realtime storage updates
  useEffect(() => {
    const handler = () => loadLocalBills();
    window.addEventListener('storage-updated', handler);
    return () => window.removeEventListener('storage-updated', handler);
  }, [loadLocalBills]);

  // ── Sync with Supabase (cloud) ─────────────────────────────────────────────
  const doSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncAllFromCloud();
      loadLocalBills();
      toast({ title: 'Synced!', description: 'All data pushed and refreshed from cloud.' });
    } catch (err) {
      console.error('Cloud sync error:', err);
      toast({ title: 'Sync failed', description: 'Could not reach Supabase. Bills shown from local storage.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }, [loadLocalBills, toast]);

  // ── On mount: load local then sync ────────────────────────────────────────
  useEffect(() => {
    loadLocalBills();
    doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Print + capture image ─────────────────────────────────────────────────
  const handlePrint = useCallback(async (bill: Bill) => {
    setSelectedBill(bill);
    setIsPrinting(true);
    // Allow the hidden print area to render
    await new Promise(r => setTimeout(r, 300));

    try {
      if (printRef.current) {
        const imgBase64 = await captureBillImage(printRef.current);
        
        let localPath = '';
        try {
          localPath = await storageService.saveBillImage(bill.billNumber, bill.createdAt, imgBase64);
        } catch (err) {
          console.error('Failed to save bill image to disk:', err);
        }

        const billWithImg: Bill = { 
          ...bill, 
          billImageBase64: undefined, 
          billImagePath: localPath || undefined,
          syncedToCloud: true 
        };
        saveBill(billWithImg);
        setBills(prev =>
          prev.map(b => b.id === bill.id ? { 
            ...b, 
            billImageBase64: undefined, 
            billImagePath: localPath || undefined, 
            syncedToCloud: true 
          } : b)
        );
        setSelectedBill(billWithImg);
        setLoadedBillImage(imgBase64);
        toast({ title: 'Bill image saved!', description: 'Snapshot stored locally on this PC.' });
      }
    } catch (err) {
      console.error('Image capture error:', err);
      toast({ title: 'Image capture failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }

    window.print();
  }, [toast]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredBills = bills.filter(b => {
    const matchesSearch =
      b.billNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerPhone.includes(searchQuery);
    const matchesDate = !selectedDate || isSameDay(new Date(b.createdAt), selectedDate);
    return matchesSearch && matchesDate;
  });

  const getStatusBadge = (bill: Bill) => {
    if (bill.status === 'completed') {
      return <Badge className="bg-success/10 text-success border-0">Paid</Badge>;
    }
    if (bill.status === 'pending') {
      return <Badge className="bg-pending/10 text-pending border-0">Pending</Badge>;
    }
    return <Badge variant="secondary">{bill.status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bills</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'View all bills and transactions' : 'View your billing history'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSyncing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Cloud className="h-4 w-4 animate-spin" />
              <span>Syncing from cloud…</span>
            </div>
          )}
          {/* Manual Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={doSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
      </div>

      {/* Search & Date filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bill number, customer name or phone..."
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
                      'justify-start text-left font-normal w-[240px]',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Filter by date</span>}
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

      {/* Bills Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Image</TableHead>
                {isAdmin && <TableHead>Employee</TableHead>}
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono font-medium">
                    {bill.billNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{bill.customerName}</div>
                      <div className="text-xs text-muted-foreground">{bill.customerPhone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(bill.createdAt), 'dd MMM yyyy, HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ₹{bill.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{bill.paidAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(bill)}</TableCell>
                  <TableCell>
                    {bill.syncedToCloud ? (
                      <span title="Synced to cloud"><Cloud className="h-4 w-4 text-green-500" /></span>
                    ) : (
                      <span title="Not synced"><CloudOff className="h-4 w-4 text-yellow-500" /></span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(bill.billImagePath || bill.billImageBase64) ? (
                      <span title="Image stored"><ImageIcon className="h-4 w-4 text-blue-500" /></span>
                    ) : (
                      <span title="No image yet – click Print"><ImageIcon className="h-4 w-4 text-muted-foreground/30" /></span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-muted-foreground text-sm">
                      {bill.employeeName}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex gap-1">
                      {/* View */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedBill(bill)}
                        title="View bill"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {/* Print & capture image */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrint(bill)}
                        disabled={isPrinting}
                        title="Print & save image"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {/* Delete (admin only) */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteTargetBill(bill); setRestoreStockOnDelete(false); }}
                          title="Delete bill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    No bills found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bill Detail Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bill #{selectedBill?.billNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-6">
              <BillLayout bill={selectedBill} isPrinting={false} />

              {/* Stored bill image preview inside Collapsible Accordion */}
              {loadedBillImage && (
                <div className="border rounded-lg overflow-hidden bg-muted/20">
                  <button
                    onClick={() => setShowSnapshot(prev => !prev)}
                    className="w-full flex items-center justify-between p-4 font-medium text-sm text-muted-foreground hover:bg-muted/30 transition-colors animate-none"
                  >
                    <span className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" /> Stored bill snapshot (image)
                    </span>
                    {showSnapshot ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                  
                  {showSnapshot && (
                    <div className="p-4 border-t bg-white dark:bg-slate-900 transition-all">
                      <img
                        src={loadedBillImage}
                        alt={`Bill ${selectedBill.billNumber}`}
                        className="w-full rounded border shadow-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {!loadedBillImage && (
                <p className="text-xs text-muted-foreground text-center">
                  No image yet — click the <strong>Print</strong> (🖨️) button on the row to capture and save a snapshot.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden printable area — captured by html2canvas */}
      <div className="fixed -left-[9999px] top-0 w-[794px]" aria-hidden>
        <div ref={printRef}>
          {selectedBill && <BillLayout bill={selectedBill} isPrinting={true} />}
        </div>
      </div>

      {/* Visible print area (used by window.print()) */}
      <div className="hidden print:block">
        {selectedBill && <BillLayout bill={selectedBill} isPrinting={true} />}
      </div>

      {/* Delete Bill Confirmation Dialog */}
      <AlertDialog open={!!deleteTargetBill} onOpenChange={() => setDeleteTargetBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete bill{' '}
              <strong>{deleteTargetBill?.billNumber}</strong> for{' '}
              <strong>{deleteTargetBill?.customerName}</strong> and all associated:
              <ul className="mt-2 list-disc list-inside text-sm space-y-1">
                <li>Bill header &amp; items</li>
                <li>Payment records</li>
                <li>Pending due records</li>
                {deleteTargetBill?.billImagePath && <li>Bill image file</li>}
              </ul>
              <span className="block mt-2 text-xs text-muted-foreground">
                Records will be kept in Recycle Bin for 30 days.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 flex items-center gap-2">
            <Checkbox
              id="restore-stock-cb"
              checked={restoreStockOnDelete}
              onCheckedChange={(v) => setRestoreStockOnDelete(!!v)}
            />
            <Label htmlFor="restore-stock-cb" className="text-sm cursor-pointer">
              Also restore stock quantities for items in this bill
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (!deleteTargetBill) return;
                deleteBill(deleteTargetBill.id, restoreStockOnDelete);
                loadLocalBills();
                toast({
                  title: 'Bill deleted',
                  description: `Bill ${deleteTargetBill.billNumber} moved to Recycle Bin.`,
                });
                if (selectedBill?.id === deleteTargetBill.id) setSelectedBill(null);
                setDeleteTargetBill(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
