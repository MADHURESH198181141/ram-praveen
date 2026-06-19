import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Phone, Calendar, Star, DollarSign, Trash2 } from 'lucide-react';
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
import { getCustomers, syncCustomersFromCloud, deleteCustomer } from '@/lib/storage';
import { Customer } from '@/types';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Customers() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadCustomers = useCallback(() => {
    setCustomers(getCustomers());
  }, []);

  useEffect(() => {
    loadCustomers();
    syncCustomersFromCloud().then(loadCustomers);

    // Listen for realtime storage updates
    const handler = () => loadCustomers();
    window.addEventListener('storage-updated', handler);
    return () => window.removeEventListener('storage-updated', handler);
  }, [loadCustomers]);

  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const totalPendingDues = customers.reduce((sum, c) => sum + c.pendingDues, 0);
  const regularCustomers = customers.filter(c => c.isRegular).length;

  const handleDeleteConfirm = () => {
    if (!deleteTargetId) return;
    const customer = customers.find(c => c.id === deleteTargetId);
    deleteCustomer(deleteTargetId);
    loadCustomers();
    setDeleteTargetId(null);
    toast({
      title: 'Customer deleted',
      description: `${customer?.name || 'Customer'} and all associated records have been moved to Recycle Bin.`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">View and manage customer information</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{customers.length}</div>
                <div className="text-sm text-muted-foreground">Total Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold">{regularCustomers}</div>
                <div className="text-sm text-muted-foreground">Regular Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">
                  ₹{customers.reduce((sum, c) => sum + c.totalPurchases, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Purchases</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pending/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-pending" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-pending">
                  ₹{totalPendingDues.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Pending Dues</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
                <TableHead className="text-right">Pending Due</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-medium text-primary">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="font-medium">{customer.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{customer.totalPurchases.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {customer.pendingDues > 0 ? (
                      <span className="text-pending font-medium">
                        ₹{customer.pendingDues.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(customer.lastVisit), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.isRegular ? (
                      <Badge className="bg-accent/10 text-accent border-0">
                        <Star className="h-3 w-3 mr-1" />
                        Regular
                      </Badge>
                    ) : (
                      <Badge variant="secondary">New</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTargetId(customer.id)}
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{customers.find(c => c.id === deleteTargetId)?.name}</strong> along with:
              <ul className="mt-2 list-disc list-inside text-sm space-y-1">
                <li>Customer profile</li>
                <li>All billing history</li>
                <li>Pending amount records</li>
                <li>Associated payments</li>
              </ul>
              <span className="block mt-2 text-xs text-muted-foreground">
                Records will be kept in Recycle Bin for 30 days before permanent deletion.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
