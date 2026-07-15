import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { MobileNavProvider, useMobileNav } from "@/contexts/MobileNavContext";

function AppShellInner() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useMobileNav();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname, setSidebarOpen]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <ErrorBoundary fallback={<div className="hidden lg:block fixed left-0 top-0 h-screen w-60 bg-white border-r border-slate-200" />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<div className="fixed top-0 left-0 lg:left-60 right-0 h-14 bg-white border-b border-slate-200" />}>
        <TopBar />
      </ErrorBoundary>
      <main id="main-content" className="lg:ml-60 pt-14">
        <div className="min-h-[calc(100vh-3.5rem)] p-4 sm:p-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export function AppShell() {
  return (
    <MobileNavProvider>
      <AppShellInner />
    </MobileNavProvider>
  );
}
