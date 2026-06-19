import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from 'sonner';
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SystemProvider } from "@/contexts/SystemContext";
import { BillingProvider } from "@/contexts/BillingContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ensureAdminUser, purgeExpiredRecycleBinItems } from "@/lib/storage";
import { startRealtimeSync, stopRealtimeSync } from "@/lib/realtimeSyncManager";
import { MainLayout } from "@/components/layout/MainLayout";
import storageService from "@/services/storageService";

// Pages
import Login from "./pages/Login";
import Billing from "./pages/Billing";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Bills from "./pages/Bills";
import PendingDues from "./pages/PendingDues";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import StorageSettings from "./pages/StorageSettings";
import PurchaseVouchers from "./pages/PurchaseVouchers";
import PurchaseVoucherForm from "./pages/PurchaseVoucherForm";
import TaskTracker from "./pages/TaskTracker";
import TrackerReports from "./pages/TrackerReports";
import RecycleBin from "./pages/RecycleBin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createHashRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/tracker",
    element: <TaskTracker />,
  },
  {
    element: <MainLayout />,
    children: [
      { path: "billing", element: <Billing /> },
      { path: "products", element: <Products /> },
      { path: "purchase-vouchers", element: <PurchaseVouchers /> },
      { path: "purchase-vouchers/new", element: <PurchaseVoucherForm /> },
      { path: "purchase-vouchers/:id", element: <PurchaseVoucherForm /> },
      { path: "customers", element: <Customers /> },
      { path: "bills", element: <Bills /> },
      { path: "dues", element: <PendingDues /> },
      { path: "reports", element: <Reports /> },
      { path: "tracker-reports", element: <TrackerReports /> },
      { path: "settings", element: <Settings /> },
      { path: "settings/storage", element: <StorageSettings /> },
      { path: "recycle-bin", element: <RecycleBin /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/billing" replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

const App = () => {
  useEffect(() => {
    // ── Production boot sequence ──────────────────────────────────────────────
    // 1. Ensure at least one admin user exists (no sample data)
    ensureAdminUser();

    // 2. Purge expired recycle bin items (older than 30 days)
    purgeExpiredRecycleBinItems();

    // 3. Start Supabase Realtime sync
    startRealtimeSync();

    // 4. Verify storage folder on startup
    const verifyStorage = async () => {
      try {
        const settings = await storageService.getStorageSettings();
        const exists = await storageService.checkStorageFolderExists(settings.storagePath);
        if (!exists) {
          toast.error("Storage folder not found. Please select a new storage location.", {
            duration: 10000,
            action: {
              label: 'Fix Settings',
              onClick: () => {
                window.location.hash = '#/settings/storage';
              }
            }
          });
        } else {
          await storageService.ensureStorageFolders(settings.storagePath);
        }
      } catch (err) {
        console.error('Failed to verify storage on startup:', err);
      }
    };
    verifyStorage();

    // Cleanup on unmount
    return () => {
      stopRealtimeSync();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <SystemProvider>
            <BillingProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <RouterProvider router={router} />
              </TooltipProvider>
            </BillingProvider>
          </SystemProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
