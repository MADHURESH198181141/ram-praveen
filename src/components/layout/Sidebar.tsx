import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
  ClipboardPaste,
  Clock,
  Database,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPendingDues, getRecycleBin } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { PasteToBillModal } from '../billing/PasteToBillModal';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function NavItem({ to, icon, label, badge }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink
      to={to}
      className={cn(
        'pos-nav-item',
        isActive && 'active'
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-pending text-pending-foreground text-xs font-medium px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { addBulkItems } = useBilling();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const pendingDues = getPendingDues();
  const overdueDues = pendingDues.filter(d => d.isOverdue).length;
  const recycleBinCount = getRecycleBin().length;
  const [showPasteModal, setShowPasteModal] = React.useState(false);

  return (
    <aside className="pos-sidebar flex flex-col no-print">
      <nav className="space-y-1 flex-1">
        {/* Common - Billing (always visible) */}
        <NavItem
          to="/billing"
          icon={<ShoppingCart className="h-4 w-4" />}
          label={t('nav.billing')}
        />

        <button
          onClick={() => setShowPasteModal(true)}
          className="pos-nav-item w-full text-left"
        >
          <ClipboardPaste className="h-4 w-4" />
          <span className="flex-1">Paste to Bill</span>
        </button>

        <PasteToBillModal
          open={showPasteModal}
          onOpenChange={setShowPasteModal}
          onConfirm={(items) => {
            addBulkItems(items);
            navigate('/billing');
          }}
        />

        {/* Admin-only sections */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3">
                Management
              </span>
            </div>

            <NavItem
              to="/products"
              icon={<Package className="h-4 w-4" />}
              label={t('nav.products')}
            />

            <NavItem
              to="/purchase-vouchers"
              icon={<FileText className="h-4 w-4" />}
              label="Purchase Vouchers"
            />

            <NavItem
              to="/customers"
              icon={<Users className="h-4 w-4" />}
              label={t('nav.customers')}
            />

            <NavItem
              to="/bills"
              icon={<FileText className="h-4 w-4" />}
              label={t('nav.bills')}
            />

            <NavItem
              to="/dues"
              icon={<CreditCard className="h-4 w-4" />}
              label={t('nav.dues')}
              badge={overdueDues}
            />

            <div className="pt-4 pb-2">
              <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3">
                Reports
              </span>
            </div>

            <NavItem
              to="/reports"
              icon={<BarChart3 className="h-4 w-4" />}
              label={t('nav.reports')}
            />

            <NavItem
              to="/tracker-reports"
              icon={<Clock className="h-4 w-4" />}
              label="Tracker Reports"
            />

            <NavItem
              to="/settings"
              icon={<Settings className="h-4 w-4" />}
              label={t('nav.settings')}
            />

            <NavItem
              to="/settings/storage"
              icon={<Database className="h-4 w-4" />}
              label="Storage Settings"
            />

            <NavItem
              to="/recycle-bin"
              icon={<Trash2 className="h-4 w-4" />}
              label="Recycle Bin"
              badge={recycleBinCount}
            />
          </>
        )}

        {/* Employee sees limited menu */}
        {!isAdmin && (
          <>
            <NavItem
              to="/bills"
              icon={<FileText className="h-4 w-4" />}
              label="My Bills"
            />
          </>
        )}
      </nav>

      {/* Footer info */}
      <div className="pt-4 border-t border-sidebar-border mt-4">
        <div className="px-3 text-xs text-sidebar-foreground/50">
          <div>Mano Innovation Club v1.0</div>
          <div className="mt-1">© 2024 All rights reserved</div>
        </div>
      </div>
    </aside>
  );
}
