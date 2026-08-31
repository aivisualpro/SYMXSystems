"use client";

// ═══════════════════════════════════════════════════════════════════════
//  TIME PAGE — PROTOTYPE (time-v2)
// ═══════════════════════════════════════════════════════════════════════
//
// A local duplicate of /dispatching/time for evaluating changes without
// touching the live page, its API routes, or any stored data. Same read
// path (useDispatching() context — the layout already fetched the week),
// same PUT endpoint for saves (/api/dispatching/routes — nothing new was
// added server-side). Reachable only by direct URL; not in DISPATCHING_TABS,
// so it does not appear in navigation for anyone else.
//
// This page's job: someone (often remote, often not an SYMX veteran) types
// in the four Paycom punches for the day and the app checks them against
// the Amazon Flex app times and expected route-type durations. That's it —
// this is data entry with a consistency check, not the CA-law audit (that
// lives on the separate Timecard Audit page and stays there).
//
// Two real problems this addresses, found while investigating why one
// employee's lunch punch read as 3:02 AM instead of 3:02 PM:
//
//   1. AMBIGUOUS TIME ENTRY. The live page infers AM/PM from whatever the
//      typed text happens to contain. Typing "302" with no "p" saves 03:02
//      silently — no confirmation, no plausibility check. That is exactly
//      what put a real punch three hours before the shift's clock-in.
//
//      Fixed here for the four Paycom punches (In Day / Out Lunch / In
//      Lunch / Out Day), which have a known sequence within one shift: if
//      the typed text had no explicit "a"/"p" and the naive parse would
//      put this punch BEFORE the one that should precede it that day, the
//      other AM/PM candidate is tried, and if THAT keeps the sequence
//      intact, it is used instead — with the person told, not just saved.
//
//   2. RED/GREEN WITH NO EXPLANATION. The live page flags a cell red or
//      green using several undocumented rules (route-type duration
//      windows, whether it matches the Amazon app, etc.) but never says
//      why. That's fine for someone who built the page; it's a guessing
//      game for a remote data-entry person. Every flagged cell here now
//      carries a plain-language reason on hover ("Doesn't match the
//      Amazon app time — double check with dispatch"), and a legend spells
//      out what each color means in plain terms, not code logic.
//
// NOT done here, on purpose:
//   - No new backend field, no persisted audit trail. The "edited this
//     session" markers below are memory-only and vanish on reload — a
//     real audit trail needs a schema change (editedBy/editedAt/prevValue
//     on SYMXRoute) that a prototype page should not sneak in unasked.
//   - No CA-law compliance engine on this page. That belongs on the
//     Timecard Audit page, which already does it — duplicating it here
//     would just give the same numbers a second, easier-to-miss home.

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { useDropdowns, useRouteTypes } from "@/lib/query/hooks/useShared";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
    Loader2,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Pencil,
    CircleDashed,
    CheckCircle2,
    XCircle,
    TruckIcon,
    UserCheck,
    Clock,
    AlertTriangle,
    RefreshCcw,
    Upload,
    Info,
    History,
    HelpCircle,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import PunchImportModal from "../_components/PunchImportModal";

// ── Type Options (colored pills) ──
import { getTypeStyle, TYPE_MAP, getContrastText } from "@/lib/route-types";

// ── Attendance Options ──
const ATTENDANCE_OPTIONS = [
    { label: "Present", icon: CheckCircle2, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", iconColor: "text-white" },
    { label: "Absent", icon: XCircle, bg: "bg-red-600", text: "text-white", border: "border-red-700", iconColor: "text-white" },
    { label: "", icon: CircleDashed, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", iconColor: "text-zinc-400", displayLabel: "Clear" },
];
const getAttendanceStyle = (value: string) => {
    const v = value.trim().toLowerCase();
    if (v === "present") return ATTENDANCE_OPTIONS[0];
    if (v === "absent") return ATTENDANCE_OPTIONS[1];
    return ATTENDANCE_OPTIONS[2];
};

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "w-[260px] shrink-0 sticky left-0 z-20 bg-muted text-left" },
    { key: "attendance", label: "Attendance", width: "w-[95px]" },
    { key: "routeNumber", label: "Route #", width: "w-[75px]" },
    { key: "paycomInDay", label: "In Day", width: "w-[70px]" },
    { key: "paycomOutLunch", label: "Out Lunch", width: "w-[75px]" },
    { key: "paycomInLunch", label: "In Lunch", width: "w-[70px]" },
    { key: "paycomOutDay", label: "Out Day", width: "w-[70px]" },
    { key: "punchStatus", label: "Punch", width: "w-[110px]" },
    { key: "attendanceTime", label: "Att. Time", width: "w-[75px]" },
    { key: "amazonOutLunch", label: "AMZ Out", width: "w-[70px]" },
    { key: "amazonInLunch", label: "AMZ In", width: "w-[65px]" },
    { key: "amazonAppLogout", label: "AMZ Logout", width: "w-[80px]" },
    { key: "inspectionTime", label: "Inspection", width: "w-[80px]" },
    { key: "totalHours", label: "Total Hrs", width: "w-[70px]" },
    { key: "actions", label: "", width: "w-[40px]" },
] as const;

const GRID_TEMPLATE = "260px 95px 75px 70px 75px 70px 70px 110px 75px 70px 65px 80px 80px 70px 40px";

// ── Editable fields ──
const EDITABLE_FIELDS = new Set([
    "paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay",
    "punchStatus", "attendanceTime", "amazonOutLunch", "amazonInLunch",
    "amazonAppLogout", "inspectionTime",
]);

// The four Paycom punches, in shift order — this order is what the
// sequence-plausibility check below validates against.
const PAYCOM_SEQUENCE = ["paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay"] as const;

