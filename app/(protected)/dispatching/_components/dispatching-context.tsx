"use client";

import { createContext, useContext } from "react";

export interface DispatchingStats {
  employeeCount?: number;
  groupCount?: number;
  filteredFrom?: number;
}

export interface DispatchingContextType {
  selectedWeek: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  weekDates: string[];
  availableWeeks: string[];
  searchQuery: string;
  routesGenerated: boolean;
  routesLoading: boolean;
  refreshRoutes: () => void;
  refreshKey: number;
  setStats: (stats: DispatchingStats) => void;
  showRoutesInfo: boolean;
  setShowRoutesInfo: (show: boolean) => void;
  globalEditMode: boolean;
  setGlobalEditMode: (mode: boolean) => void;
  confirmationFilter: string;
  setConfirmationFilter: (filter: string) => void;
  rawRouteData: any;
  rawRouteDataLoading: boolean;
}

export const DispatchingContext = createContext<DispatchingContextType>({
  selectedWeek: "", selectedDate: "", setSelectedDate: () => {}, weekDates: [], availableWeeks: [], searchQuery: "",
  routesGenerated: false, routesLoading: false, refreshRoutes: () => {}, refreshKey: 0, setStats: () => {},
  showRoutesInfo: false, setShowRoutesInfo: () => {}, globalEditMode: false, setGlobalEditMode: () => {},
  confirmationFilter: "all", setConfirmationFilter: () => {}, rawRouteData: null, rawRouteDataLoading: false,
});

export function useDispatching() {
  return useContext(DispatchingContext);
}
