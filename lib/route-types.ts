import {
    Navigation, DoorOpen, DoorClosed, Coffee, PhoneOff, GraduationCap,
    TruckIcon, CalendarOff, UserCheck, BookOpen, Ban, ShieldAlert, Clock, AlertTriangle, Minus, type LucideIcon
} from "lucide-react";

export interface TypeOption {
    label: string;
    icon: LucideIcon;
    bg: string;
    text: string;
    border: string;
    dotColor: string;
    colorHex?: string;
}

export const getContrastText = (hex?: string) => {
    if (!hex) return "#ffffff";
    const cleanHex = hex.replace("#", "");
    if (cleanHex.length !== 6) return "#ffffff";
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#000000" : "#ffffff";
};

export const TYPE_OPTIONS: TypeOption[] = [
    { label: "Route", icon: Navigation, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", dotColor: "bg-emerald-500", colorHex: "#06923E" },
    { label: "Off", icon: Coffee, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-600 dark:text-zinc-300", border: "border-zinc-200 dark:border-zinc-600", dotColor: "bg-zinc-400", colorHex: "#686D76" },
    { label: "Open", icon: DoorOpen, bg: "bg-amber-400/80", text: "text-white", border: "border-amber-500/60", dotColor: "bg-amber-400", colorHex: "#FF8383" },
    { label: "Close", icon: DoorClosed, bg: "bg-rose-400/80", text: "text-white", border: "border-rose-500/60", dotColor: "bg-rose-400", colorHex: "#F9B2D7" },
    { label: "Rescue", icon: AlertTriangle, bg: "bg-blue-400", text: "text-white", border: "border-blue-500", dotColor: "bg-blue-400", colorHex: "#7DAACB" },
    { label: "Call Out", icon: PhoneOff, bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600", dotColor: "bg-yellow-500", colorHex: "#E52020" },
    { label: "AMZ Training", icon: GraduationCap, bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700", dotColor: "bg-indigo-500", colorHex: "#8F0177" },
    { label: "Reduction", icon: Minus, bg: "bg-purple-800", text: "text-white", border: "border-purple-900", dotColor: "bg-purple-800", colorHex: "#281C59" },
    { label: "C0", icon: Clock, bg: "bg-orange-500", text: "text-white", border: "border-orange-600", dotColor: "bg-orange-500", colorHex: "#FF8B5A" },
    { label: "Trainer", icon: UserCheck, bg: "bg-teal-600", text: "text-white", border: "border-teal-700", dotColor: "bg-teal-500", colorHex: "#D8D365" },
    { label: "Training OTR", icon: BookOpen, bg: "bg-violet-600", text: "text-white", border: "border-violet-700", dotColor: "bg-violet-500", colorHex: "#DDA853" },
    { label: "Crash", icon: AlertTriangle, bg: "bg-red-500", text: "text-white", border: "border-red-600", dotColor: "bg-red-500", colorHex: "#0D92F4" },
    { label: "Fleet", icon: TruckIcon, bg: "bg-blue-600", text: "text-white", border: "border-blue-700", dotColor: "bg-blue-500", colorHex: "#27548A" },
    { label: "Pending ECP", icon: Clock, bg: "bg-fuchsia-800", text: "text-white", border: "border-fuchsia-900", dotColor: "bg-fuchsia-800", colorHex: "#5D1C6A" },
    { label: "Suspension", icon: Ban, bg: "bg-rose-700", text: "text-white", border: "border-rose-800", dotColor: "bg-rose-600", colorHex: "#313E17" },
    { label: "Modified Duty", icon: ShieldAlert, bg: "bg-amber-600", text: "text-white", border: "border-amber-700", dotColor: "bg-amber-500", colorHex: "#4D4646" },
    { label: "Stand by", icon: Clock, bg: "bg-cyan-600", text: "text-white", border: "border-cyan-700", dotColor: "bg-cyan-500", colorHex: "#F29727" },
    { label: "Request Off", icon: CalendarOff, bg: "bg-purple-600", text: "text-white", border: "border-purple-700", dotColor: "bg-purple-500", colorHex: "#9AA6B2" },
    { label: "TCO", icon: DoorOpen, bg: "bg-pink-600", text: "text-white", border: "border-pink-700", dotColor: "bg-pink-600", colorHex: "#CA6180" }
];

export const TYPE_MAP = new Map(TYPE_OPTIONS.map(opt => [opt.label.toLowerCase(), opt]));

export const getTypeStyle = (value?: string): { bg: string; text: string; border: string; colorHex?: string } => {
    if (!value || value.trim() === "") {
        return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-600 dark:text-zinc-300", border: "border-zinc-200 dark:border-zinc-600", colorHex: "#686D76" };
    }
    const opt = TYPE_MAP.get(value.trim().toLowerCase());
    if (opt) return { bg: opt.bg, text: opt.text, border: opt.border, colorHex: opt.colorHex };
    return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
};
