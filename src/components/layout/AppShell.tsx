import React, { useState, createContext, useContext } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Mobile sidebar state shared between AppShell, TopBar, and Sidebar
interface MobileNavContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}
const MobileNavContext = createContext<MobileNavContextValue>({ sidebarOpen: false, setSidebarOpen: () => {} });
export function useMobileNav() { return useContext(MobileNavContext); }

export function AppShell() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  React.useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <MobileNavContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
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
    </MobileNavContext.Provider>
  );
}
