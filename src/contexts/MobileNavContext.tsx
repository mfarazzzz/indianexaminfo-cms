import React, { createContext, useContext, useState } from "react";

interface MobileNavContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavContextValue>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <MobileNavContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      {children}
    </MobileNavContext.Provider>
  );
}
