import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, Languages, Loader2, Upload } from 'lucide-react';
import { translateToTamil } from '@/lib/translate';
const UOM_OPTIONS = ['Nos', 'Kg', 'g', 'L', 'ml', 'Box', 'Pack', 'Carton', 'Dozen', 'Bag'];
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getProducts, saveProduct, saveProducts, deleteProduct, getCategories } from '@/lib/storage';
import { getGstRate, getProductNameFromHSN } from '@/lib/gst-service';
import { Product, Category } from '@/types';
import { Navigate } from 'react-router-dom';

export default function Products() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    minPrice: '',
    maxPrice: '',
    unit: '',
    uom: '',
    sku: '',
    stock: '',
    costPrice: '',
    division: '',
    conversionFactor: '1',
    barcode: '',
    hsnCode: '',
    gstPercentage: '',
    description: '',
    nameTamil: '',
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Admin-only access
  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  useEffect(() => {
    setProducts(getProducts());
    setCategories(getCategories());
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: categories[0]?.name || '',
      price: '',
      minPrice: '',
      maxPrice: '',
      unit: 'piece',
      uom: 'piece',
      sku: '',
      stock: '0',
      costPrice: '0',
      division: 'Division 1',
      conversionFactor: '1',
      barcode: '',
      hsnCode: '',
      gstPercentage: '',
      description: '',
      nameTamil: '',
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      minPrice: product.minPrice.toString(),
      maxPrice: product.maxPrice.toString(),
      unit: product.unit,
      uom: product.uom || product.unit,
      sku: product.sku || '',
      stock: product.stock.toString(),
      costPrice: (product.costPrice || 0).toString(),
      division: product.division || 'Division 1',
      conversionFactor: (product.conversionFactor || 1).toString(),
      barcode: product.barcode || '',
      hsnCode: product.hsnCode || '',
      gstPercentage: product.gstPercentage?.toString() || '',
      description: product.description || '',
      nameTamil: product.nameTamil || '',
    });
    setShowDialog(true);
  };

  const handleDelete = (product: Product) => {
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
      deleteProduct(product.id);
      setProducts(getProducts());
      toast({
        title: 'Product deleted',
        description: `${product.name} has been removed`,
      });
    }
  };

  const handleAutoTranslate = async (text: string, force = false) => {
    if (!text.trim() || (!force && formData.nameTamil.trim())) return;
    setIsTranslating(true);
    try {
      const translated = await translateToTamil(text);
      if (translated) {
        setFormData(prev => ({ ...prev, nameTamil: translated }));
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      if (lines.length < 2) throw new Error('Empty CSV file');

      const headers = lines[0].split(',').map(h => h.trim());
      
      const newProducts: Product[] = [];
      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const values = line.split(',');
        if (values.length < headers.length - 2) continue;

        const getValue = (headerName: string) => {
           const idx = headers.findIndex(h => h === headerName);
           return idx >= 0 ? values[idx]?.trim() : '';
        };

        const rawPrice = getValue('Unit_Price').replace(/[^0-9.]/g, '');
        const price = parseFloat(rawPrice) || 0;
        const stockStr = getValue('Stock_Quantity');
        const stock = parseInt(stockStr) || 0;
        const name = getValue('Product_Name') || `Imported Product ${i}`;
        
        if (name && price >= 0) {
          const newProduct: Product = {
            id: `p-${Date.now()}-${i}`,
            name: name,
            category: getValue('Catagory') || 'Uncategorized',
            price: price,
            minPrice: price * 0.8,
            maxPrice: price * 1.5,
            unit: 'Nos',
            uom: 'Nos',
            sku: getValue('Product_ID') || `SKU-${Date.now()}-${i}`,
            stock: stock,
            stockQuantity: stock,
            costPrice: price, 
            division: 'Division 1',
            conversionFactor: 1,
            gstPercentage: parseFloat(getValue('percentage')) || 0,
            isActive: true, // Based on CSV Status
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          if (getValue('Status') === 'Inactive') {
            newProduct.isActive = false;
          }
          newProducts.push(newProduct);
          importedCount++;
        }
      }

      if (newProducts.length > 0) {
        saveProducts(newProducts);
        setProducts(getProducts());
        toast({
          title: 'Import Successful',
          description: `Imported ${importedCount} products.`,
        });
      } else {
        toast({
          title: 'No Products Found',
          description: 'No valid products were found in the CSV file.',
          variant: 'destructive'
        });
      }
    } catch (error) {
       toast({
         title: 'Import Failed',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive'
       });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(formData.price);
    const minPrice = parseFloat(formData.minPrice);
    const maxPrice = parseFloat(formData.maxPrice);
    const stock = parseInt(formData.stock);

    if (minPrice > price || price > maxPrice) {
      toast({
        title: 'Invalid pricing',
        description: 'Price must be between min and max thresholds',
        variant: 'destructive',
      });
      return;
    }

    const product: Product = {
      id: editingProduct?.id || `p-${Date.now()}`,
      name: formData.name,
      category: formData.category,
      price,
      minPrice,
      maxPrice,
      unit: formData.unit,
      uom: formData.uom || formData.unit,
      sku: formData.sku,
      stock,
      stockQuantity: stock,
      costPrice: parseFloat(formData.costPrice) || 0,
      division: formData.division,
      conversionFactor: parseFloat(formData.conversionFactor) || 1,
      barcode: formData.barcode || undefined,
      hsnCode: formData.hsnCode || undefined,
      gstPercentage: parseFloat(formData.gstPercentage) || 0,
      description: formData.description || undefined,
      nameTamil: formData.nameTamil || undefined,
      isActive: true,
      createdAt: editingProduct?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    saveProduct(product);
    setProducts(getProducts());
    setShowDialog(false);
    resetForm();

    toast({
      title: editingProduct ? 'Product updated' : 'Product added',
      description: `${product.name} has been saved`,
    });
  };

  const lowStockProducts = products.filter(p => p.stock <= 10);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isImporting ? 'Importing...' : 'Import Data'}
          </Button>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                {lowStockProducts.length} product(s) have low stock (≤10 units)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>SKU/UOM</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.barcode && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {product.barcode}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{product.sku}</div>
                    <div className="text-xs text-muted-foreground">{product.uom}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ₹{product.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {product.gstPercentage || 0}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    ₹{(product.costPrice || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={product.stock <= 10 ? 'text-destructive font-medium' : ''}>
                      {product.stock} {product.uom || product.unit}
                    </span>
                    {product.lastPurchaseDate && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Last: {format(new Date(product.lastPurchaseDate), 'dd-MM-yy')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Product Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={(e) => handleAutoTranslate(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Product Name (Tamil) - Optional</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-2"
                    type="button"
                    onClick={() => handleAutoTranslate(formData.name, true)}
                    disabled={isTranslating || !formData.name.trim()}
                  >
                    {isTranslating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Languages className="h-3 w-3 mr-1" />}
                    Translate
                  </Button>
                </div>
                <Input
                  value={formData.nameTamil}
                  onChange={(e) => setFormData({ ...formData, nameTamil: e.target.value })}
                  className="TamilFont"
                  placeholder="Tamil translation"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Stock Keeping Unit"
                />
              </div>
              <div>
                <Label>UOM</Label>
                <Select
                  value={formData.uom}
                  onValueChange={(v) => setFormData({ ...formData, uom: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conversion Factor</Label>
                <Input
                  type="number"
                  value={formData.conversionFactor}
                  onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Cost Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Min Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Max Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label>Barcode (optional)</Label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Product barcode"
                />
              </div>
              <div className="col-span-2">
                <Label>HSN Code (optional)</Label>
                <Input
                  value={formData.hsnCode}
                  onChange={async (e) => {
                    const hsn = e.target.value;
                    setFormData(prev => ({ ...prev, hsnCode: hsn }));
                    if (hsn.length >= 4) {
                      // Fetch GST rate
                      const rate = await getGstRate(hsn);
                      if (rate !== null) {
                        setFormData(prev => ({ ...prev, gstPercentage: rate.toString() }));
                      }
                      
                      // Fetch product name if not already set
                      if (!formData.name) {
                        const productName = getProductNameFromHSN(hsn);
                        if (productName) {
                          setFormData(prev => ({ ...prev, name: productName }));
                        }
                      }
                    }
                  }}
                  placeholder="HSN code - auto-fetches GST & name"
                />
              </div>
              <div>
                <Label>GST %</Label>
                <Input
                  type="number"
                  value={formData.gstPercentage}
                  onChange={(e) => setFormData({ ...formData, gstPercentage: e.target.value })}
                  placeholder="e.g. 5, 12, 18"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description"
                />
              </div>

            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingProduct ? 'Update' : 'Add'} Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