// ── Compute Total Hours ──
const computeTotalHours = (row: RouteRow): string => {
    const inDay = row.paycomInDay;
    const outLunch = row.paycomOutLunch;
    const inLunch = row.paycomInLunch;
    const outDay = row.paycomOutDay;

    const inDayMins = timeToMins(inDay);
    const outLunchMins = timeToMins(outLunch);
    const inLunchMins = timeToMins(inLunch);
    const outDayMins = timeToMins(outDay);

    let totalMins = 0;

    if (inDay && outLunch && inLunch && outDay) {
        totalMins = (outDayMins - inLunchMins) + (outLunchMins - inDayMins);
    } else if (inDay && outDay && !outLunch && !inLunch) {
        totalMins = outDayMins - inDayMins;
    } else {
        return "";
    }

    if (totalMins <= 0) return "";

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}.${String(mins).padStart(2, "0")}`;
};

interface RouteRow {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    employeeName: string;
    attendance: string;
    type: string;
    routeNumber: string;
    paycomInDay: string;
    paycomOutLunch: string;
    paycomInLunch: string;
    paycomOutDay: string;
    punchStatus: string;
    attendanceTime: string;
    amazonOutLunch: string;
    amazonInLunch: string;
    amazonAppLogout: string;
    inspectionTime: string;
    totalHours: string;
    typeId?: string;
    profileImage?: string;
}

// ── Formatting Rules Helpers ──
const parseSmartTime = (val: string): string => {
    if (!val) return "";
    const lowerVal = val.toLowerCase().trim();
    const isPM = lowerVal.includes('p');
    const isAM = lowerVal.includes('a');

    const d = val.replace(/\D/g, "");
    if (!d) return "";

    let hours = 0;
    let mins = 0;

    if (d.length <= 2) {
        hours = parseInt(d, 10);
    } else if (d.length === 3) {
        hours = parseInt(d.substring(0, 1), 10);
        mins = parseInt(d.substring(1, 3), 10);
    } else {
        hours = parseInt(d.substring(0, 2), 10);
        mins = parseInt(d.substring(2, 4), 10);
    }

    if (hours > 23) hours = 23;
    if (mins > 59) mins = 59;

    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const timeToMins = (t: string | undefined | null) => {
    if (!t) return 0;
    const parts = t.split(":");
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

/**
 * Parses a Paycom punch and checks it against the punch that should come
 * before it in the shift (In Day < Out Lunch < In Lunch < Out Day).
 *
 * Only acts when the typed text had NO explicit AM/PM — if the person
 * typed "3:02p" that is respected as-is, ambiguous or not. Ambiguity only
 * exists for bare-digit entry like "302" or "3:02", and that is precisely
 * the input that produced a punch three hours before clock-in with no
 * warning on the live page.
 */
function parsePunchWithSequenceCheck(
    val: string,
    precedingHHMM: string
): { value: string; autoCorrected: boolean } {
    const naive = parseSmartTime(val);
    if (!naive) return { value: naive, autoCorrected: false };

    const lower = val.toLowerCase();
    const hadExplicitMeridiem = lower.includes("a") || lower.includes("p");
    if (hadExplicitMeridiem || !precedingHHMM) {
        return { value: naive, autoCorrected: false };
    }

    const naiveMins = timeToMins(naive);
    const precedingMins = timeToMins(precedingHHMM);
    if (naiveMins > precedingMins) {
        return { value: naive, autoCorrected: false }; // already in order
    }

    const [h, m] = naive.split(":").map(Number);
    const flippedH = (h + 12) % 24;
    const flipped = `${String(flippedH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (timeToMins(flipped) > precedingMins) {
        return { value: flipped, autoCorrected: true };
    }
    // Neither AM nor PM keeps the sequence intact — leave as typed. The
    // existing red-flag coloring below will still catch it as an
    // out-of-order punch; this just could not resolve WHICH correction
    // was meant, so it declines to guess a second time.
    return { value: naive, autoCorrected: false };
}

const formatAmPm = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
};

const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

interface CellStyle {
    bg: string;
    text: string;
    inputBg: string;
    icon?: any;
    iconColor?: string;
    /** Plain-language explanation shown on hover — the whole point of this prototype. */
    reason?: string;
    /** Short label for the row-level badge — a few words, not a sentence. */
    label?: string;
    kind: "flag" | "ok" | "pending";
    /**
     * "urgent" = a real minimum-break-length shortfall (the kind of thing
     * that has to get fixed, not just double-checked). "check" = a
     * consistency mismatch worth a look but not inherently a violation.
     * Both render red today, but the icon differs so a dispatcher can
     * learn to tell them apart at a glance instead of treating every red
     * cell as equally alarming.
     */
    severity?: "urgent" | "check";
}

