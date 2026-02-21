"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface HeaderActionsContextType {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
  leftContent: ReactNode | null;
  setLeftContent: (content: ReactNode | null) => void;
  rightContent: ReactNode | null;
  setRightContent: (content: ReactNode | null) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(
  undefined
);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode | null>(null);
  const [leftContent, setLeftContent] = useState<ReactNode | null>(null);
  const [rightContent, setRightContent] = useState<ReactNode | null>(null);
  const pathname = usePathname();

  // Clear all header actions on route change so stale content
  // from the previous page never flashes during client-side navigation
  useEffect(() => {
    setActions(null);
    setLeftContent(null);
    setRightContent(null);
  }, [pathname]);

  return (
    <HeaderActionsContext.Provider 
      value={{ 
        actions, 
        setActions, 
        leftContent, 
        setLeftContent, 
        rightContent, 
        setRightContent 
      }}
    >
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  const context = useContext(HeaderActionsContext);
  if (context === undefined) {
    return { 
      actions: null, 
      setActions: () => {}, 
      leftContent: null, 
      setLeftContent: () => {}, 
      rightContent: null, 
      setRightContent: () => {} 
    };
  }
  return context;
}
