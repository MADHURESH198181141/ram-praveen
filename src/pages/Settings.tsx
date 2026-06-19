import React, { useState, useEffect } from 'react';
import { Save, Store, Users, Plus, Trash2, Languages, FileText, QrCode, Pencil, UserCircle2, KeyRound, Eye, EyeOff, Database, Calendar, TrendingUp, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSettings, saveSettings, getUsers, saveUser, getCategories, saveCategory, AppSettings, setUserPassword, computeDailyTaxReport, computeMonthlyTaxReport, saveTaxReportToCloud, getDailySalesReports, formatApplication } from '@/lib/storage';
import { User, Category, UserRole, DailySalesReport } from '@/types';
import { Navigate } from 'react-router-dom';
import { Language } from '@/lib/translations';
import { format } from 'date-fns';

// ─── Blank form shape ───────────────────────────────────────────────────────
const BLANK_FORM = { name: '', phone: '', barcode: '', role: 'employee' as UserRole, photo: '' };

export default function Settings() {
  // ── Format Application state
  const [showFormatDialog, setShowFormatDialog] = React.useState(false);
  const [formatConfirmText, setFormatConfirmText] = React.useState('');
  const [isFormatting, setIsFormatting] = React.useState(false);

  const handleFormatApplication = async () => {
    if (formatConfirmText !== 'FORMAT') return;
    setIsFormatting(true);
    try {
      await formatApplication();
    } catch (err) {
      console.error('Format failed:', err);
      setIsFormatting(false);
      setShowFormatDialog(false);
      setFormatConfirmText('');
    }
  };
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();

  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // User dialog state
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState(BLANK_FORM);

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Reset password (admin only)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Category dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Tax report state
  const [taxReports, setTaxReports] = useState<DailySalesReport[]>([]);
  const [savingDaily, setSavingDaily] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);

  const loadTaxReports = async () => {
    setLoadingReports(true);
    const reports = await getDailySalesReports();
    setTaxReports(reports);
    setLoadingReports(false);
  };

  useEffect(() => {
    setUsers(getUsers());
    setCategories(getCategories());
    loadTaxReports();
  }, []);

  if (!isAdmin) {
    return <Navigate to="/billing" replace />;
  }

  // ── Tax Report Handlers ────────────────────────────────────────────────────
  const handleSaveDailyTax = async () => {
    setSavingDaily(true);
    try {
      const report = computeDailyTaxReport();
      const { error } = await saveTaxReportToCloud(report);
      if (error) {
        toast({ title: 'Failed to save daily tax', description: error, variant: 'destructive' });
      } else {
        toast({
          title: '✅ Daily tax saved!',
          description: `Today's tax report (₹${report.total_tax.toFixed(2)} GST on ${report.total_bills} bills) saved to database.`,
        });
        await loadTaxReports();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingDaily(false);
    }
  };

  const handleSaveMonthlyTax = async () => {
    setSavingMonthly(true);
    try {
      const report = computeMonthlyTaxReport();
      const { error } = await saveTaxReportToCloud(report);
      if (error) {
        toast({ title: 'Failed to save monthly tax', description: error, variant: 'destructive' });
      } else {
        toast({
          title: '✅ Monthly tax saved!',
          description: `This month's tax report (₹${report.total_tax.toFixed(2)} GST on ${report.total_bills} bills) saved to database.`,
        });
        await loadTaxReports();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingMonthly(false);
    }
  };


  // ── Helpers ────────────────────────────────────────────────────────────────
  const refreshUsers = () => setUsers(getUsers());

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm(BLANK_FORM);
    setShowUserDialog(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      phone: user.phone || '',
      barcode: user.barcode || '',
      role: user.role,
      photo: (user as any).photo || '',
    });
    setShowUserDialog(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUserForm(f => ({ ...f, photo: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  // ── Save (Add or Edit) ─────────────────────────────────────────────────────
  const handleSaveUser = () => {
    if (!userForm.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const user: User = {
      id: editingUser ? editingUser.id : `user-${Date.now()}`,
      name: userForm.name.trim(),
      phone: userForm.phone,
      barcode: userForm.barcode || undefined,
      role: userForm.role,
      isActive: editingUser ? editingUser.isActive : true,
      createdAt: editingUser ? editingUser.createdAt : new Date(),
      ...(userForm.photo ? { photo: userForm.photo } : {}),
    } as User & { photo?: string };

    saveUser(user);
    refreshUsers();
    setShowUserDialog(false);

    toast({
      title: editingUser ? 'User updated' : 'User added',
      description: `${user.name} (${user.role}) has been ${editingUser ? 'updated' : 'added'}.`,
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteUser = (userId: string) => {
    const allUsers = getUsers().map(u =>
      u.id === userId ? { ...u, isActive: false } : u
    );
    allUsers.forEach(saveUser);
    refreshUsers();
    setDeleteUserId(null);
    toast({ title: 'User removed', description: 'The user has been deactivated.' });
  };

  // ── Admin Reset Password ───────────────────────────────────────────────────
  const openResetPwd = (user: User) => {
    setResetPwdUser(user);
    setNewPwd('');
    setConfirmPwd('');
  };

  const handleResetPwd = () => {
    if (!resetPwdUser) return;
    if (newPwd.length < 4) {
      toast({ title: 'Password too short', description: 'Minimum 4 characters.', variant: 'destructive' });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setUserPassword(resetPwdUser.id, newPwd);
    setResetPwdUser(null);
    toast({ title: '✅ Password reset!', description: `${resetPwdUser.name}'s password has been updated.` });
  };

  // ── Toggle Active ──────────────────────────────────────────────────────────
  const handleToggleActive = (user: User) => {
    saveUser({ ...user, isActive: !user.isActive });
    refreshUsers();
    toast({
      title: user.isActive ? 'User deactivated' : 'User activated',
      description: `${user.name} is now ${user.isActive ? 'inactive' : 'active'}.`,
    });
  };

  // ── Settings ───────────────────────────────────────────────────────────────
  const handleSaveSettings = () => {
    saveSettings(settings);
    toast({ title: 'Settings saved', description: 'Store settings have been updated' });
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const category: Category = {
      id: `cat-${Date.now()}`,
      name: newCategory.trim(),
      sortOrder: categories.length + 1,
    };
    saveCategory(category);
    setCategories(getCategories());
    setShowCategoryDialog(false);
    setNewCategory('');
    toast({ title: 'Category added', description: `${category.name} has been added` });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('nav.settings')}</h1>
        <p className="text-muted-foreground">Manage store configuration and users</p>
      </div>

      {/* Storage Settings Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Local Storage & Backups
          </CardTitle>
          <CardDescription>Configure local folder paths for bills, images, database, and database backups.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.hash = '#/settings/storage'}>
            Manage Storage Settings
          </Button>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Language Preference
          </CardTitle>
          <CardDescription>Select your preferred language for the application UI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(['en', 'ta', 'hi'] as Language[]).map((lang) => (
              <Button
                key={lang}
                variant={language === lang ? 'default' : 'outline'}
                onClick={() => setLanguage(lang)}
                className="min-w-[120px]"
              >
                {lang === 'en' ? 'English' : lang === 'ta' ? 'தமிழ்' : 'हिंदी'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Store Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Information
          </CardTitle>
          <CardDescription>Basic store details that appear on bills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Store Name</Label>
              <Input
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={settings.storePhone}
                onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={settings.storeAddress}
                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
              />
            </div>
            <div>
              <Label>UPI ID</Label>
              <Input
                value={settings.upiId}
                onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                placeholder="store@upi"
              />
            </div>
            <div>
              <Label>Default Due Days</Label>
              <Input
                type="number"
                value={settings.defaultDueDays}
                onChange={(e) => setSettings({ ...settings, defaultDueDays: parseInt(e.target.value) || 7 })}
                min="1"
                max="90"
              />
            </div>
            <div className="col-span-2">
              <Label>FastGST API Key</Label>
              <Input
                value={settings.fastGstApiKey || ''}
                onChange={(e) => setSettings({ ...settings, fastGstApiKey: e.target.value })}
                placeholder="FGST_LIVE_..."
              />
              <p className="text-[10px] text-muted-foreground italic mt-1">Required for automated HSN and GST lookups</p>
            </div>
          </div>
          <Button onClick={handleSaveSettings}>
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Bill Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bill Layout
          </CardTitle>
          <CardDescription>Customize the content and appearance of printed bills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Bill Footer Message (Line 1)</Label>
              <Input
                value={settings.billFooterMessage}
                onChange={(e) => setSettings({ ...settings, billFooterMessage: e.target.value })}
                placeholder="e.g. *** நன்றி மீண்டும் வருக ***"
              />
              <p className="text-[10px] text-muted-foreground italic">Appears in bold at the bottom of the bill</p>
            </div>
            <div className="space-y-2">
              <Label>Bill Footer Sub-message (Line 2)</Label>
              <Input
                value={settings.billFooterSubMessage}
                onChange={(e) => setSettings({ ...settings, billFooterSubMessage: e.target.value })}
                placeholder="e.g. வரும் ஞாயிற்றுக்கிழமை கடை மாலை 6 மணி வரை உண்டு"
              />
              <p className="text-[10px] text-muted-foreground italic">Appears below the main footer message</p>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Show UPI QR Code
                </div>
                <div className="text-xs text-muted-foreground">
                  Display UPI payment QR code on delivery bills
                </div>
              </div>
              <Select
                value={settings.showQrOnBill ? 'true' : 'false'}
                onValueChange={(v) => setSettings({ ...settings, showQrOnBill: v === 'true' })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* QR Code Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Upload UPI QR Code Image
              </Label>
              <p className="text-xs text-muted-foreground">Upload your custom QR code image (PNG/JPG). It will appear on delivery bills instead of the auto-generated QR.</p>
              <div className="flex items-center gap-4">
                <input
                  id="qr-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setSettings({ ...settings, upiQrImageBase64: ev.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('qr-upload')?.click()}
                >
                  Choose Image
                </Button>
                {settings.upiQrImageBase64 && (
                  <div className="flex items-center gap-2">
                    <img src={settings.upiQrImageBase64} alt="QR Code" className="w-16 h-16 border rounded object-contain" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive text-xs"
                      onClick={() => setSettings({ ...settings, upiQrImageBase64: undefined })}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Button onClick={handleSaveSettings}>
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* ── Users Management ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>Manage admin and employee accounts</CardDescription>
          </div>
          <Button onClick={openAddUser}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  {/* Avatar / Photo */}
                  <TableCell>
                    {(user as any).photo ? (
                      <img
                        src={(user as any).photo}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.phone || '-'}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{user.barcode || '-'}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(user)}
                      title="Click to toggle active/inactive"
                      className="cursor-pointer"
                    >
                      <Badge
                        variant={user.isActive ? 'default' : 'secondary'}
                        className={user.isActive
                          ? 'bg-success/10 text-success border-0 hover:bg-success/20'
                          : 'bg-muted text-muted-foreground border-0 hover:bg-destructive/10 hover:text-destructive'
                        }
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditUser(user)}
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {/* Reset Password */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openResetPwd(user)}
                        title="Reset password"
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteUserId(user.id)}
                        title="Remove user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Product Categories</CardTitle>
            <CardDescription>Manage product categories for organization</CardDescription>
          </div>
          <Button onClick={() => setShowCategoryDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('common.add')} Category
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Badge key={cat.id} variant="secondary" className="px-3 py-1.5">
                {cat.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Tax Database Reports ─────────────────────────────────────────────── */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Tax Database Reports
              </CardTitle>
              <CardDescription>Save daily and monthly tax summaries to the database (Supabase daily_sales_reports)</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadTaxReports}
              disabled={loadingReports}
              className="gap-2"
            >
              {loadingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily Tax */}
            <div className="flex flex-col gap-3 p-4 rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Today's Tax Report</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(), 'dd MMM yyyy')}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Computes and stores today's GST, sales, and billing summary into the database.
              </p>
              <Button
                onClick={handleSaveDailyTax}
                disabled={savingDaily}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                id="save-daily-tax-btn"
              >
                {savingDaily ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Save Today's Tax</>
                )}
              </Button>
            </div>

            {/* Monthly Tax */}
            <div className="flex flex-col gap-3 p-4 rounded-xl border bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20 border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Monthly Tax Report</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Aggregates the entire month's GST collection and saves a monthly summary to the database.
              </p>
              <Button
                onClick={handleSaveMonthlyTax}
                disabled={savingMonthly}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                id="save-monthly-tax-btn"
              >
                {savingMonthly ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Save Monthly Tax</>
                )}
              </Button>
            </div>
          </div>

          {/* Saved Reports History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Saved Reports History</span>
              <Badge variant="secondary" className="text-xs">{taxReports.length} records</Badge>
            </div>
            {loadingReports ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading reports…
              </div>
            ) : taxReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 border rounded-xl bg-muted/20">
                <Database className="h-8 w-8 opacity-30" />
                <p className="text-sm">No reports saved yet. Use the buttons above to save your first report.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-3 font-semibold">Type</th>
                        <th className="text-left py-3 px-3 font-semibold">Date</th>
                        <th className="text-right py-3 px-3 font-semibold">Bills</th>
                        <th className="text-right py-3 px-3 font-semibold">Total Tax (GST)</th>
                        <th className="text-right py-3 px-3 font-semibold">Total Sales</th>
                        <th className="text-right py-3 px-3 font-semibold">Cash</th>
                        <th className="text-right py-3 px-3 font-semibold">UPI</th>
                        <th className="text-right py-3 px-3 font-semibold">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxReports.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={r.report_type === 'daily'
                                ? 'border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                                : 'border-violet-400 text-violet-600 bg-violet-50 dark:bg-violet-950/30'
                              }
                            >
                              {r.report_type === 'daily' ? '📅 Daily' : '📆 Monthly'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">
                            {r.report_type === 'monthly'
                              ? format(new Date(r.report_date + 'T12:00:00'), 'MMMM yyyy')
                              : format(new Date(r.report_date + 'T12:00:00'), 'dd MMM yyyy')
                            }
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.total_bills}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">₹{r.total_tax.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">₹{r.total_amount.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs">₹{r.cash_sales.toFixed(0)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs">₹{r.upi_sales.toFixed(0)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-amber-600">₹{r.pending_amount.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Add / Edit User Dialog ───────────────────────────────────────────── */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3">
              {userForm.photo ? (
                <img
                  src={userForm.photo}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                  <UserCircle2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex gap-2">
                <input
                  id="user-photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('user-photo-upload')?.click()}
                >
                  {userForm.photo ? 'Change Photo' : 'Add Photo'}
                </Button>
                {userForm.photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setUserForm(f => ({ ...f, photo: '' }))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label>Name *</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(v) => setUserForm(f => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Barcode / Employee ID</Label>
              <Input
                value={userForm.barcode}
                onChange={(e) => setUserForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="EMP001"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Save Changes' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user. Their billing history will be preserved.
              You can reactivate them later by clicking their status badge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserId && handleDeleteUser(deleteUserId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.add')} Category</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Category Name</Label>
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g., Electronics"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddCategory}>{t('common.add')} Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admin: Reset User Password Dialog ───────────────────────────────── */}
      <Dialog open={!!resetPwdUser} onOpenChange={() => setResetPwdUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-500" />
              Reset Password — {resetPwdUser?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for <strong>{resetPwdUser?.name}</strong>.
              They will need to use this password to log in next time.
            </p>

            {/* New password */}
            <div className="space-y-1">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdUser(null)}>Cancel</Button>
            <Button
              onClick={handleResetPwd}
              disabled={!newPwd || !confirmPwd || newPwd !== confirmPwd}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Format Application Maintenance Card ───────────────────────────── */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Maintenance
          </CardTitle>
          <CardDescription>
            Danger zone — these actions are irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <div className="font-semibold text-sm">Format Application</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Wipes all local data, cloud records, and storage files. Resets to factory state.
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setShowFormatDialog(true); setFormatConfirmText(''); }}
            >
              Format Application
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Format Application Confirmation Dialog ────────────────────────── */}
      <AlertDialog open={showFormatDialog} onOpenChange={(open) => { if (!open && !isFormatting) { setShowFormatDialog(false); setFormatConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Format Application?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="font-medium mb-2">This will permanently delete:</p>
              <ul className="list-disc list-inside text-sm space-y-1 mb-3">
                <li>All products and categories</li>
                <li>All customers and their history</li>
                <li>All bills and payment records</li>
                <li>All purchase vouchers</li>
                <li>All employees (except the admin login)</li>
                <li>All Supabase cloud data</li>
                <li>All bill images and reports on disk</li>
              </ul>
              <p className="text-xs text-muted-foreground">This action <strong>cannot be undone</strong>. Type <code className="bg-muted px-1 rounded">FORMAT</code> to confirm.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Input
              value={formatConfirmText}
              onChange={(e) => setFormatConfirmText(e.target.value)}
              placeholder="Type FORMAT to confirm"
              className="font-mono"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFormatting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={formatConfirmText !== 'FORMAT' || isFormatting}
              onClick={handleFormatApplication}
            >
              {isFormatting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Formatting...</>
              ) : (
                'Format Everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