// ── The SAME red/green logic as the live page, now with four changes
// aimed at someone who doesn't already know what each check means:
//
//   1. Every flagged/confirmed cell gets a visible icon, not just a
//      background color — the icon shape is a second, color-blind-safe
//      signal, and it tells you WHAT KIND of thing to check before you've
//      even hovered: a compare-arrows icon means "doesn't match the
//      Amazon app", a triangle means "a required break came up short."
//   2. Checks run as soon as THEIR OWN inputs exist, instead of waiting
//      for all seven time fields on the row to be filled first. A
//      dispatcher typing in Paycom punches one at a time now gets
//      feedback immediately instead of a wall of "nothing" until the very
//      last field is typed.
//   3. A missing Amazon Flex app time is no longer treated as a mismatch.
//      Amazon's data often posts after the shift ends, so "not there yet"
//      and "doesn't match" used to look identical (both red, once the old
//      all-fields gate finally opened). Now a comparison only fires once
//      there's actually something to compare against.
//   4. "Not enough data to check yet" now LOOKS different from both
//      "checked, fine" and "checked, problem" — it used to render as a
//      plain, uncolored cell, identical to a field nobody has looked at.
//      That's what made Out Day look broken for a route whose Amazon app
//      logout hadn't posted yet: it wasn't broken, it just had nothing to
//      compare against, and nothing on screen said so.
// ──
const getCellFormat = (row: RouteRow, field: string): CellStyle | null => {
    const flag = (reason: string, label: string, icon: any, severity: "urgent" | "check" = "check"): CellStyle => ({
        bg: "bg-red-600", text: "text-white font-bold",
        inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white",
        icon, iconColor: "text-white", reason, label, kind: "flag", severity,
    });
    const ok = (reason: string, icon: any = CheckCircle2): CellStyle => ({
        bg: "bg-emerald-500/15 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400 font-semibold",
        inputBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 focus:bg-emerald-500/25",
        icon, iconColor: "text-emerald-600 dark:text-emerald-400", reason, kind: "ok",
    });
    // Distinct from both flag and ok: the check is real, but there's
    // nothing to compare against yet (usually an Amazon Flex app time that
    // hasn't posted). Renders as a quiet dashed cell so it can't be
    // mistaken for "checked, fine" or for a field nobody has touched.
    const pending = (reason: string): CellStyle => ({
        bg: "bg-muted/60 border border-dashed border-border", text: "text-muted-foreground",
        inputBg: "bg-muted/60 text-muted-foreground",
        icon: CircleDashed, iconColor: "text-muted-foreground/70", reason, kind: "pending",
    });

    if (field === "paycomInDay") {
        if (!row.paycomInDay || !row.attendanceTime) return null;
        const inMins = timeToMins(row.paycomInDay);
        const attMins = timeToMins(row.attendanceTime);
        if (inMins - attMins > 10 || attMins - inMins > 5) {
            return flag(
                "Doesn't line up with the Attendance Time recorded for this shift — double check the clock-in.",
                "Doesn't match Attendance Time", Clock
            );
        }
        return ok("Matches the Attendance Time for this shift.", Clock);
    }

    if (field === "paycomOutLunch") {
        if (!row.paycomOutLunch || !row.paycomInDay) return null;
        const outLunchMins = timeToMins(row.paycomOutLunch);
        const inDayMins = timeToMins(row.paycomInDay);
        const amzOutValid = !!row.amazonOutLunch;
        const type = row.type?.trim().toLowerCase() || "";

        const isTypeCR = ["route", "crash"].includes(type);
        const isTypeOCR = ["open", "close", "rescue"].includes(type);
        const isTypeOCRC = ["open", "close", "rescue", "crash"].includes(type);
        const isTypeCRC0 = ["route", "crash", "c0"].includes(type);

        const duration = outLunchMins - inDayMins;

        // Duration-based checks only need the two Paycom punches — run
        // right away, no need to wait on Amazon data.
        if (duration >= 295) {
            return flag(
                "Almost 5 hours went by before this lunch break — that's later than expected. Double check the punch.",
                "Long time before lunch", Clock
            );
        }
        if (isTypeOCRC && duration > 330) {
            return flag(
                "Longer than expected before lunch for this route type. Double check the punch.",
                "Long time before lunch", Clock
            );
        }

        // Amazon-comparison checks — only fire once the Amazon app time has
        // actually posted. No Amazon data yet just means "nothing to
        // compare against," not a problem.
        if (amzOutValid) {
            const matches = row.paycomOutLunch === row.amazonOutLunch;
            if (isTypeCR && !matches) {
                return flag(
                    "Doesn't match the time recorded in the Amazon Flex app. Double check with dispatch.",
                    "Doesn't match Amazon app", RefreshCcw
                );
            }
            if (isTypeCRC0 && matches) return ok("Matches the Amazon Flex app time.", RefreshCcw);
        } else if (isTypeCR) {
            return pending("Waiting on the Amazon Flex app time before this can be checked.");
        }
        if (isTypeOCR && duration <= 330) {
            return ok("Timing before lunch looks normal for this route type.", Clock);
        }
    }

    if (field === "paycomInLunch") {
        if (!row.paycomInLunch) return null;
        const inLunchMins = timeToMins(row.paycomInLunch);
        if (inLunchMins <= 0) return null;
        const outLunchValid = !!row.paycomOutLunch;
        const outLunchMins = timeToMins(row.paycomOutLunch);
        const amzInValid = !!row.amazonInLunch;

        const type = row.type?.trim().toLowerCase() || "";
        const isTypeCR = ["route", "crash"].includes(type);
        const isTypeOCR = ["open", "close", "rescue"].includes(type);
        const isTypeCRC0 = ["route", "crash", "c0"].includes(type);

        // The break-length check is the most important one on this page —
        // it's a real California minimum, not just a data mismatch — so it
        // gets its own "urgent" icon and takes priority over the Amazon
        // comparison below.
        if (outLunchValid && (inLunchMins - outLunchMins < 30)) {
            return flag(
                "Less than 30 minutes since lunch started — California requires at least a 30-minute break. Double check the punch.",
                "Break under 30 minutes", AlertTriangle, "urgent"
            );
        }

        if (amzInValid) {
            const matches = row.paycomInLunch === row.amazonInLunch;
            if (isTypeCR && !matches) {
                return flag(
                    "Doesn't match the time recorded in the Amazon Flex app. Double check with dispatch.",
                    "Doesn't match Amazon app", RefreshCcw
                );
            }
            if (isTypeCRC0 && matches) return ok("Matches the Amazon Flex app time.", RefreshCcw);
        } else if (isTypeCR) {
            return pending("Waiting on the Amazon Flex app time before this can be checked.");
        }
        if (isTypeOCR && outLunchValid && (inLunchMins - outLunchMins >= 30)) {
            return ok("Lunch break was at least 30 minutes, as required.", CheckCircle2);
        }
    }

    if (field === "paycomOutDay") {
        if (!row.paycomOutDay) return null;
        const outDayMins = timeToMins(row.paycomOutDay);
        if (outDayMins <= 0) return null;
        const appLogoutValid = !!row.amazonAppLogout;
        const appLogoutMins = timeToMins(row.amazonAppLogout);

        const inLunchValid = !!row.paycomInLunch;
        const inLunchMins = timeToMins(row.paycomInLunch);
        const outLunchValid = !!row.paycomOutLunch;
        const outLunchMins = timeToMins(row.paycomOutLunch);

        const type = row.type?.trim().toLowerCase() || "";
        const isTypeRoute = type === "route";

        if (isTypeRoute) {
            if (!appLogoutValid) {
                return pending("Waiting on the Amazon Flex app logout time before this can be checked.");
            }
            if (outDayMins < appLogoutMins || outDayMins >= appLogoutMins + 15) {
                return flag(
                    "Doesn't line up with when the Amazon Flex app shows the route ending. Double check the punch.",
                    "Doesn't match Amazon app", RefreshCcw
                );
            }
            return ok("Matches when the Amazon Flex app shows the route ending.", RefreshCcw);
        }

        if (inLunchValid && outLunchValid) {
            const diff = inLunchMins - outLunchMins;
            if (diff < 30) {
                return flag(
                    "Lunch break was less than the required 30 minutes. Double check the punches.",
                    "Break under 30 minutes", AlertTriangle, "urgent"
                );
            }
            return ok("Lunch break was at least 30 minutes, as required.", CheckCircle2);
        }
    }

    if (field === "amazonInLunch") {
        if (!row.amazonInLunch || !row.amazonOutLunch) return null;
        const outLunchMins = timeToMins(row.amazonOutLunch);
        const inLunchMins = timeToMins(row.amazonInLunch);
        const diff = inLunchMins - outLunchMins;
        if (diff < 30) {
            return flag(
                "Less than 30 minutes between the Amazon app's lunch out/in — double check.",
                "Break under 30 minutes", AlertTriangle, "urgent"
            );
        }
        return ok("At least 30 minutes between Amazon app lunch out/in.", CheckCircle2);
    }

    return null;
};

/** All flagged (not "ok") cells for one row, for the row-level badge. */
function getRowFlags(row: RouteRow): { field: string; label: string; reason: string; severity: "urgent" | "check" }[] {
    const fields = ["paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay", "amazonInLunch"];
    const out: { field: string; label: string; reason: string; severity: "urgent" | "check" }[] = [];
    for (const f of fields) {
        const style = getCellFormat(row, f);
        if (style?.kind === "flag") {
            out.push({ field: f, label: style.label || f, reason: style.reason || "", severity: style.severity || "check" });
        }
    }
    return out;
}

