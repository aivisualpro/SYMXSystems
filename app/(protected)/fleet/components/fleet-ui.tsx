"use client";

import React from "react";
import { IconCar, IconPlus } from "@tabler/icons-react";

// ── Status Colors ─────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Grounded: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  Inactive: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  Empty: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Decommissioned: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "Not Started": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Waiting for Parts": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "Sent to Repair Shop": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Fail: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Needs Attention": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_COLORS[status] || "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30"}`}>
      {status}
    </span>
  );
}

export function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, icon: Icon, count, onAdd }: { title: string; icon: any; count?: number; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">{count}</span>
        )}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors">
          <IconPlus size={14} /> Add
        </button>
      )}
    </div>
  );
}

export function KPICard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: any; sub?: string; color: string }) {
  return (
    <div className="relative group overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-primary/[0.03] group-hover:to-transparent transition-all duration-500" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color} transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export function FleetLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <IconCar size={20} className="absolute inset-0 m-auto text-primary" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
}
