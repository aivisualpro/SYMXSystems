"use client";

import { createContext, useContext } from "react";

export interface OwnerContextType {
  users: any[]; loadingUsers: boolean; search: string; setSearch: (s: string) => void;
  fetchUsers: () => void; openAddUser: () => void; addUserOpen: boolean;
  setAddUserOpen: (open: boolean) => void;
}

export const OwnerContext = createContext<OwnerContextType | null>(null);

export function useOwner() {
  const context = useContext(OwnerContext);
  if (!context) throw new Error("useOwner must be used within OwnerLayout");
  return context;
}