/**
 * The dot next to an employee's name — so scanning a long roster for who
 * needs attention doesn't mean reading every column of every row. Red +
 * pulse for an urgent (under-30-minute break) issue, plain amber dot for
 * an ordinary mismatch, nothing at all when the row has no flags.
 */
function RowFlagBadge({ row }: { row: RouteRow }) {
    const flags = useMemo(() => getRowFlags(row), [row]);
    if (flags.length === 0) return null;
    const hasUrgent = flags.some(f => f.severity === "urgent");
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={cn(
                    "shrink-0 h-1.5 w-1.5 rounded-full cursor-help",
                    hasUrgent ? "bg-red-500 animate-pulse" : "bg-amber-500"
                )} />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs max-w-[240px] space-y-1">
                <p className="font-semibold">{flags.length} punch{flags.length === 1 ? "" : "es"} to check</p>
                {flags.map((f, i) => (
                    <p key={i} className={f.severity === "urgent" ? "text-red-300" : "text-amber-300"}>
                        • {f.label}
                    </p>
                ))}
            </TooltipContent>
        </Tooltip>
    );
}

type SortKey = typeof COLUMNS[number]["key"];

/** Session-only record of an edit, for the "edited" indicator. Not persisted. */
interface SessionEdit {
    field: string;
    prevValue: string;
    at: number;
}

