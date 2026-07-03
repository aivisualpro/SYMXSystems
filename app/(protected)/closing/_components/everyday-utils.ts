/**
 * Shared constants and utility functions for the Everyday module.
 * Extracted from page.tsx to reduce bundle size.
 */

import type { LucideIcon } from "lucide-react";
import {
  Navigation, DoorOpen, DoorClosed, Coffee, PhoneOff, GraduationCap,
  TruckIcon, CalendarOff, UserCheck, BookOpen, Ban, ShieldAlert, Clock,
} from "lucide-react";

/** Business timezone — all date computations use Pacific Time */
export const BUSINESS_TZ = "America/Los_Angeles";

export function getTodayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

export function getCurrentYearWeek(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay();
  const sundayOfThisWeek = new Date(date);
  sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
  const year = sundayOfThisWeek.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

// ── Type Options — exact copy from dispatching/routes ──
export interface TypeOption {
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
}

export const TYPE_OPTIONS: TypeOption[] = [
  { label: "Route", icon: Navigation, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
  { label: "Open", icon: DoorOpen, bg: "bg-amber-400/80", text: "text-white", border: "border-amber-500/60" },
  { label: "Close", icon: DoorClosed, bg: "bg-rose-400/80", text: "text-white", border: "border-rose-500/60" },
  { label: "Off", icon: Coffee, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" },
  { label: "Call Out", icon: PhoneOff, bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600" },
  { label: "AMZ Training", icon: GraduationCap, bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700" },
  { label: "Fleet", icon: TruckIcon, bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },
  { label: "Request Off", icon: CalendarOff, bg: "bg-purple-600", text: "text-white", border: "border-purple-700" },
  { label: "Trainer", icon: UserCheck, bg: "bg-teal-600", text: "text-white", border: "border-teal-700" },
  { label: "Training OTR", icon: BookOpen, bg: "bg-violet-600", text: "text-white", border: "border-violet-700" },
  { label: "Suspension", icon: Ban, bg: "bg-rose-700", text: "text-white", border: "border-rose-800" },
  { label: "Modified Duty", icon: ShieldAlert, bg: "bg-amber-600", text: "text-white", border: "border-amber-700" },
  { label: "Stand by", icon: Clock, bg: "bg-cyan-600", text: "text-white", border: "border-cyan-700" },
];

export const TYPE_MAP = new Map(TYPE_OPTIONS.map(opt => [opt.label.toLowerCase(), opt]));

export function getTypeStyle(value: string): { bg: string; text: string; border: string } {
  if (!value || value.trim() === "")
    return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
  const opt = TYPE_MAP.get(value.trim().toLowerCase());
  if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
  return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
}

export function formatWeekLabel(week: string): string {
  const match = week.match(/(\d{4})-W(\d{2})/);
  if (!match) return week;
  return `${match[1]} – Week ${parseInt(match[2])}`;
}
