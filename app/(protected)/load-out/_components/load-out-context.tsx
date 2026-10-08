"use client";

import { createContext, useContext } from "react";

export interface LoadOutStats {
    routes?: number;
    operations?: number;
    rescue?: number;
    trainer?: number;
    reduction?: number;
    avgRouteDuration?: number | string;
    avgPackageCount?: number;
    totalPackageCount?: number;
}

interface LoadOutContextType {
    selectedWeek: string;
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    weekDates: string[];
    searchQuery: string;
    routesGenerated: boolean;
    routesLoading: boolean;
    refreshRoutes: () => void;
    refreshKey: number;
    setStats: (stats: LoadOutStats) => void;
    showRoutesInfo: boolean;
    setShowRoutesInfo: (show: boolean) => void;
    globalEditMode: boolean;
    setGlobalEditMode: (mode: boolean) => void;
    confirmationFilter: string;
    setConfirmationFilter: (filter: string) => void;
    rawRouteData: any;
    rawRouteDataLoading: boolean;
}

export const LoadOutContext = createContext<LoadOutContextType>({
    selectedWeek: "", selectedDate: "", setSelectedDate: () => {}, weekDates: [],
    searchQuery: "", routesGenerated: false, routesLoading: false,
    refreshRoutes: () => {}, refreshKey: 0, setStats: () => {},
    showRoutesInfo: false, setShowRoutesInfo: () => {}, globalEditMode: false,
    setGlobalEditMode: () => {}, confirmationFilter: "all",
    setConfirmationFilter: () => {}, rawRouteData: null, rawRouteDataLoading: false,
});

export function useLoadOut() {
    return useContext(LoadOutContext);
}
