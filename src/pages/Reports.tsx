import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Package, Calendar, FileText, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getBills, getCustomers, getProducts, getPendingDues, syncBillsFromCloud } from '@/lib/storage';
import { Bill, Product } from '@/types';
import { Navigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfYear, endOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { generateTaxFilingReport, formatTaxReportAsHTML, formatTaxReportAsCSV } from '@/lib/gst-service';

type DateRange = 'today' | 'week' | 'month';

interface GSTReportItem {
  productName: string;
  productId: string;
  quantity: number;
  baseAmount: number;
  gstPercentage: number;
  gstAmount: number;
  totalAmount: number;
}

export default function Reports() {
  const { isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [bills, setBills] = useState<Bill[]>([]);
  const [reportType, setReportType] = useState<'sales' | 'gst-monthly' | 'gst-annual'>('sales');

  const loadLocalBills = React.useCallback(() => {
    setBills(getBills());
  }, []);

  useEffect(() => {
    loadLocalBills();
    syncBillsFromCloud().then(() => {
      loadLocalBills();
    });
  }, [loadLocalBills]);

  const filteredBills = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'month':
        startDate = startOfDay(subDays(now, 30));
        break;
    }

    return bills.filter(b =>
      isWithinInterval(new Date(b.createdAt), {
        start: startDate,
        end: endOfDay(now),
      })
    );
  }, [bills, dateRange]);

  // Calculate GST data for monthly report
  const gstMonthlyData = useMemo(() => {
    const gstItems: GSTReportItem[] = [];
    const productMap = new Map<string, Product>();
    
    getProducts().forEach(p => productMap.set(p.id, p));

    filteredBills.forEach(bill => {
      bill.items.forEach(item => {
        const product = productMap.get(item.productId);
        const gstPercentage = product?.gstPercentage || (item as any).gstPercentage || 0;

        // Only include items with GST
        if (gstPercentage > 0) {
          const baseAmount = item.totalPrice / (1 + gstPercentage / 100);
          const gstAmount = item.totalPrice - baseAmount;

          const existing = gstItems.find(g => g.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.baseAmount += baseAmount;
            existing.gstAmount += gstAmount;
            existing.totalAmount += item.totalPrice;
          } else {
            gstItems.push({
              productName: item.productName,
              productId: item.productId,
              quantity: item.quantity,
              baseAmount,
              gstPercentage,
              gstAmount,
              totalAmount: item.totalPrice,
            });
          }
        }
      });
    });

    return gstItems.sort((a, b) => b.gstAmount - a.gstAmount);
  }, [filteredBills]);

  // Calculate GST data for annual report
  const gstAnnualData = useMemo(() => {
    const now = new Date();
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const yearBills = bills.filter(b =>
      isWithinInterval(new Date(b.createdAt), {
        start: yearStart,
        end: yearEnd,
      })
    );

    const gstItems: GSTReportItem[] = [];
    const productMap = new Map<string, Product>();
    
    getProducts().forEach(p => productMap.set(p.id, p));

    yearBills.forEach(bill => {
      bill.items.forEach(item => {
        const product = productMap.get(item.productId);
        const gstPercentage = product?.gstPercentage || (item as any).gstPercentage || 0;

        if (gstPercentage > 0) {
          const baseAmount = item.totalPrice / (1 + gstPercentage / 100);
          const gstAmount = item.totalPrice - baseAmount;

          const existing = gstItems.find(g => g.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.baseAmount += baseAmount;
            existing.gstAmount += gstAmount;
            existing.totalAmount += item.totalPrice;
          } else {
            gstItems.push({
              productName: item.productName,
              productId: item.productId,
              quantity: item.quantity,
              baseAmount,
              gstPercentage,
              gstAmount,
              totalAmount: item.totalPrice,
            });
          }
        }
      });
    });

    return gstItems.sort((a, b) => b.gstAmount - a.gstAmount);
  }, [bills]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalSales = filteredBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const cashSales = filteredBills
      .filter(b => b.paymentMethod === 'cash')
      .reduce((sum, b) => sum + b.paidAmount, 0);
    const upiSales = filteredBills
      .filter(b => b.paymentMethod === 'upi')
      .reduce((sum, b) => sum + b.paidAmount, 0);
    const pendingAmount = filteredBills.reduce((sum, b) => sum + b.pendingAmount, 0);
    const newCustomers = filteredBills.filter(b => b.isNewCustomer).length;

    return {
      totalBills: filteredBills.length,
      totalSales,
      cashSales,
      upiSales,
      pendingAmount,
      newCustomers,
      avgBillValue: filteredBills.length > 0 ? totalSales / filteredBills.length : 0,
    };
  }, [filteredBills]);

  // Chart data - sales by day
  const dailyData = useMemo(() => {
    const days: Record<string, number> = {};
    const numDays = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30;
    
    for (let i = numDays - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'MMM dd');
      days[date] = 0;
    }

    filteredBills.forEach(bill => {
      const date = format(new Date(bill.createdAt), 'MMM dd');
      if (days[date] !== undefined) {
        days[date] += bill.totalAmount;
      }
    });

    return Object.entries(days).map(([date, amount]) => ({ date, amount }));
  }, [filteredBills, dateRange]);

  // Payment method distribution
  const paymentData = useMemo(() => {
    return [
      { name: 'Cash', value: stats.cashSales, color: 'hsl(160, 84%, 39%)' },
      { name: 'UPI', value: stats.upiSales, color: 'hsl(222, 47%, 20%)' },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Top products
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    filteredBills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredBills]);

  const allProducts = getProducts();
  const allCustomers = getCustomers();
  const pendingDues = getPendingDues();

  // Calculate totals for GST reports
  const gstMonthlySummary = useMemo(() => {
    const totalGst = gstMonthlyData.reduce((sum, item) => sum + item.gstAmount, 0);
    const totalBase = gstMonthlyData.reduce((sum, item) => sum + item.baseAmount, 0);
    const totalRevenue = gstMonthlyData.reduce((sum, item) => sum + item.totalAmount, 0);
    return { totalGst, totalBase, totalRevenue };
  }, [gstMonthlyData]);

  const gstAnnualSummary = useMemo(() => {
    const totalGst = gstAnnualData.reduce((sum, item) => sum + item.gstAmount, 0);
    const totalBase = gstAnnualData.reduce((sum, item) => sum + item.baseAmount, 0);
    const totalRevenue = gstAnnualData.reduce((sum, item) => sum + item.totalAmount, 0);
    return { totalGst, totalBase, totalRevenue };
  }, [gstAnnualData]);

  const taxFilingReport = useMemo(() => generateTaxFilingReport(bills, allProducts), [bills, allProducts]);

  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Sales and performance analytics</p>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs value={reportType} onValueChange={(v) => setReportType(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="gst-monthly">GST Monthly</TabsTrigger>
          <TabsTrigger value="gst-annual">GST Annual</TabsTrigger>
          <TabsTrigger value="tax-filing">Tax Filing</TabsTrigger>
        </TabsList>

        {/* Sales Report Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex gap-2">
            <Button
              variant={dateRange === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('today')}
            >
              Today
            </Button>
            <Button
              variant={dateRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('week')}
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('month')}
            >
              Last 30 Days
            </Button>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{stats.totalSales.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.totalBills}</div>
                    <div className="text-sm text-muted-foreground">Total Bills</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{stats.avgBillValue.toFixed(0)}</div>
                    <div className="text-sm text-muted-foreground">Avg Bill Value</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-pending/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-pending" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono text-pending">₹{stats.pendingAmount.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Pending Dues</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-6">
            {/* Sales Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Sales Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Sales']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="amount" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  {paymentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {paymentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data
                    </div>
                  )}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-sm">Cash: ₹{stats.cashSales.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm">UPI: ₹{stats.upiSales.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-3 gap-6">
            {/* Top Products */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.length > 0 ? (
                    topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">{product.quantity} units sold</div>
                        </div>
                        <div className="font-mono font-medium">₹{product.revenue.toLocaleString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No sales data for this period
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Products</span>
                  <span className="font-bold">{allProducts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Customers</span>
                  <span className="font-bold">{allCustomers.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">New Customers ({dateRange})</span>
                  <span className="font-bold text-success">{stats.newCustomers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pending Dues Count</span>
                  <span className="font-bold text-pending">{pendingDues.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Low Stock Items</span>
                  <span className="font-bold text-destructive">
                    {allProducts.filter(p => p.stock <= 10).length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GST Monthly Report Tab */}
        <TabsContent value="gst-monthly" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstMonthlySummary.totalGst.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total GST Collected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstMonthlySummary.totalBase.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Base Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstMonthlySummary.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GST Monthly Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Monthly GST Report - Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-2 font-semibold">Product Name</th>
                      <th className="text-right py-3 px-2 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-2 font-semibold">Base Amount</th>
                      <th className="text-right py-3 px-2 font-semibold">GST %</th>
                      <th className="text-right py-3 px-2 font-semibold">GST Amount</th>
                      <th className="text-right py-3 px-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstMonthlyData.length > 0 ? (
                      gstMonthlyData.map((item) => (
                        <tr key={item.productId} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{item.productName}</td>
                          <td className="text-right py-3 px-2 font-mono">{item.quantity}</td>
                          <td className="text-right py-3 px-2 font-mono">₹{item.baseAmount.toFixed(2)}</td>
                          <td className="text-right py-3 px-2 font-semibold">{item.gstPercentage}%</td>
                          <td className="text-right py-3 px-2 font-mono font-semibold text-success">₹{item.gstAmount.toFixed(2)}</td>
                          <td className="text-right py-3 px-2 font-mono">₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No GST applicable products in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GST Annual Report Tab */}
        <TabsContent value="gst-annual" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstAnnualSummary.totalGst.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total GST Collected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstAnnualSummary.totalBase.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Base Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold font-mono">₹{gstAnnualSummary.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GST Annual Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Annual GST Report - {format(new Date(), 'yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-2 font-semibold">Product Name</th>
                      <th className="text-right py-3 px-2 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-2 font-semibold">Base Amount</th>
                      <th className="text-right py-3 px-2 font-semibold">GST %</th>
                      <th className="text-right py-3 px-2 font-semibold">GST Amount</th>
                      <th className="text-right py-3 px-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstAnnualData.length > 0 ? (
                      gstAnnualData.map((item) => (
                        <tr key={item.productId} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{item.productName}</td>
                          <td className="text-right py-3 px-2 font-mono">{item.quantity}</td>
                          <td className="text-right py-3 px-2 font-mono">₹{item.baseAmount.toFixed(2)}</td>
                          <td className="text-right py-3 px-2 font-semibold">{item.gstPercentage}%</td>
                          <td className="text-right py-3 px-2 font-mono font-semibold text-success">₹{item.gstAmount.toFixed(2)}</td>
                          <td className="text-right py-3 px-2 font-mono">₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No GST applicable products in this year
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Filing Report Tab */}
        <TabsContent value="tax-filing" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Tax Filing Report (GSTR-1)
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const report = generateTaxFilingReport(bills, getProducts());
                      const html = formatTaxReportAsHTML(report);
                      const newTab = window.open();
                      if (newTab) {
                        newTab.document.write(html);
                        newTab.document.close();
                      }
                    }}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const report = generateTaxFilingReport(bills, getProducts());
                      const csv = formatTaxReportAsCSV(report);
                      const element = document.createElement('a');
                      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
                      element.setAttribute('download', `TaxFilingReport_${format(new Date(), 'yyyy-MM-dd')}.csv`);
                      element.style.display = 'none';
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold font-mono">
                          {taxFilingReport.totalItems.toString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Total HSN Items</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold font-mono">
                          ₹{taxFilingReport.totalTaxableAmount.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Taxable Amount</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold font-mono">
                          ₹{taxFilingReport.totalTax.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Tax (SGST+CGST)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-warning" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold font-mono">
                          ₹{taxFilingReport.totalAmount.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Invoice Value</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly & Annual Tax Summaries */}
              {(() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const monthlyBills = bills.filter(b => {
                  const d = new Date(b.createdAt);
                  return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                });
                const annualBills = bills.filter(b => new Date(b.createdAt).getFullYear() === currentYear);

                const calcTax = (bs: typeof bills) => {
                  let taxable = 0, tax = 0, total = 0;
                  bs.forEach(b => b.items.forEach(item => {
                    const gst = (item as any).gstPercentage || 0;
                    const base = item.totalPrice / (1 + gst / 100);
                    const t = item.totalPrice - base;
                    taxable += base;
                    tax += t;
                    total += item.totalPrice;
                  }));
                  return { taxable, tax, total };
                };

                const monthly = calcTax(monthlyBills);
                const annual = calcTax(annualBills);

                return (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Monthly GST Card */}
                    <Card className="overflow-hidden border-0 shadow-md">
                      <div className="h-1.5 bg-blue-500" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Monthly GST Summary ({now.toLocaleString('default', { month: 'long' })} {currentYear})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <div className="text-lg font-bold font-mono text-blue-800">₹{monthly.taxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">Taxable</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono text-blue-800">₹{monthly.tax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">GST (SGST+CGST)</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono text-blue-800">₹{monthly.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">Total Invoice</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Annual GST Card */}
                    <Card className="overflow-hidden border-0 shadow-md">
                      <div className="h-1.5 bg-purple-500" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Annual GST Summary (FY {currentYear}-{String(currentYear + 1).slice(2)})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <div className="text-lg font-bold font-mono text-purple-800">₹{annual.taxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">Taxable</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono text-purple-800">₹{annual.tax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">GST (SGST+CGST)</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono text-purple-800">₹{annual.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-muted-foreground">Total Invoice</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Tax Filing Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-3 px-2 font-semibold">HSN</th>
                          <th className="text-left py-3 px-2 font-semibold">Description</th>
                          <th className="text-right py-3 px-2 font-semibold">Qty</th>
                          <th className="text-right py-3 px-2 font-semibold">Unit Price</th>
                          <th className="text-right py-3 px-2 font-semibold">Taxable Amt</th>
                          <th className="text-right py-3 px-2 font-semibold">SGST %</th>
                          <th className="text-right py-3 px-2 font-semibold">SGST</th>
                          <th className="text-right py-3 px-2 font-semibold">CGST %</th>
                          <th className="text-right py-3 px-2 font-semibold">CGST</th>
                          <th className="text-right py-3 px-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxFilingReport.items.length > 0 ? (
                          taxFilingReport.items.map((item, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-mono">{item.hsnCode}</td>
                              <td className="py-3 px-2">{item.description}</td>
                              <td className="text-right py-3 px-2">{item.quantity}</td>
                              <td className="text-right py-3 px-2 font-mono">₹{item.unitPrice.toFixed(2)}</td>
                              <td className="text-right py-3 px-2 font-mono">₹{item.taxableAmount.toFixed(2)}</td>
                              <td className="text-right py-3 px-2">{item.sgstRate.toFixed(1)}%</td>
                              <td className="text-right py-3 px-2 font-mono">₹{item.sgstAmount.toFixed(2)}</td>
                              <td className="text-right py-3 px-2">{item.cgstRate.toFixed(1)}%</td>
                              <td className="text-right py-3 px-2 font-mono">₹{item.cgstAmount.toFixed(2)}</td>
                              <td className="text-right py-3 px-2 font-mono font-semibold">₹{item.totalAmount.toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-muted-foreground">
                              No data available for tax filing
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
