import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, Users, FileText, CreditCard, ShoppingCart, Eraser, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getRecycleBin,
  restoreFromRecycleBin,
  removeFromRecycleBin,
  emptyRecycleBin,
  purgeExpiredRecycleBinItems,
} from '@/lib/storage';
import { RecycleBinItem, RecycleBinEntityType } from '@/types';
import { Navigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';

// ─── Entity type config ───────────────────────────────────────────────────────

const ENTITY_CONFIG: Record<RecycleBinEntityType, { label: string; icon: React.ReactNode; color: string }> = {
  customer: { label: 'Customer', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  bill: { label: 'Bill', icon: <FileText className="h-3.5 w-3.5" />, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  product: { label: 'Product', icon: <Package className="h-3.5 w-3.5" />, color: 'bg-violet-500/10 text-violet-600 border-violet-200' },
  purchase_voucher: { label: 'Purchase Voucher', icon: <ShoppingCart className="h-3.5 w-3.5" />, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  pending_due: { label: 'Pending Due', icon: <CreditCard className="h-3.5 w-3.5" />, color: 'bg-red-500/10 text-red-600 border-red-200' },
  payment: { label: 'Payment', icon: <CreditCard className="h-3.5 w-3.5" />, color: 'bg-teal-500/10 text-teal-600 border-teal-200' },
  employee: { label: 'Employee', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-pink-500/10 text-pink-600 border-pink-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(expiresAt: string): number {
  return Math.max(0, differenceInDays(new Date(expiresAt), new Date()));
}

export default function RecycleBin() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecycleBinEntityType | 'all'>('all');
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);

  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  const loadItems = useCallback(() => {
    purgeExpiredRecycleBinItems();
    const all = getRecycleBin();
    // Sort newest first
    all.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    setItems(all);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.entityLabel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.entityType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleRestore = (item: RecycleBinItem) => {
    const success = restoreFromRecycleBin(item.id);
    if (success) {
      loadItems();
      toast({
        title: '✅ Restored',
        description: `"${item.entityLabel}" has been restored successfully.`,
      });
    } else {
      toast({
        title: 'Restore failed',
        description: 'Could not restore this record. It may have already been restored or expired.',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentDelete = () => {
    if (!permanentDeleteId) return;
    const item = items.find(i => i.id === permanentDeleteId);
    removeFromRecycleBin(permanentDeleteId);
    setPermanentDeleteId(null);
    loadItems();
    toast({
      title: 'Permanently deleted',
      description: `"${item?.entityLabel}" has been permanently removed.`,
    });
  };

  const handleEmptyBin = () => {
    emptyRecycleBin();
    setShowEmptyDialog(false);
    loadItems();
    toast({
      title: 'Recycle Bin emptied',
      description: 'All deleted records have been permanently removed.',
    });
  };

  const entityTypes = Array.from(new Set(items.map(i => i.entityType)));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            Recycle Bin
          </h1>
          <p className="text-muted-foreground">
            Deleted records are kept for 30 days before permanent deletion
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowEmptyDialog(true)}
            className="gap-2"
          >
            <Eraser className="h-4 w-4" />
            Empty Bin ({items.length})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(ENTITY_CONFIG).map(([type, config]) => {
          const count = items.filter(i => i.entityType === type).length;
          if (count === 0) return null;
          return (
            <Card
              key={type}
              className={`cursor-pointer transition-all ${typeFilter === type ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
              onClick={() => setTypeFilter(typeFilter === type ? 'all' : type as RecycleBinEntityType)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{config.label}s</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search + Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deleted records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('all')}
              >
                All
              </Button>
              {entityTypes.map(type => (
                <Button
                  key={type}
                  variant={typeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                >
                  {ENTITY_CONFIG[type]?.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recycle Bin Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead>Expires In</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const config = ENTITY_CONFIG[item.entityType];
                const days = daysRemaining(item.expiresAt);
                const isExpiringSoon = days <= 7;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs ${config?.color || ''}`}
                      >
                        {config?.icon}
                        {config?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.entityLabel}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: {item.entityId.substring(0, 12)}...
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.deletedAt), 'dd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {days === 0 ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Expires today
                          </span>
                        ) : (
                          `${days} day${days !== 1 ? 's' : ''}`
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 h-7 px-2 text-xs"
                          onClick={() => handleRestore(item)}
                          title="Restore this record"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setPermanentDeleteId(item.id)}
                          title="Delete permanently"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Trash2 className="h-10 w-10 opacity-20" />
                      <div className="text-sm">
                        {items.length === 0
                          ? 'Recycle Bin is empty'
                          : 'No records match your search'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permanent Delete Dialog */}
      <AlertDialog open={!!permanentDeleteId} onOpenChange={() => setPermanentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This record will be permanently deleted and cannot be recovered.
              <br />
              <strong>{items.find(i => i.id === permanentDeleteId)?.entityLabel}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handlePermanentDelete}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Bin Dialog */}
      <AlertDialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <strong>{items.length} record{items.length !== 1 ? 's' : ''}</strong> in the Recycle Bin.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleEmptyBin}
            >
              Empty Bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