export default function TimePagePrototype() {
    const queryClient = useQueryClient();
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats, globalEditMode } = useDispatching();
    const { data: storeRouteTypes } = useRouteTypes();

    const routeTypeNameMap = useMemo(() => {
        const map = new Map<string, any>();
        if (Array.isArray(storeRouteTypes)) storeRouteTypes.forEach((rt: any) => map.set((rt.name || "").trim().toLowerCase(), rt));
        return map;
    }, [storeRouteTypes]);

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (group: string) => { setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] })); };

    const [quickEditRow, setQuickEditRow] = useState<RouteRow | null>(null);
    const [quickEditForm, setQuickEditForm] = useState<Partial<RouteRow>>({});
    const [punchStatusOptions, setPunchStatusOptions] = useState<any[]>([]);
    const [punchImportOpen, setPunchImportOpen] = useState(false);
    const [highlightSearch, setHighlightSearch] = useState<string | null>(null);
    const [showLegend, setShowLegend] = useState(false);

    // ── Session-only edit trail (memory only — see file header) ──
    const [sessionEdits, setSessionEdits] = useState<Record<string, SessionEdit[]>>({});
    const recordEdit = useCallback((routeId: string, field: string, prevValue: string) => {
        setSessionEdits(prev => {
            const key = `${routeId}:${field}`;
            const existing = prev[key] || [];
            return { ...prev, [key]: [...existing, { field, prevValue, at: Date.now() }] };
        });
    }, []);

    useEffect(() => {
        if (searchQuery) {
            setHighlightSearch(searchQuery.toLowerCase());
            const tm = setTimeout(() => setHighlightSearch(null), 5000);
            return () => clearTimeout(tm);
        } else {
            setHighlightSearch(null);
        }
    }, [searchQuery]);

    const { data: dropdownsData } = useDropdowns();

    useEffect(() => {
        const dropdowns = dropdownsData;
        if (dropdowns && Array.isArray(dropdowns) && dropdowns.length > 0) {
            const punches = dropdowns.filter((d: any) => d.type?.toLowerCase() === "punch status" && d.isActive !== false);
            setPunchStatusOptions(punches);
        }
    }, [dropdownsData]);

    const { rawRouteData, rawRouteDataLoading } = useDispatching();

    useEffect(() => {
        if (rawRouteDataLoading) { setLoading(true); return; }
        if (!rawRouteData || !rawRouteData.routes || rawRouteData.routes.length === 0) {
            setAllRoutes([]);
            setLoading(false);
            return;
        }
        const rows: RouteRow[] = rawRouteData.routes.map((rec: any) => {
            const emp = rawRouteData.employees?.[rec.transporterId];
            return {
                _id: rec._id,
                transporterId: rec.transporterId,
                date: rec.date,
                weekDay: rec.weekDay || "",
                employeeName: emp?.name || rec.transporterId,
                attendance: rec.attendance || "",
                type: rec.type || "",
                routeNumber: rec.routeNumber || "",
                paycomInDay: rec.paycomInDay || "",
                paycomOutLunch: rec.paycomOutLunch || "",
                paycomInLunch: rec.paycomInLunch || "",
                paycomOutDay: rec.paycomOutDay || "",
                punchStatus: rec.punchStatus || "",
                attendanceTime: rec.attendanceTime || "",
                amazonOutLunch: rec.amazonOutLunch || "",
                amazonInLunch: rec.amazonInLunch || "",
                amazonAppLogout: rec.amazonAppLogout || "",
                inspectionTime: rec.inspectionTime || "",
                totalHours: rec.totalHours || "",
                typeId: rec.typeId || "",
                profileImage: emp?.profileImage || "",
            };
        });
        setAllRoutes(rows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

    const patchRouteCache = useCallback((routeId: string, updates: Record<string, string>) => {
        const patchFn = (old: any) => {
            if (!old?.routes) return old;
            return { ...old, routes: old.routes.map((r: any) => r._id === routeId ? { ...r, ...updates } : r) };
        };
        queryClient.setQueryData(["dispatching", "routes", selectedWeek], patchFn);
        if (selectedDate) {
            queryClient.setQueryData(["dispatching", "routes", selectedWeek, selectedDate], patchFn);
        }
    }, [queryClient, selectedWeek, selectedDate]);

    // ── Save handler — same endpoint as the live page, with edit tracking ──
    // Saves one or more fields at once — used directly by multi-field saves
    // (e.g. a punch plus an auto-set Punch Status), and wrapped by
    // handleSave below for the single-field case.
    const handleSaveFields = useCallback(async (routeId: string, updates: Record<string, string>, prevValues: Record<string, string>) => {
        Object.entries(updates).forEach(([field, value]) => recordEdit(routeId, field, prevValues[field] ?? ""));
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, ...updates } : r));
        patchRouteCache(routeId, updates);
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch (err: any) {
            notify.error(err.message || "Failed to update");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        }
    }, [queryClient, patchRouteCache, recordEdit]);

    const handleSave = useCallback(async (routeId: string, field: string, value: string, prevValue: string) => {
        await handleSaveFields(routeId, { [field]: value }, { [field]: prevValue });
        notify.success(`Updated ${field}`);
    }, [handleSaveFields]);

    // Finds the Punch Status option matching "Needs Edit" (however it's
    // capitalized/worded in this org's dropdown) rather than hardcoding it.
    const needsEditOption = useMemo(
        () => punchStatusOptions.find(o => /needs edit/i.test(o.description || "")),
        [punchStatusOptions]
    );

    /**
     * The ask this answers: once the third Paycom punch (Lunch In) is
     * entered, if the row already has anything flagged, don't wait for a
     * dispatcher to notice and set Punch Status by hand — set it to
     * "Needs Edit" automatically and say why. Only steps in when the row
     * isn't already marked Needs Edit, so it won't fight a dispatcher who
     * changes it back.
     */
    const maybeAutoFlagNeedsEdit = useCallback((row: RouteRow, updatedFields: Partial<RouteRow>): { field: string; value: string; prev: string } | null => {
        if (!needsEditOption) return null;
        if (row.punchStatus === needsEditOption.description) return null;
        const merged = { ...row, ...updatedFields };
        const flags = getRowFlags(merged);
        if (flags.length === 0) return null;
        return { field: "punchStatus", value: needsEditOption.description, prev: row.punchStatus || "" };
    }, [needsEditOption]);

    const handleQuickEditSave = async () => {
        if (!quickEditRow) return;
        const updates = { ...quickEditForm };
        const routeId = quickEditRow._id;

        Object.keys(updates).forEach((field) => {
            const prevValue = String((quickEditRow as any)[field] ?? "");
            const nextValue = String((updates as any)[field] ?? "");
            if (prevValue !== nextValue) recordEdit(routeId, field, prevValue);
        });

        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, ...updates } : r));
        patchRouteCache(routeId, updates as Record<string, string>);
        setQuickEditRow(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            notify.success(`Updated time entry for ${quickEditRow.employeeName}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch {
            notify.error("Failed to update time entry");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    // ── Filter + sort ──
    const { groups, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);

        dateFiltered = dateFiltered.filter(r => {
            const typeNorm = (r.type || "").trim().toLowerCase();
            const excludedKeywords = ["off", "reduction", "call out"];
            if (excludedKeywords.some(kw => typeNorm.includes(kw))) return false;
            const rt = routeTypeNameMap.get(typeNorm);
            if (rt) {
                const canonicalName = (rt.name || "").trim().toLowerCase();
                if (excludedKeywords.some(kw => canonicalName.includes(kw))) return false;
            }
            return true;
        });

        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(r =>
                r.employeeName.toLowerCase().includes(q) ||
                r.transporterId.toLowerCase().includes(q) ||
                r.routeNumber.toLowerCase().includes(q) ||
                r.attendance.toLowerCase().includes(q) ||
                r.punchStatus.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            const aVal = sortKey === "employee" ? a.employeeName : (a as any)[sortKey] || "";
            const bVal = sortKey === "employee" ? b.employeeName : (b as any)[sortKey] || "";
            return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });

        const typeGroups: Record<string, RouteRow[]> = {};
        sorted.forEach(r => {
            const typeKey = r.type || "Unassigned";
            if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
            typeGroups[typeKey].push(r);
        });

        if (sortKey === "employee") {
            Object.values(typeGroups).forEach(group => group.sort((a, b) => a.employeeName.localeCompare(b.employeeName)));
        }

        const groupKeys = Object.keys(typeGroups).sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            if (aLower === "route") return -1;
            if (bLower === "route") return 1;
            if (aLower === "off" || aLower === "unassigned" || aLower === "") return 1;
            if (bLower === "off" || bLower === "unassigned" || bLower === "") return -1;
            return a.localeCompare(b);
        });

        const groups = groupKeys.map(key => ({ type: key, rows: typeGroups[key], count: typeGroups[key].length }));

        return { groups, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir, routeTypeNameMap]);

    // ── Count flagged cells across what's on screen — a plain "how many
    // things need a second look today" number, not a legal audit. Urgent
    // (actual under-30-minute breaks) is called out separately from
    // ordinary mismatches, since the two aren't equally important. ──
    const flagSummary = useMemo(() => {
        let flagged = 0;
        let urgent = 0;
        for (const group of groups) {
            for (const row of group.rows) {
                for (const { severity } of getRowFlags(row)) {
                    flagged++;
                    if (severity === "urgent") urgent++;
                }
            }
        }
        return { flagged, urgent };
    }, [groups]);

    useEffect(() => { setStats({ employeeCount: totalFiltered, groupCount: groups.length }); }, [totalFiltered, groups.length, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    if (rawRouteData?.routes?.length > 0 && allRoutes.length === 0) {
        return <div className="flex-1 opacity-0 pointer-events-none" />;
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-rose-500 to-pink-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-500">
                        <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Time (prototype)</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {!routesGenerated
                        ? "No routes generated for this week yet. Generate routes from the live Time or Routes page first."
                        : "No route data available for this week."}
                </p>
            </div>
        );
    }

    const isEditedThisSession = (routeId: string, field: string) => !!sessionEdits[`${routeId}:${field}`];

    // ── Editable cell renderer ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditable = EDITABLE_FIELDS.has(field);
        const raw = value === 0 || value === "" ? "—" : String(value);
        let displayVal = raw === "—" ? raw : raw.split(':').slice(0, 2).join(':');

        const isTimeField = field !== "routeNumber" && field !== "punchStatus" && field !== "totalHours";
        if (isTimeField && displayVal !== "—") {
            displayVal = formatAmPm(displayVal);
        }

        const style = getCellFormat(row, field);
        const Icon = style?.icon;
        const edited = isEditedThisSession(row._id, field);

        // Where in the Paycom sequence this field sits, so a blur can check
        // against the punch that should precede it.
        const seqIndex = PAYCOM_SEQUENCE.indexOf(field as any);
        const precedingField = seqIndex > 0 ? PAYCOM_SEQUENCE[seqIndex - 1] : null;

        if (globalEditMode && isEditable) {
            if (field === "punchStatus") {
                const opt = punchStatusOptions.find(o => o.description === value);
                const badgeColor = opt?.color || "bg-muted text-muted-foreground";
                const textColor = badgeColor.startsWith("bg-") && badgeColor !== "bg-muted" ? "text-white" : "";
                const IconComponent = opt?.icon ? (LucideIcons as any)[opt.icon] : null;

                return (
                    <div className="relative w-full h-7 mt-[-2px]">
                        <select
                            value={value || ""}
                            onChange={(e) => handleSave(row._id, field, e.target.value, String(value || ""))}
                            className={cn(
                                "w-full h-full relative z-10 text-[11px] text-center px-1 rounded border border-border/40 focus:border-primary focus:outline-none transition-all appearance-none shadow-sm cursor-pointer",
                                value && opt ? `${badgeColor} ${textColor} font-semibold` : "bg-foreground/5"
                            )}
                            style={{ backgroundImage: 'none' }}
                        >
                            <option value=""></option>
                            {punchStatusOptions.map(o => <option key={o._id} value={o.description} className="bg-background text-foreground">{o.description}</option>)}
                        </select>
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                            {opt?.image ? (
                                <img src={opt.image} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0 ring-1 ring-white/20" />
                            ) : IconComponent ? (
                                <IconComponent className={cn("h-3.5 w-3.5", textColor)} />
                            ) : null}
                        </div>
                    </div>
                );
            }
            return (
                <div className="relative w-full h-7">
                    <input
                        key={displayVal}
                        defaultValue={displayVal === "—" ? "" : displayVal}
                        title={style?.reason}
                        onChange={(e) => {
                            if (isTimeField) {
                                e.target.value = e.target.value.replace(/[^\d:ampAMP ]/g, "");
                            }
                        }}
                        onBlur={(e) => {
                            let updatedVal = e.target.value;
                            const prevValue = String(value || "");

                            if (isTimeField) {
                                if (precedingField) {
                                    const { value: checked, autoCorrected } = parsePunchWithSequenceCheck(
                                        updatedVal,
                                        (row as any)[precedingField] || ""
                                    );
                                    updatedVal = checked;
                                    if (autoCorrected) {
                                        notify.info(
                                            `Read "${e.target.value}" as ${formatAmPm(checked)} — it can't come before ` +
                                            `${COLUMNS.find(c => c.key === precedingField)?.label || precedingField} ` +
                                            `(${formatAmPm((row as any)[precedingField])}). Fix it below if that's wrong.`
                                        );
                                    }
                                } else {
                                    updatedVal = parseSmartTime(updatedVal);
                                }
                            }
                            e.target.value = updatedVal;

                            if (updatedVal !== prevValue) {
                                const updates: Record<string, string> = { [field]: updatedVal };
                                const prevValues: Record<string, string> = { [field]: prevValue };

                                // Third Paycom punch (Lunch In) just landed — if the row
                                // already has anything flagged, set Punch Status to
                                // "Needs Edit" in the same save instead of waiting for
                                // someone to notice.
                                if (field === "paycomInLunch") {
                                    const autoFlag = maybeAutoFlagNeedsEdit(row, { paycomInLunch: updatedVal });
                                    if (autoFlag) {
                                        updates[autoFlag.field] = autoFlag.value;
                                        prevValues[autoFlag.field] = autoFlag.prev;
                                        notify.info(`Flag found after Lunch In — Punch Status set to "${autoFlag.value}".`);
                                    }
                                }

                                handleSaveFields(row._id, updates, prevValues);
                                notify.success(`Updated ${field}`);
                            }
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        className={cn(
                            "w-full h-full text-xs px-1.5 text-center rounded border border-border/40 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner",
                            style ? `${style.inputBg} ${style.text}` : "bg-foreground/5 focus:bg-background relative z-10",
                            Icon ? "pr-6" : "",
                            edited && "ring-1 ring-amber-400"
                        )}
                        placeholder="—"
                    />
                    {Icon && <Icon className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none", style?.iconColor || style?.text || "opacity-80")} />}
                </div>
            );
        }

        if (field === "punchStatus") {
            const opt = punchStatusOptions.find(o => o.description === displayVal);
            if (opt && displayVal !== "—") {
                const badgeColor = opt.color || "bg-muted";
                const textColor = badgeColor.startsWith("bg-") ? "text-white" : "text-foreground";
                const IconComponent = opt.icon ? (LucideIcons as any)[opt.icon] : null;
                return (
                    <div className={cn("inline-flex justify-center items-center gap-1.5 px-2 min-h-[22px] rounded text-[11px] font-semibold w-full", badgeColor, textColor)}>
                        {opt.image ? (
                            <img src={opt.image} alt={opt.description} className="h-4 w-4 rounded-full object-cover shrink-0 ring-1 ring-border/20" />
                        ) : IconComponent ? (
                            <IconComponent className="h-3.5 w-3.5 shrink-0" />
                        ) : null}
                        <span className="truncate leading-none">{opt.description}</span>
                    </div>
                );
            }
        }

        const cell = (
            <div className={cn("flex items-center justify-center gap-1 w-full rounded px-1 min-h-[28px] relative", style && `${style.bg} ${style.text}`)}>
                {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", style?.iconColor || style?.text || "opacity-80")} />}
                <span className={cn("text-[11px] truncate block w-full text-center", !style && (displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"))}>{displayVal}</span>
                {edited && !globalEditMode && (
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
            </div>
        );

        // Wrap in a tooltip whenever there's something worth explaining:
        // either a flagged/confirmed reason, or a session edit note.
        const history = sessionEdits[`${row._id}:${field}`] || [];
        const last = history[history.length - 1];

        if (!style?.reason && !edited) return cell;

        return (
            <Tooltip>
                <TooltipTrigger asChild>{cell}</TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[240px] space-y-1">
                    {style?.reason && (
                        <p className={
                            style.kind === "flag" ? "text-red-300"
                                : style.kind === "pending" ? "text-zinc-300"
                                : "text-emerald-300"
                        }>{style.reason}</p>
                    )}
                    {edited && (
                        <p className="flex items-center gap-1 text-muted-foreground">
                            <History className="h-3 w-3 shrink-0" /> Edited this session — was "{last?.prevValue || "—"}"
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        );
    };

    const renderAttendance = (row: RouteRow) => {
        const style = getAttendanceStyle(row.attendance);
        const Icon = style.icon;
        return (
            <div className={cn("relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none pointer-events-none px-1.5", style.bg, style.text, style.border)}>
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.attendance || "—"}</span>
            </div>
        );
    };

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full gap-2">
                {/* ── Prototype banner ── */}
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-[11px] text-violet-700 dark:text-violet-300">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        This is a local prototype at <code className="font-mono">/dispatching/time-v2</code> — reads and saves
                        through the same live data as Time. Nothing here is exposed in navigation.
                    </span>
                </div>

                {/* ── Plain-language summary — "how many need a second look", not a legal audit ── */}
                <div className={cn(
                    "shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-lg border text-xs",
                    flagSummary.urgent > 0 ? "bg-red-500/10 border-red-500/30"
                        : flagSummary.flagged > 0 ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-emerald-500/10 border-emerald-500/30"
                )}>
                    {flagSummary.urgent > 0 && (
                        <span className="flex items-center gap-1.5 font-semibold text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            {flagSummary.urgent} break{flagSummary.urgent === 1 ? "" : "s"} under 30 minutes — needs a fix
                        </span>
                    )}
                    {flagSummary.flagged - flagSummary.urgent > 0 && (
                        <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                            <RefreshCcw className="h-4 w-4" />
                            {flagSummary.flagged - flagSummary.urgent} other mismatch{flagSummary.flagged - flagSummary.urgent === 1 ? "" : "es"} to double check
                        </span>
                    )}
                    {flagSummary.flagged === 0 && (
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            All entries look consistent for this date
                        </span>
                    )}
                    <span className="text-muted-foreground">Hover any highlighted cell, or the dot next to a name, to see why.</span>
                    <div className="flex-1" />
                    <Popover open={showLegend} onOpenChange={setShowLegend}>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
                                <HelpCircle className="h-3.5 w-3.5" /> What am I looking for?
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[320px] text-xs space-y-3">
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-red-600">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Red triangle — fix this
                                </p>
                                <p className="text-muted-foreground">
                                    A break came in under the 30-minute California minimum. This isn't just a
                                    mismatch — it needs to be corrected or confirmed with the employee.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-red-600">
                                    <RefreshCcw className="h-3.5 w-3.5" /> Red arrows — doesn't match the Amazon app
                                </p>
                                <p className="text-muted-foreground">
                                    The Paycom punch and the Amazon Flex app disagree on this time. Double check
                                    which one is right.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-red-600">
                                    <Clock className="h-3.5 w-3.5" /> Red clock — timing looks off
                                </p>
                                <p className="text-muted-foreground">
                                    The gap between two punches is longer or shorter than normal for this route
                                    type, or doesn't match the recorded Attendance Time.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-muted-foreground">
                                    <CircleDashed className="h-3.5 w-3.5" /> Dashed gray — nothing to check yet
                                </p>
                                <p className="text-muted-foreground">
                                    Usually means the Amazon Flex app hasn't posted its time for this punch yet.
                                    Not an error — there's just nothing to compare against until it does.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-emerald-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Green — looks right, nothing to do
                                </p>
                                <p className="text-muted-foreground">
                                    Matches the Amazon app or falls within the normal window. Green is
                                    intentionally quiet — it's there so you know a cell was actually checked, not
                                    just left blank.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Dot next to a name
                                </p>
                                <p className="text-muted-foreground">
                                    That employee has at least one flagged punch that day. Hover the dot for a
                                    quick list without scanning every column.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1 flex items-center gap-1"><History className="h-3.5 w-3.5 text-amber-400" /> Amber dot on a cell</p>
                                <p className="text-muted-foreground">
                                    You changed this value earlier in this session. Hover for what it was before.
                                    This resets when the page reloads — it's not a saved history yet.
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold mb-1">Typing times</p>
                                <p className="text-muted-foreground">
                                    You don't need to type "am" or "pm" — if a punch would land before the one
                                    that should come before it that day, the app tries the other half of the day
                                    automatically and tells you what it did. Type "p" or "a" yourself if you want
                                    to be explicit.
                                </p>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={() => setPunchImportOpen(true)}>
                        <Upload className="h-3 w-3" /> Import Punch Audit Report
                    </Button>
                </div>

                <div
                    className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col"
                    style={{ WebkitMaskImage: "-webkit-radial-gradient(white, black)" }}
                >
                    <div className="flex-1 overflow-auto">
                        <div style={{ minWidth: 1250 }}>
                            <div className="grid items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-muted sticky top-0 z-20"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                {COLUMNS.map((col, i) => (
                                    <button key={col.key} onClick={() => handleSort(col.key)}
                                        className={cn(
                                            "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors",
                                            i === 0 ? "sticky left-0 z-20 bg-muted text-left" : "justify-center text-center"
                                        )}>
                                        {col.label}
                                        {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    </button>
                                ))}
                            </div>

                            <div>
                                {groups.map((group) => {
                                    const isCollapsed = collapsedGroups[group.type] ?? false;
                                    const typeOpt = TYPE_MAP.get(group.type.toLowerCase());
                                    const GroupIcon = typeOpt?.icon;
                                    const groupStyle = getTypeStyle(group.type);

                                    return (
                                        <React.Fragment key={group.type}>
                                            <div
                                                onClick={() => toggleGroup(group.type)}
                                                className="cursor-pointer hover:bg-muted/60 transition-colors bg-muted/30 border-b border-border/30 px-3 py-1.5 flex items-center sticky top-[37px] z-25"
                                            >
                                                <div className="flex items-center gap-2 sticky left-0">
                                                    <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                                                    <div className={cn(
                                                        "flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-semibold border shadow-sm",
                                                        !groupStyle.colorHex && groupStyle.bg,
                                                        !groupStyle.colorHex && groupStyle.text,
                                                        !groupStyle.colorHex && groupStyle.border
                                                    )} style={{
                                                        backgroundColor: groupStyle.colorHex || undefined,
                                                        color: groupStyle.colorHex ? getContrastText(groupStyle.colorHex) : undefined,
                                                        borderColor: groupStyle.colorHex ? 'transparent' : undefined
                                                    }}>
                                                        {GroupIcon && <GroupIcon className="h-3 w-3" />}
                                                        {group.type || "Unassigned"}
                                                    </div>
                                                    <span className="text-[12px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                                        {group.count}
                                                    </span>
                                                </div>
                                            </div>

                                            {!isCollapsed && group.rows.map((row) => (
                                                <div key={row._id} className={cn(
                                                    "grid items-center gap-2 px-3 py-2 border-b transition-all duration-700 group/row",
                                                    highlightSearch && (row.transporterId.toLowerCase() === highlightSearch || row.employeeName.toLowerCase().includes(highlightSearch))
                                                        ? "bg-emerald-500/20 border-emerald-500/40 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]"
                                                        : "border-border/20 hover:bg-muted/20"
                                                )}
                                                    style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                                    <div className="flex items-center gap-2 min-w-0 pr-2 sticky left-0 z-10 bg-card group-hover/row:bg-muted/20 transition-colors border-r border-border/50">
                                                        {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                        {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                        <span
                                                            className="text-xs font-semibold truncate hover:text-primary transition-colors cursor-pointer"
                                                            style={{ color: getTypeStyle(row.type).colorHex || "inherit" }}
                                                            onClick={() => { setQuickEditRow(row); setQuickEditForm({ ...row }); }}
                                                        >
                                                            {row.employeeName}
                                                        </span>
                                                        <RowFlagBadge row={row} />
                                                    </div>
                                                    {renderAttendance(row)}
                                                    {renderCell(row, "routeNumber", row.routeNumber)}
                                                    {renderCell(row, "paycomInDay", row.paycomInDay)}
                                                    {renderCell(row, "paycomOutLunch", row.paycomOutLunch)}
                                                    {renderCell(row, "paycomInLunch", row.paycomInLunch)}
                                                    {renderCell(row, "paycomOutDay", row.paycomOutDay)}
                                                    {renderCell(row, "punchStatus", row.punchStatus)}
                                                    {renderCell(row, "attendanceTime", row.attendanceTime)}
                                                    {renderCell(row, "amazonOutLunch", row.amazonOutLunch)}
                                                    {renderCell(row, "amazonInLunch", row.amazonInLunch)}
                                                    {renderCell(row, "amazonAppLogout", row.amazonAppLogout)}
                                                    {renderCell(row, "inspectionTime", row.inspectionTime)}
                                                    {renderCell(row, "totalHours", computeTotalHours(row))}
                                                    <div className="flex justify-end pr-1">
                                                        <button
                                                            onClick={() => { setQuickEditRow(row); setQuickEditForm({ ...row }); }}
                                                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {groups.length === 0 && (
                                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                        No employees found for this date
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 border-t border-border/50 bg-muted/20">
                        <span className="text-[11px] text-muted-foreground">{totalFiltered} of {totalForDate} employees</span>
                    </div>
                </div>

                {/* ── Quick Edit Sheet (unchanged from live page, minus the compliance box) ── */}
                <Sheet open={!!quickEditRow} onOpenChange={(open) => !open && setQuickEditRow(null)}>
                    <SheetContent side="right" className="w-full sm:w-[450px] border-l border-border bg-background p-0 flex flex-col shadow-2xl">
                        <SheetHeader className="px-6 py-5 border-b border-border bg-muted/20">
                            <SheetTitle className="text-lg font-bold flex items-center gap-3">
                                {quickEditRow?.profileImage ? (
                                    <img src={quickEditRow.profileImage} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                                        <span className="text-sm font-bold text-primary">{quickEditRow?.employeeName?.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                                    </div>
                                )}
                                <div>
                                    <div className="text-foreground">{quickEditRow?.employeeName}</div>
                                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Quick Edit Time Entries</div>
                                </div>
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                                <div className="col-span-2 space-y-1.5 border-b border-border/50 pb-5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Punch Status</label>
                                    <select
                                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={quickEditForm.punchStatus || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, punchStatus: e.target.value }))}
                                    >
                                        <option value="">Select Status...</option>
                                        {punchStatusOptions.map(opt => (
                                            <option key={opt._id} value={opt.description}>{opt.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">Attendance Time</label>
                                    <Input
                                        value={quickEditForm.attendanceTime || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, attendanceTime: e.target.value.replace(/[^\d:]/g, "") }))}
                                        onBlur={() => setQuickEditForm(prev => ({ ...prev, attendanceTime: parseSmartTime(prev.attendanceTime || "") }))}
                                        className="h-9 shadow-sm" placeholder="—"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">Inspection Time</label>
                                    <Input
                                        value={quickEditForm.inspectionTime || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, inspectionTime: e.target.value.replace(/[^\d:]/g, "") }))}
                                        onBlur={() => setQuickEditForm(prev => ({ ...prev, inspectionTime: parseSmartTime(prev.inspectionTime || "") }))}
                                        className="h-9 shadow-sm" placeholder="—"
                                    />
                                </div>

                                <div className="col-span-2 mt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                                        Paycom Data
                                        <span className="normal-case font-normal text-muted-foreground ml-2">— you don't need to type am/pm, it's checked against shift order</span>
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Day</label>
                                            <Input
                                                value={quickEditForm.paycomInDay || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomInDay: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, paycomInDay: parseSmartTime(prev.paycomInDay || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Lunch</label>
                                            <Input
                                                value={quickEditForm.paycomOutLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomOutLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => {
                                                    const { value, autoCorrected } = parsePunchWithSequenceCheck(
                                                        quickEditForm.paycomOutLunch || "", quickEditForm.paycomInDay || ""
                                                    );
                                                    if (autoCorrected) notify.info(`Read as ${formatAmPm(value)} — can't be before In Day.`);
                                                    setQuickEditForm(prev => ({ ...prev, paycomOutLunch: value }));
                                                }}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Lunch</label>
                                            <Input
                                                value={quickEditForm.paycomInLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomInLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => {
                                                    const { value, autoCorrected } = parsePunchWithSequenceCheck(
                                                        quickEditForm.paycomInLunch || "", quickEditForm.paycomOutLunch || ""
                                                    );
                                                    if (autoCorrected) notify.info(`Read as ${formatAmPm(value)} — can't be before Out Lunch.`);
                                                    // Third Paycom punch just landed in the sheet — if the row (as
                                                    // edited so far) has anything flagged, pre-select "Needs Edit"
                                                    // in the Punch Status dropdown above rather than saving it
                                                    // silently; the dispatcher still sees and can override it
                                                    // before hitting Save.
                                                    if (quickEditRow) {
                                                        const autoFlag = maybeAutoFlagNeedsEdit(
                                                            { ...quickEditRow, ...quickEditForm } as RouteRow,
                                                            { paycomInLunch: value }
                                                        );
                                                        if (autoFlag) {
                                                            notify.info(`Flag found after Lunch In — Punch Status set to "${autoFlag.value}".`);
                                                            setQuickEditForm(prev => ({ ...prev, paycomInLunch: value, punchStatus: autoFlag.value }));
                                                            return;
                                                        }
                                                    }
                                                    setQuickEditForm(prev => ({ ...prev, paycomInLunch: value }));
                                                }}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Day</label>
                                            <Input
                                                value={quickEditForm.paycomOutDay || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomOutDay: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => {
                                                    const { value, autoCorrected } = parsePunchWithSequenceCheck(
                                                        quickEditForm.paycomOutDay || "", quickEditForm.paycomInLunch || quickEditForm.paycomInDay || ""
                                                    );
                                                    if (autoCorrected) notify.info(`Read as ${formatAmPm(value)} — can't be before the previous punch.`);
                                                    setQuickEditForm(prev => ({ ...prev, paycomOutDay: value }));
                                                }}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 mt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-3">Amazon Data</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Lunch</label>
                                            <Input
                                                value={quickEditForm.amazonInLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonInLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonInLunch: parseSmartTime(prev.amazonInLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Lunch</label>
                                            <Input
                                                value={quickEditForm.amazonOutLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonOutLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonOutLunch: parseSmartTime(prev.amazonOutLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">App Logout</label>
                                            <Input
                                                value={quickEditForm.amazonAppLogout || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonAppLogout: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonAppLogout: parseSmartTime(prev.amazonAppLogout || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => setQuickEditRow(null)}>Cancel</Button>
                            <Button size="sm" onClick={handleQuickEditSave} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
                                Save Changes
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>

                <PunchImportModal
                    open={punchImportOpen}
                    onClose={() => setPunchImportOpen(false)}
                    onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" })}
                />
            </div>
        </TooltipProvider>
    );
}
