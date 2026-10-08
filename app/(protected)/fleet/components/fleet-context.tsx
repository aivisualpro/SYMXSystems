"use client";

import { createContext, useContext } from "react";

interface FleetData { [key: string]: any }
interface SeedPage { data: any[]; total: number; hasMore: boolean; fetchedAt: number }

export interface FleetContextType {
  data: FleetData | null; loading: boolean; search: string; setSearch: (s: string) => void;
  fetchData: () => void; openCreateModal: (type: string) => void;
  openEditModal: (type: string, item: any) => void; handleDelete: (type: string, id: string) => void;
  modalOpen: boolean; setModalOpen: (open: boolean) => void; modalType: string; formData: any;
  updateForm: (key: string, value: any) => void; handleSave: () => void; saving: boolean;
  editId: string | null; repairsSeed: SeedPage | null; inspectionsSeed: SeedPage | null;
  rentalsSeed: any[] | null; showReturned: boolean; setShowReturned: (v: boolean) => void;
  showCompleted: boolean; setShowCompleted: (v: boolean) => void;
  showStandardOnly: boolean; setShowStandardOnly: (v: boolean) => void;
}

export const FleetContext = createContext<FleetContextType | null>(null);

export function useFleet() {
  const context = useContext(FleetContext);
  if (!context) throw new Error("useFleet must be used within FleetLayout");
  return context;
}
