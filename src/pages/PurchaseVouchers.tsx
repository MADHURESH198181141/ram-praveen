import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, FileText, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { getPurchaseVouchers, deletePurchaseVoucher, getSuppliers } from '@/lib/storage';
import { PurchaseVoucher, Supplier } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { SupplierModal } from '@/components/SupplierModal';

export default function PurchaseVouchers() {
    const [vouchers, setVouchers] = useState<PurchaseVoucher[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        setVouchers(getPurchaseVouchers());
    }, []);

    const filteredVouchers = vouchers.filter(v => {
        const matchesSearch = v.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDate = !dateFilter || format(v.date, 'yyyy-MM-dd') === dateFilter;
        return matchesSearch && matchesDate;
    }).sort((a, b) => b.date.getTime() - a.date.getTime());

    const handleDelete = (id: string, number: string) => {
        if (confirm(`Are you sure you want to delete voucher ${number}? This will also reverse the stock updates.`)) {
            deletePurchaseVoucher(id);
            setVouchers(getPurchaseVouchers());
            toast({
                title: 'Voucher deleted',
                description: `Voucher ${number} and its stock changes have been removed`,
            });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Vouchers</h1>
                    <p className="text-muted-foreground">Manage your stock purchases and inventory cost</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsSupplierModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Supplier
                    </Button>
                    <Button onClick={() => navigate('/purchase-vouchers/new')}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Voucher
                    </Button>
                </div>
            </div>

            <SupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSuccess={() => {
                    // Suppliers aren't directly displayed here, but this ensures functionality
                    toast({ title: 'Success', description: 'New supplier added' });
                }}
            />

            <Card>
                <CardContent className="py-4">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Voucher # or Supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="w-48 relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Voucher #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVouchers.map((voucher) => (
                                <TableRow key={voucher.id}>
                                    <TableCell className="font-medium">{voucher.voucherNumber}</TableCell>
                                    <TableCell>{format(voucher.date, 'dd-MM-yyyy')}</TableCell>
                                    <TableCell>{voucher.supplierName}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{voucher.items.length} items</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                        ₹{voucher.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => navigate(`/purchase-vouchers/${voucher.id}`)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(voucher.id, voucher.voucherNumber)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredVouchers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No purchase vouchers found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
