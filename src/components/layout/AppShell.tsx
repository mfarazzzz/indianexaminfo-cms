import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export function AppShell() {
  // Reset the page-level error boundary on route change
  // so "Something went wrong" doesn't persist when navigating away
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <ErrorBoundary fallback={<div className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-slate-200" />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<div className="fixed top-0 left-60 right-0 h-14 bg-white border-b border-slate-200" />}>
        <TopBar />
      </ErrorBoundary>
      <main id="main-content" className="ml-60 pt-14">
        <div className="min-h-[calc(100vh-3.5rem)] p-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
