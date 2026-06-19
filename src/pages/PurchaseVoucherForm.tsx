import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, Printer, ArrowLeft, Search, Package, Image as ImageIcon, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    getProducts,
    getSuppliers,
    getCategories,
    saveCategory,
    getPurchaseVouchers,
    savePurchaseVoucher,
    getNextVoucherNumber,
} from '@/lib/storage';
import { getGstRate, fetchHsnData } from '@/lib/gst-service';
import { Product, PurchaseVoucher, PurchaseVoucherItem, Supplier, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { SupplierModal } from '@/components/SupplierModal';
import { ChevronDown, UserPlus } from 'lucide-react';

const UOM_OPTIONS = ['Nos', 'Kg', 'g', 'L', 'ml', 'Box', 'Pack', 'Carton', 'Dozen', 'Bag'];

export default function PurchaseVoucherForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isEdit = !!id;

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [voucher, setVoucher] = useState<Partial<PurchaseVoucher>>({
        voucherNumber: '',
        date: new Date(),
        branch: 'Main Branch',
        location: 'Warehouse 1',
        supplierId: '',
        supplierName: '',
        purchaseAccount: 'Purchase A/C',
        executive: 'Admin',
        remarks: '',
        totalAmount: 0,
        items: [],
    });

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false);

    const handleSupplierSuccess = (newSupplier: Supplier) => {
        setSuppliers(prev => [...prev, newSupplier]);
        setVoucher(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.name }));
        setIsSupplierModalOpen(false);
        setIsSupplierSearchOpen(false);
    };

    const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
    const inputRefs = useRef<Array<Array<HTMLInputElement | HTMLButtonElement | null>>>([]);

    useEffect(() => {
        const loadedSuppliers = getSuppliers();
        const loadedProducts = getProducts();
        const loadedCategories = getCategories();
        setSuppliers(loadedSuppliers);
        setProducts(loadedProducts);
        setCategories(loadedCategories);

        if (isEdit) {
            const allVouchers = getPurchaseVouchers();
            const existing = allVouchers.find(v => v.id === id);
            if (existing) {
                setVoucher(existing);
            } else {
                toast({ title: 'Voucher not found', variant: 'destructive' });
                navigate('/purchase-vouchers');
            }
        } else {
            setVoucher(prev => ({ ...prev, voucherNumber: getNextVoucherNumber(), items: [createEmptyItem()] }));
        }
        setIsLoading(false);
    }, [id]);

    const createEmptyItem = (): PurchaseVoucherItem => ({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        voucherId: id || '',
        productId: '',
        productName: '',
        sku: '',
        uom: '',
        conversionFactor: 1,
        quantity: 0,
        quantityInSku: 0,
        unitRate: 0,
        grossAmount: 0,
        discount: 0,
        tax: 0,
        gstPercentage: 0,
        netAmount: 0,
        category: 'Uncategorized',
        hsnCode: '',
        description: '',
        image: '',
    });

    const calculateItemRow = (item: PurchaseVoucherItem) => {
        const qtyInSku = item.quantity * item.conversionFactor;
        const gross = item.quantity * item.unitRate;
        const gstRate = item.gstPercentage || 0;
        const taxAmt = (gross * gstRate) / 100;
        const discountAmt = (gross * item.discount) / 100;
        const net = gross + taxAmt - discountAmt;

        return {
            ...item,
            quantityInSku: qtyInSku,
            grossAmount: gross,
            tax: taxAmt, // Store calculated tax amount
            netAmount: net,
        };
    };

    const updateVoucherTotal = (items: PurchaseVoucherItem[]) => {
        const total = items.reduce((sum, item) => sum + item.netAmount, 0);
        setVoucher(prev => ({ ...prev, items, totalAmount: total }));
    };

    const handleItemChange = (index: number, field: keyof PurchaseVoucherItem, value: any) => {
        const newItems = [...(voucher.items || [])];
        newItems[index] = calculateItemRow({ ...newItems[index], [field]: value });

        // Auto-add new empty row if typing in the last one
        if (field === 'productName' && value && index === newItems.length - 1) {
            newItems.push(createEmptyItem());
        }

        updateVoucherTotal(newItems);
    };

    const handleProductSelect = (index: number, product: Product) => {
        const items = [...(voucher.items || [])];
        const isLastRow = index === items.length - 1;

        const updatedItem = calculateItemRow({
            ...items[index],
            productId: product.id,
            productName: product.name,
            sku: product.sku || '',
            uom: product.uom || product.unit || '',
            conversionFactor: product.conversionFactor || 1,
            unitRate: product.costPrice || 0,
            hsnCode: product.hsnCode || '',
            description: product.description || '',
            gstPercentage: product.gstPercentage || 0,
            category: product.category || 'Uncategorized',
        });

        items[index] = updatedItem;

        // Auto-fetch GST if it's 0 or default
        if (product.hsnCode && (product.gstPercentage === 0 || product.gstPercentage === undefined)) {
            getGstRate(product.hsnCode).then(rate => {
                if (rate !== null && rate > 0) {
                    const currentItems = [...(voucher.items || [])];
                    if (currentItems[index]) {
                        currentItems[index] = calculateItemRow({ ...currentItems[index], gstPercentage: rate });
                        updateVoucherTotal(currentItems);
                    }
                }
            });
        }

        // Auto-add new empty row if selecting in the last one
        if (isLastRow) {
            items.push(createEmptyItem());
        }

        updateVoucherTotal(items);
        setActiveSearchIndex(null);
        setSearchQuery('');
        setSuggestionIndex(0);

        // Focus HSN Code cell after selection (index 1)
        setTimeout(() => focusCell(index, 1), 0);
    };

    const focusCell = useCallback((row: number, col: number, openSearch: boolean = false) => {
        setTimeout(() => {
            const targetRow = inputRefs.current[row];
            if (targetRow && targetRow[col]) {
                const el = targetRow[col];
                el?.focus();
                if (el instanceof HTMLInputElement) el.select();
                setFocusedCell({ row, col });

                if (col === 0 && openSearch) {
                    setActiveSearchIndex(row);
                    setSearchQuery('');
                }
            }
        }, 50);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
        const itemsCount = (voucher.items || []).length;
        const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10);

        // Handle search suggestions navigation
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
                handleProductSelect(rowIndex, filteredProducts[suggestionIndex]);
                return;
            } else if (e.key === 'Escape') {
                setActiveSearchIndex(null);
                setSearchQuery('');
                return;
            }
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusCell(rowIndex + 1, colIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusCell(rowIndex - 1, colIndex);
        } else if (e.key === 'ArrowRight') {
            const isAtEnd = (e.target as HTMLInputElement).selectionEnd === (e.target as HTMLInputElement).value?.length;
            if (isAtEnd || (e.target as HTMLInputElement).type === 'number') {
                e.preventDefault();
                focusCell(rowIndex, colIndex + 1);
            }
        } else if (e.key === 'ArrowLeft') {
            const isAtStart = (e.target as HTMLInputElement).selectionStart === 0;
            if (isAtStart || (e.target as HTMLInputElement).type === 'number') {
                e.preventDefault();
                focusCell(rowIndex, colIndex - 1);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (colIndex < 11) { // Navigate through columns (total 13 columns now)
                focusCell(rowIndex, colIndex + 1);
            } else if (colIndex === 11) { // Next Row column
                if (rowIndex === itemsCount - 1) {
                    addNewItem();
                    setTimeout(() => focusCell(rowIndex + 1, 0, true), 10);
                } else {
                    focusCell(rowIndex + 1, 0);
                }
            } else { // Delete column
                focusCell(rowIndex + 1, 0);
            }
        }
    };

    const setInputRef = (rowIndex: number, colIndex: number, el: HTMLInputElement | HTMLButtonElement | null) => {
        if (!inputRefs.current[rowIndex]) {
            inputRefs.current[rowIndex] = [];
        }
        inputRefs.current[rowIndex][colIndex] = el;
    };

    const addNewItem = () => {
        const newItems = [...(voucher.items || []), createEmptyItem()];
        setVoucher(prev => ({ ...prev, items: newItems }));
    };

    const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast({ title: 'Invalid file type', description: 'Please upload JPG, PNG or WEBP', variant: 'destructive' });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            handleItemChange(index, 'image', base64);
        };
        reader.readAsDataURL(file);
    };

    const removeItem = (index: number) => {
        const newItems = (voucher.items || []).filter((_, i) => i !== index);
        if (newItems.length === 0) newItems.push(createEmptyItem());
        updateVoucherTotal(newItems);
    };

    const handleSave = () => {
        if (!voucher.supplierId) {
            toast({ title: 'Supplier required', variant: 'destructive' });
            return;
        }

        const validItems = (voucher.items || []).filter(item => item.productName && item.quantity > 0);
        if (validItems.length === 0) {
            toast({ title: 'Add at least one valid item', variant: 'destructive' });
            return;
        }

        // Validate required fields for all items
        const missingFields = validItems.some(item => !item.productName || !item.category || item.quantity <= 0 || item.unitRate <= 0);
        if (missingFields) {
            toast({ title: 'Validation Error', description: 'Product Name, Category, Quantity and Rate are required for all items.', variant: 'destructive' });
            return;
        }

        const finalVoucher: PurchaseVoucher = {
            ...(voucher as PurchaseVoucher),
            id: voucher.id || `pv-${Date.now()}`,
            items: validItems,
            date: new Date(voucher.date || new Date()),
            createdAt: voucher.createdAt || new Date(),
            updatedAt: new Date(),
        };

        savePurchaseVoucher(finalVoucher);
        toast({ title: isEdit ? 'Voucher updated' : 'Voucher saved', description: `Inventory has been updated.` });
        navigate('/purchase-vouchers');
    };

    if (isLoading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-6 max-h-[calc(100vh-64px)] overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-vouchers')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Purchase Voucher' : 'New Purchase Voucher'}</h1>
                        <p className="text-muted-foreground">{voucher.voucherNumber}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                    <Button onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        {isEdit ? 'Update Voucher' : 'Save Voucher'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <Card className="col-span-4 lg:col-span-3">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium">Voucher Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Voucher Type</Label>
                            <Select defaultValue="purchase">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="purchase">Purchase</SelectItem>
                                    <SelectItem value="return">Purchase Return</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                type="date"
                                value={format(voucher.date || new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => setVoucher({ ...voucher, date: new Date(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Branch</Label>
                            <Input
                                value={voucher.branch}
                                onChange={(e) => setVoucher({ ...voucher, branch: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input
                                value={voucher.location}
                                onChange={(e) => setVoucher({ ...voucher, location: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Party Account (Supplier) <span className="text-destructive">*</span></Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="Search supplier..."
                                    value={isSupplierSearchOpen ? supplierSearch : voucher.supplierName}
                                    onChange={(e) => {
                                        setSupplierSearch(e.target.value);
                                        setIsSupplierSearchOpen(true);
                                    }}
                                    onFocus={() => {
                                        setSupplierSearch(voucher.supplierName || '');
                                        setIsSupplierSearchOpen(true);
                                    }}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setIsSupplierModalOpen(true)}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                            {isSupplierSearchOpen && (
                                <div className="absolute top-full left-0 w-full bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto mt-1">
                                    <div
                                        className="px-3 py-2 cursor-pointer hover:bg-muted flex items-center gap-2 text-primary font-medium border-b"
                                        onMouseDown={() => setIsSupplierModalOpen(true)}
                                    >
                                        <Plus className="h-4 w-4" /> Add New Supplier
                                    </div>
                                    {suppliers
                                        .filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone.includes(supplierSearch))
                                        .map(s => (
                                            <div
                                                key={s.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-muted flex flex-col"
                                                onMouseDown={() => {
                                                    setVoucher({ ...voucher, supplierId: s.id, supplierName: s.name });
                                                    setIsSupplierSearchOpen(false);
                                                }}
                                            >
                                                <span className="font-medium">{s.name}</span>
                                                <span className="text-[10px] text-muted-foreground">Phone: {s.phone} {s.gstNumber ? `| GST: ${s.gstNumber}` : ''}</span>
                                            </div>
                                        ))
                                    }
                                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                                            No suppliers found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Purchase Account</Label>
                            <Input
                                value={voucher.purchaseAccount}
                                onChange={(e) => setVoucher({ ...voucher, purchaseAccount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Executive</Label>
                            <Input
                                value={voucher.executive}
                                onChange={(e) => setVoucher({ ...voucher, executive: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Input
                                value={voucher.remarks}
                                onChange={(e) => setVoucher({ ...voucher, remarks: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-4 lg:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Items:</span>
                            <span className="font-medium">{(voucher.items || []).length}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t">
                            <span className="text-lg font-bold">Grand Total:</span>
                            <span className="text-lg font-bold">₹{voucher.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto min-h-[400px]">
                    <Table className="min-w-[1500px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-12 text-center">#</TableHead>
                                <TableHead className="w-64">Product Name</TableHead>
                                <TableHead className="w-40">HSN Code</TableHead>
                                <TableHead className="w-64">Description</TableHead>
                                <TableHead className="w-32">SKU</TableHead>
                                <TableHead className="w-24">UOM</TableHead>
                                <TableHead className="w-24 text-right">Qty</TableHead>
                                <TableHead className="w-24 text-right">Conv. Factor</TableHead>
                                <TableHead className="w-28 text-right">Qty in SKU</TableHead>
                                <TableHead className="w-32 text-right">Unit Rate (₹)</TableHead>
                                <TableHead className="w-32 text-right">Gross Amt (₹)</TableHead>
                                <TableHead className="w-24 text-right">Disc %</TableHead>
                                <TableHead className="w-24 text-right">GST %</TableHead>
                                <TableHead className="w-32 text-right">Tax Amt (₹)</TableHead>
                                <TableHead className="w-32 text-right">Net Amt (₹)</TableHead>
                                <TableHead className="w-48">Category</TableHead>
                                <TableHead className="w-12 text-center">Next</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(voucher.items || []).map((item, index) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 border-b relative group">
                                    <TableCell className="text-center text-muted-foreground border-r">{index + 1}</TableCell>
                                    <TableCell className="relative p-0 border-r min-w-[250px]">
                                        <div className="flex items-center">
                                            {index === (voucher.items || []).length - 1 && !item.productName && (
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                            )}
                                            <input
                                                ref={el => setInputRef(index, 0, el)}
                                                className={cn(
                                                    "w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30",
                                                    index === (voucher.items || []).length - 1 && !item.productName && "pl-9"
                                                )}
                                                placeholder={index === (voucher.items || []).length - 1 ? "Add new item..." : "Search product..."}
                                                value={activeSearchIndex === index ? (searchQuery || item.productName) : item.productName}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSearchQuery(val);
                                                    handleItemChange(index, 'productName', val);
                                                    setActiveSearchIndex(index);
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, 0)}
                                                onFocus={() => {
                                                    setActiveSearchIndex(index);
                                                    setSearchQuery(item.productName);
                                                    setFocusedCell({ row: index, col: 0 });
                                                }}
                                                onBlur={() => {
                                                    setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200);
                                                }}
                                            />
                                        </div>
                                        {activeSearchIndex === index && searchQuery.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto mt-1">
                                                {products
                                                    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .slice(0, 10)
                                                    .map((p, pIdx) => (
                                                        <div
                                                            key={p.id}
                                                            className={cn(
                                                                "px-3 py-2 cursor-pointer flex justify-between items-center transition-colors",
                                                                suggestionIndex === pIdx ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                                            )}
                                                            onMouseDown={() => handleProductSelect(index, p)}
                                                            onMouseEnter={() => setSuggestionIndex(pIdx)}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-sm">{p.name}</span>
                                                                <span className={cn("text-[10px]", suggestionIndex === pIdx ? "text-primary-foreground/70" : "text-muted-foreground")}>SKU: {p.sku} | Cost: ₹{p.costPrice}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono bg-black/10 px-1.5 rounded">{p.stockQuantity} {p.uom}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <div className="relative flex items-center">
                                            <input
                                                ref={el => setInputRef(index, 1, el)}
                                                className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30"
                                                value={item.hsnCode}
                                                onChange={async (e) => {
                                                    const hsn = e.target.value;
                                                    handleItemChange(index, 'hsnCode', hsn);
                                                    if (hsn.length >= 4) {
                                                        const data = await fetchHsnData(hsn);
                                                        if (data) {
                                                            const newItems = [...(voucher.items || [])];
                                                            newItems[index] = calculateItemRow({ 
                                                                ...newItems[index], 
                                                                hsnCode: hsn,
                                                                productName: newItems[index].productName || data.name,
                                                                gstPercentage: data.rate,
                                                                description: newItems[index].description || data.description 
                                                            });
                                                            updateVoucherTotal(newItems);
                                                        }
                                                    }
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                                onFocus={() => setFocusedCell({ row: index, col: 1 })}
                                                placeholder="HSN Code"
                                            />
                                            {item.hsnCode && item.hsnCode.length >= 4 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={async () => {
                                                        const data = await fetchHsnData(item.hsnCode);
                                                        if (data) {
                                                            const update: Partial<PurchaseVoucherItem> = {
                                                                gstPercentage: data.rate
                                                            };
                                                            if (data.description && !item.description) {
                                                                update.description = data.description;
                                                            }
                                                            if (data.name && !item.productName) {
                                                                update.productName = data.name;
                                                            }
                                                            
                                                            const newItems = [...(voucher.items || [])];
                                                            newItems[index] = calculateItemRow({
                                                                ...newItems[index],
                                                                ...update
                                                            });
                                                            updateVoucherTotal(newItems);
                                                        }
                                                    }}
                                                    title="Refresh HSN data"
                                                >
                                                    <Plus className="h-3 w-3 rotate-45" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 2, el)}
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                            onFocus={() => setFocusedCell({ row: index, col: 2 })}
                                            placeholder="Description"
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 3, el)}
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30"
                                            value={item.sku}
                                            onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 3)}
                                            onFocus={() => setFocusedCell({ row: index, col: 3 })}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r min-w-[120px]">
                                        <div className="relative group/uom">
                                            <select
                                                ref={el => setInputRef(index, 4, el as any)}
                                                className="w-full h-10 px-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                                                value={item.uom}
                                                onChange={(e) => {
                                                    handleItemChange(index, 'uom', e.target.value);
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, 4)}
                                                onFocus={() => {
                                                    setFocusedCell({ row: index, col: 4 });
                                                }}
                                            >
                                                {UOM_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none opacity-50" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 5, el)}
                                            type="number"
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 text-right font-mono"
                                            value={item.quantity || ''}
                                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 5)}
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 5 });
                                                (inputRefs.current[index]?.[5] as HTMLInputElement)?.select();
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 6, el)}
                                            type="number"
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 text-right font-mono"
                                            value={item.conversionFactor || ''}
                                            onChange={(e) => handleItemChange(index, 'conversionFactor', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 6)}
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 6 });
                                                (inputRefs.current[index]?.[6] as HTMLInputElement)?.select();
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground italic border-r bg-muted/5">
                                        {item.quantityInSku}
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 7, el)}
                                            type="number"
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 text-right font-mono"
                                            value={item.unitRate || ''}
                                            onChange={(e) => handleItemChange(index, 'unitRate', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 7)}
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 7 });
                                                (inputRefs.current[index]?.[7] as HTMLInputElement)?.select();
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium border-r bg-muted/5">
                                        ₹{item.grossAmount.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 8, el)}
                                            type="number"
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 text-right font-mono"
                                            value={item.discount || ''}
                                            onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 8)}
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 8 });
                                                (inputRefs.current[index]?.[8] as HTMLInputElement)?.select();
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="p-0 border-r">
                                        <input
                                            ref={el => setInputRef(index, 9, el)}
                                            type="number"
                                            className="w-full h-10 px-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 text-right font-mono"
                                            value={item.gstPercentage || ''}
                                            onChange={(e) => handleItemChange(index, 'gstPercentage', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleKeyDown(e, index, 9)}
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 9 });
                                                (inputRefs.current[index]?.[9] as HTMLInputElement)?.select();
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground border-r bg-muted/5">
                                        ₹{item.tax.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-primary border-r bg-muted/5 min-w-[120px]">
                                        ₹{item.netAmount.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="p-0 border-r min-w-[150px]">
                                        <div className="relative group/cat">
                                            <select
                                                ref={el => setInputRef(index, 10, el as any)}
                                                className="w-full h-10 px-2 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                                                value={item.category}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'ADD_NEW') {
                                                        const newCatName = prompt('Enter new category name:');
                                                        if (newCatName?.trim()) {
                                                            const newCat: Category = {
                                                                id: `cat-${Date.now()}`,
                                                                name: newCatName.trim(),
                                                                sortOrder: categories.length + 1
                                                            };
                                                            saveCategory(newCat);
                                                            setCategories(prev => [...prev, newCat]);
                                                            handleItemChange(index, 'category', newCat.name);
                                                        }
                                                    } else {
                                                        handleItemChange(index, 'category', val);
                                                    }
                                                }}
                                                onKeyDown={(e) => handleKeyDown(e, index, 10)}
                                                onFocus={() => setFocusedCell({ row: index, col: 10 })}
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                                <option value="ADD_NEW" className="text-primary font-bold">+ Add New Category</option>
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none opacity-50" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-0 border-r text-center">
                                        <Button
                                            ref={el => setInputRef(index, 11, el as any)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-full rounded-none hover:bg-primary/10 transition-colors"
                                            onFocus={() => {
                                                setFocusedCell({ row: index, col: 11 });
                                                if (index === (voucher.items || []).length - 1) {
                                                    addNewItem();
                                                    setTimeout(() => focusCell(index + 1, 0, true), 10);
                                                }
                                            }}
                                            onClick={() => {
                                                if (index === (voucher.items || []).length - 1) {
                                                    addNewItem();
                                                    setTimeout(() => focusCell(index + 1, 0, true), 10);
                                                } else {
                                                    focusCell(index + 1, 0);
                                                }
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, index, 11)}
                                        >
                                            <Plus className="h-4 w-4 text-primary" />
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-center p-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeItem(index)}
                                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                            onFocus={() => setFocusedCell({ row: index, col: 12 })}
                                            ref={el => setInputRef(index, 12, el as any)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(voucher.items || []).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={15} className="text-center py-12 text-muted-foreground border-b italic">
                                        No items added. Start by typing a product name in the first row.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <div className="p-4 border-t flex justify-end items-center bg-muted/20">
                    <div className="flex gap-8 text-sm">
                        <div className="flex gap-2">
                            <span className="text-muted-foreground">Total Qty:</span>
                            <span className="font-bold">{(voucher.items || []).reduce((sum, i) => sum + i.quantity, 0)}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-muted-foreground">Total SKU Qty:</span>
                            <span className="font-bold">{(voucher.items || []).reduce((sum, i) => sum + i.quantityInSku, 0)}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Search backdrop to close dropdown */}
            {(activeSearchIndex !== null || isSupplierSearchOpen) && (
                <div className="fixed inset-0 z-40" onClick={() => {
                    setActiveSearchIndex(null);
                    setIsSupplierSearchOpen(false);
                }} />
            )}

            <SupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSuccess={handleSupplierSuccess}
            />
        </div>
    );
}
