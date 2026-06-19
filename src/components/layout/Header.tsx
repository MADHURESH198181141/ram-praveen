import React, { useState } from 'react';
import { LogOut, Wifi, WifiOff, RefreshCw, Cloud, Languages, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Language } from '@/lib/translations';

export function Header() {
  const { user, logout, isAdmin, changePassword } = useAuth();
  const { connectionStatus, pendingSyncCount, syncPendingData } = useSystem();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();

  const isOnline = connectionStatus === 'online';

  // Change password dialog state
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const openChangePwd = () => {
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setShowChangePwd(true);
  };

  const handleChangePwd = () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }
    if (newPwd.length < 4) {
      toast({ title: 'Password too short', description: 'Minimum 4 characters.', variant: 'destructive' });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    const ok = changePassword(currentPwd, newPwd);
    if (ok) {
      setShowChangePwd(false);
      toast({ title: '✅ Password changed!', description: 'Your new password is active.' });
    } else {
      toast({ title: 'Incorrect current password', variant: 'destructive' });
    }
  };

  return (
    <>
      <header className="pos-header no-print">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden bg-white flex items-center justify-center p-0.5">
              <img src="logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Mano Innovation Club</h1>
              <div className="text-xs opacity-70">
                {isAdmin ? t('header.admin_dashboard') : t('header.billing_counter')}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10">
                <Languages className="h-4 w-4" />
                <span className="text-xs uppercase">{language}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ta')}>தமிழ்</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('hi')}>हिंदी</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connection Status */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            isOnline
              ? 'bg-success/20 text-success'
              : 'bg-warning/20 text-warning'
          )}>
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span>{t('header.online')}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>{t('header.offline')}</span>
              </>
            )}
          </div>

          {/* Pending Sync Count */}
          {pendingSyncCount > 0 && isOnline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={syncPendingData}
              className="text-warning hover:text-warning h-8 gap-1.5"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span className="text-xs">{pendingSyncCount} {t('header.pending_sync')}</span>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}

          {/* User Info + Change Password dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-primary-foreground hover:bg-white/20 transition-colors cursor-pointer">
                {(user as any)?.photo ? (
                  <img
                    src={(user as any).photo}
                    alt={user?.name}
                    className="w-7 h-7 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-sm font-medium leading-none">{user?.name}</div>
                  <div className="text-xs opacity-70 capitalize mt-0.5">{user?.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={openChangePwd} className="gap-2 cursor-pointer">
                <KeyRound className="h-4 w-4" />
                Change My Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Change My Password Dialog ─────────────────────────────────────────── */}
      <Dialog open={showChangePwd} onOpenChange={setShowChangePwd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Change My Password
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current password */}
            <div className="space-y-1">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePwd(false)}>Cancel</Button>
            <Button
              onClick={handleChangePwd}
              disabled={!currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
            >
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
