import React, { useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getPendingDues } from '@/lib/storage';
import { isAfter } from 'date-fns';

export function MainLayout() {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const notificationShown = useRef(false);

  useEffect(() => {
    if (isAuthenticated && isAdmin && !notificationShown.current) {
      const now = new Date();
      const overdueDues = getPendingDues().filter(due =>
        isAfter(now, new Date(due.dueDate))
      );

      if (overdueDues.length > 0) {
        toast.error(`Attention! You have ${overdueDues.length} overdue bills!`, {
          description: "Click to view and collect pending payments.",
          duration: 15000,
          closeButton: true,
          action: {
            label: "View Dues",
            onClick: () => navigate('/dues'),
          },
        });
      }
      notificationShown.current = true;
    }
  }, [isAuthenticated, isAdmin, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-glass-gradient dark:bg-glass-gradient-dark bg-cover bg-fixed animate-fade-in relative z-0">
      {/* Decorative blurred blobs for the "wow" glassmorphism effect */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/30 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-soft"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-accent/30 blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <Header />
      <div className="flex flex-1 relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-transparent p-4">
          <div className="animate-slide-in h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
