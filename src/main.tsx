import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { router } from "@/router";
import { queryClient } from "@/lib/queryClient";
import { registerCoreBlocks } from "@/lib/blocks/coreBlocks";
import { initializeModuleRegistry } from "@/components/workspace/registerModules";
import { initializeInspectorRegistry } from "@/components/workspace/inspectors/registerInspectors";
import "./index.css";

// Register all built-in block types before any component renders
registerCoreBlocks()

// Initialize workspace module and inspector registries (M4)
initializeModuleRegistry()
initializeInspectorRegistry()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton />
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
