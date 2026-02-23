"use client";

import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTier } from "./constants";

// ── SortableTableHead ─────────────────────────────────────────────────────
export function SortableTableHead({ 
  label, sortKey, currentSort, requestSort, className 
}: { 
  label: React.ReactNode; 
  sortKey: string; 
  currentSort: { key: string; direction: 'asc' | 'desc' } | null; 
  requestSort: (key: string) => void; 
  className?: string; 
}) {
  const isActive = currentSort?.key === sortKey;
  return (
    <TableHead
      className={cn(className, "cursor-pointer select-none hover:bg-muted/50 transition-colors")}
      onClick={() => requestSort(sortKey)}
    >
      <div className={cn("flex items-center gap-1 group", className?.includes("text-right") ? "justify-end" : className?.includes("text-center") ? "justify-center" : "justify-start")}>
        {label}
        <span className={cn("text-muted-foreground/50 transition-colors inline-flex", isActive ? "text-foreground opacity-100" : "opacity-0 group-hover:opacity-100")}>
          {isActive ? (currentSort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
        </span>
      </div>
    </TableHead>
  );
}

// ── TierBadge ─────────────────────────────────────────────────────────────
export function TierBadge({ tier, className }: { tier: string; className?: string }) {
  const cfg = getTier(tier);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide", cfg.bg, cfg.color, cfg.border, className)}>
      {tier}
    </span>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────────────
export function ScoreBar({ score, maxScore = 100, tier, label }: { score: number; maxScore?: number; tier: string; label?: string }) {
  const cfg = getTier(tier);
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between items-baseline"><span className="text-xs text-muted-foreground">{label}</span><span className={cn("text-xs font-bold", cfg.color)}>{score} | {tier}</span></div>}
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── OverallStandingBar ────────────────────────────────────────────────────
export function OverallStandingBar({ score, tier }: { score: number; tier: string }) {
  const tiers = ["Poor", "Fair", "Great", "Fantastic", "Fantastic Plus"];
  const pct = Math.min(100, Math.max(0, score));
  const cfg = getTier(tier);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Overall Standing:</span>
        <span className={cn("text-xl font-black", cfg.color)}>{score}</span>
        <span className="text-sm text-muted-foreground">|</span>
        <TierBadge tier={tier} />
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500/20 via-amber-500/20 via-blue-500/20 via-green-500/20 to-emerald-500/20">
        <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
        {tiers.map(t => <span key={t} className={cn(t.toLowerCase() === tier.toLowerCase() ? getTier(t).color + " font-bold" : "")}>{t}</span>)}
      </div>
    </div>
  );
}

// ── MetricRow ─────────────────────────────────────────────────────────────
export function MetricRow({ icon: Icon, label, value, tier, suffix }: { icon?: any; label: string; value: string | number; tier: string; suffix?: string }) {
  const cfg = getTier(tier);
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
        <span className="text-sm text-foreground/80">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-semibold">{value}{suffix}</span>
        <TierBadge tier={tier} className="text-[9px] px-1.5 py-0" />
      </div>
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────
export function SectionHeader({ icon: Icon, title, tier, children }: { icon: any; title: string; tier: string; children?: React.ReactNode }) {
  const cfg = getTier(tier);
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-t-xl border-b", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", cfg.bg)}><Icon className={cn("h-5 w-5", cfg.color)} /></div>
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <TierBadge tier={tier} />
        {children}
      </div>
    </div>
  );
}

// ── DebouncedTextarea ─────────────────────────────────────────────────────
// Textarea that manages its own local state to avoid re-rendering the entire page on every keystroke.
// Syncs value to parent onChange on blur.
export function DebouncedTextarea({ value, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const [local, setLocal] = useState(value);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  // Sync external value changes (e.g. when switching drivers)
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <Textarea
      {...props}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => latestOnChange.current(local)}
    />
  );
}
