"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/use-data-store";
import {
  Loader2,
  Send,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Bell,
  BellRing,
  Calendar,
  CalendarDays,
  Map,
  Phone,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Eye,
  Pencil,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// ── Types ──
interface EmployeeRecipient {
  _id: string;
  name: string;
  firstName: string;
  lastName: string;
  transporterId: string;
  phoneNumber: string;
  type: string;
  email: string;
  messagingStatus?: Record<string, { status: string; createdAt: string } | null>;
  schedules?: {
    date: string;
    weekDay: string;
    type: string;
    subType: string;
    status: string;
    startTime: string;
    van: string;
  }[];
}

interface SendResult {
  to: string;
  name: string;
  success: boolean;
  error?: string;
}

interface QuoPhoneNumber {
  id: string;
  phoneNumber: string;
  name?: string;
}

// ── Helpers ──
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BUSINESS_TZ = "America/Los_Angeles";

function getTodayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** Get tomorrow's date string (YYYY-MM-DD) in Pacific Time. */
function getTomorrowPacific(): string {
  const todayStr = getTodayPacific();
  const d = new Date(todayStr + "T12:00:00.000Z"); // noon UTC to avoid DST edge
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

function getWeekDates(yearWeek: string): string[] {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return [];
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const weekSunday = new Date(firstSunday);
  weekSunday.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekSunday);
    d.setUTCDate(weekSunday.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function addMinutesToTime(time: string, minutes: number): string {
  if (!time) return "";
  // Supports formats: "10:35", "10:35 AM", "1:00 PM"
  const cleaned = time.trim();
  const ampmMatch = cleaned.match(/([0-9]{1,2}):([0-9]{2})\s*(AM|PM)?/i);
  if (!ampmMatch) return time;

  let hours = parseInt(ampmMatch[1]);
  let mins = parseInt(ampmMatch[2]);
  const ampm = ampmMatch[3]?.toUpperCase();

  // Convert to 24h for calculation
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  mins += minutes;
  if (mins >= 60) {
    hours += Math.floor(mins / 60);
    mins = mins % 60;
  }
  hours = hours % 24;

  // Convert back to original format
  if (ampm) {
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const displayAmpm = hours >= 12 ? "PM" : "AM";
    return `${displayHour}:${mins.toString().padStart(2, "0")} ${displayAmpm}`;
  }
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

function formatDateMMDDYYYY(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${(d.getUTCMonth() + 1).toString().padStart(2, "0")}/${d.getUTCDate().toString().padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return FULL_DAY_NAMES[d.getUTCDay()];
}

function personalizeMessage(template: string, emp: EmployeeRecipient, tabId?: string, selectedWeek?: string): string {
  const NON_WORKING = ["off", "close", "request off", ""];

  // Determine which schedule to use based on tab context
  let targetShift = emp.schedules?.find(
    (s) => s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
  );

  const todayPacific = getTodayPacific();
  const tomorrowPacific = getTomorrowPacific();

  if (tabId === "shift") {
    // Shift notification → use TODAY's schedule (Pacific)
    const todayShift = emp.schedules?.find(
      (s) => s.date?.startsWith(todayPacific) && s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
    );
    if (todayShift) targetShift = todayShift;
  } else if (tabId === "future-shift" || tabId === "off-tomorrow") {
    // Future shift / off-tomorrow → use TOMORROW's schedule (Pacific)
    const tomorrowShift = emp.schedules?.find(
      (s) => s.date?.startsWith(tomorrowPacific) && s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
    );
    if (tomorrowShift) targetShift = tomorrowShift;
  }

  const name = emp.name || `${emp.firstName} ${emp.lastName}`.toUpperCase();
  const startTime = targetShift?.startTime || "";
  const standupTime = startTime ? addMinutesToTime(startTime, 5) : "";

  // For 'shift' tab, use today's date; for 'future-shift'/'off-tomorrow', use tomorrow's; otherwise use schedule date
  let shiftDate = "";
  let dayOfWeek = "";

  if (tabId === "shift") {
    const todayDate = new Date(todayPacific + "T00:00:00Z");
    shiftDate = formatDateMMDDYYYY(todayDate.toISOString());
    dayOfWeek = FULL_DAY_NAMES[todayDate.getUTCDay()];
  } else if (tabId === "future-shift" || tabId === "off-tomorrow") {
    const tomorrowDate = new Date(tomorrowPacific + "T00:00:00Z");
    shiftDate = formatDateMMDDYYYY(tomorrowDate.toISOString());
    dayOfWeek = FULL_DAY_NAMES[tomorrowDate.getUTCDay()];
  } else {
    shiftDate = targetShift?.date ? formatDateMMDDYYYY(targetShift.date) : "";
    dayOfWeek = targetShift?.date
      ? getDayOfWeek(targetShift.date)
      : targetShift?.weekDay || "";
  }

  // Build {yearWeek} display string — "2026-W07" → "2026-7"
  let yearWeekDisplay = selectedWeek || "";
  const weekMatch = selectedWeek?.match(/(\d{4})-W(\d{2})/);
  if (weekMatch) {
    yearWeekDisplay = `${weekMatch[1]}-${parseInt(weekMatch[2])}`;
  }

  // Build {weekSchedule} — full 7-day breakdown for week-schedule tab
  let weekSchedule = "";
  if (tabId === "week-schedule" && emp.schedules && emp.schedules.length > 0) {
    const sorted = [...emp.schedules].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const lines = sorted.map((s) => {
      const dn = s.weekDay || getDayOfWeek(s.date);
      const df = formatDateMMDDYYYY(s.date);
      const isWorking = s.type && !NON_WORKING.includes(s.type.toLowerCase().trim());
      if (isWorking) {
        return ` ${dn} ${df} ✅ ${s.startTime || ""}`;
      } else {
        return ` ${dn} ${df} ❌ OFF`;
      }
    });
    weekSchedule = lines.join("\n");
  }

  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{startTime\}/gi, startTime)
    .replace(/\{standupTime\}/gi, standupTime)
    .replace(/\{date\}/gi, shiftDate)
    .replace(/\{dayOfWeek\}/gi, dayOfWeek)
    .replace(/\{yearWeek\}/gi, yearWeekDisplay)
    .replace(/\{weekSchedule\}/gi, weekSchedule);
}

// ── Message Status Badge Component ──
const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
  label: string;
  pulse?: boolean;
}> = {
  pending: {
    icon: Loader2,
    color: "text-amber-400",
    bg: "bg-amber-400/15 ring-amber-400/30",
    label: "Pending",
    pulse: true,
  },
  sent: {
    icon: Send,
    color: "text-blue-400",
    bg: "bg-blue-400/15 ring-blue-400/30",
    label: "Sent",
  },
  delivered: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/15 ring-emerald-400/30",
    label: "Delivered",
  },
  received: {
    icon: MessageSquare,
    color: "text-violet-400",
    bg: "bg-violet-400/15 ring-violet-400/30",
    label: "Reply Received",
  },
  confirmed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/15 ring-emerald-400/30",
    label: "Confirmed",
  },
  change_requested: {
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-400/15 ring-amber-400/30",
    label: "Change Requested",
  },
  received_reply: {
    icon: MessageSquare,
    color: "text-violet-400",
    bg: "bg-violet-400/15 ring-violet-400/30",
    label: "Reply Received",
  },
};

function MessageStatusBadge({
  status,
  createdAt,
  changeRemarks,
  isLiveUpdate,
}: {
  status: string;
  createdAt?: string;
  changeRemarks?: string;
  isLiveUpdate?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;
  const timeAgo = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : "";

  // Celebration animation classes for live-updated "confirmed"
  const isConfirmCelebration = isLiveUpdate && status === "confirmed";
  const isChangeCelebration = isLiveUpdate && status === "change_requested";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-[11px] font-semibold uppercase tracking-wider shrink-0 transition-all duration-500",
            config.bg,
            config.color,
            config.pulse && "animate-pulse",
            isConfirmCelebration && "ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-110",
            isChangeCelebration && "ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)] scale-110"
          )}
          style={isLiveUpdate ? { animation: "statusPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" } : undefined}
        >
          <Icon className={cn("h-3 w-3", config.pulse && "animate-spin")} />
          {config.label}
          {isConfirmCelebration && <span className="ml-0.5">✓</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[250px]">
        <span className="font-semibold">{config.label}</span>
        {isLiveUpdate && <span className="text-emerald-400 ml-1">• Live</span>}
        {timeAgo && <span className="text-muted-foreground ml-1">• {timeAgo}</span>}
        {changeRemarks && (
          <p className="text-white/90 mt-1 italic">&ldquo;{changeRemarks}&rdquo;</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Pulsing LIVE indicator for real-time monitoring */
function LiveIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
    </div>
  );
}

// ── Sub Tab Config ──
interface SubTab {
  id: string;
  label: string;
  icon: typeof Bell;
  description: string;
  gradient: string;
  iconColor: string;
  borderColor: string;
  defaultMessage: string;
  variables: string[];
  hidden?: boolean;
}

const SUB_TABS: SubTab[] = [
  {
    id: "future-shift",
    label: "Future Shift Notification",
    icon: BellRing,
    description: "Notify employees about their upcoming scheduled shifts",
    gradient: "from-blue-500/15 to-cyan-500/15",
    iconColor: "text-blue-500",
    borderColor: "border-blue-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease reply Y to confirm your route. See you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "shift",
    label: "Shift Notification",
    icon: Bell,
    description: "Send notifications about current shift schedules",
    gradient: "from-emerald-500/15 to-teal-500/15",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou have a shift scheduled today @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease check your schedule for details. Thank you!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "off-tomorrow",
    label: "Off Today - Schedule Tomorrow",
    icon: Calendar,
    description: "Notify employees who are off today but scheduled tomorrow",
    gradient: "from-amber-500/15 to-orange-500/15",
    iconColor: "text-amber-500",
    borderColor: "border-amber-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are off today. Reminder: you are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease reply Y to confirm your route. See you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
    hidden: true,
  },
  {
    id: "week-schedule",
    label: "Week Schedule",
    icon: CalendarDays,
    description: "Send weekly schedule summaries to employees",
    gradient: "from-violet-500/15 to-purple-500/15",
    iconColor: "text-violet-500",
    borderColor: "border-violet-500/30",
    defaultMessage:
      "Hi {name}\n\nHere is your schedule for next week {yearWeek}\n----------------------\n\n{weekSchedule}\n\n----------------------\nPlease confirm with a Y.  Please check your start times!",
    variables: ["name", "yearWeek", "weekSchedule", "confirmationLink"],
  },
  {
    id: "route-itinerary",
    label: "Route Itinerary",
    icon: Map,
    description: "Share route details and itinerary with drivers",
    gradient: "from-rose-500/15 to-pink-500/15",
    iconColor: "text-rose-500",
    borderColor: "border-rose-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYour route itinerary has been updated. Please review your assigned route for today. Thank you!",
    variables: ["name", "dayOfWeek", "date", "confirmationLink"],
  },
];

// ── Message History Tab Component ──
interface HistoryLog {
  _id: string;
  recipientName: string;
  toNumber: string;
  messageType: string;
  content: string;
  status: string;
  sentAt: string;
  deliveredAt?: string;
  repliedAt?: string;
  replyContent?: string;
  errorMessage?: string;
  confirmation?: {
    status: string;
    confirmedAt?: string;
    changeRequestedAt?: string;
    changeRemarks?: string;
    token?: string;
  } | null;
}

function MessageHistoryTab({ messageType, selectedPhones, yearWeek }: { messageType: string; selectedPhones?: string[]; yearWeek?: string }) {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ messageType, limit: "200" });
    if (yearWeek) params.set("yearWeek", yearWeek);
    fetch(`/api/messaging/history?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs || []);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [messageType, yearWeek]);

  // Filter by selected phones
  const filteredLogs = useMemo(() => {
    if (!selectedPhones || selectedPhones.length === 0) return logs;
    return logs.filter((log) => selectedPhones.includes(log.toNumber));
  }, [logs, selectedPhones]);

  const formatTime = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return d;
    }
  };

  const getStatusConfig = (log: HistoryLog) => {
    if (log.confirmation?.status === "confirmed") {
      return { label: "Confirmed", color: "text-emerald-500", bg: "bg-emerald-500/10 ring-emerald-500/30", icon: CheckCircle2 };
    }
    if (log.confirmation?.status === "change_requested") {
      return { label: "Change Requested", color: "text-amber-500", bg: "bg-amber-500/10 ring-amber-500/30", icon: RefreshCw };
    }
    if (log.status === "received_reply") {
      return { label: "Reply Received", color: "text-violet-500", bg: "bg-violet-500/10 ring-violet-500/30", icon: MessageSquare };
    }
    if (log.status === "delivered") {
      return { label: "Delivered", color: "text-blue-500", bg: "bg-blue-500/10 ring-blue-500/30", icon: CheckCircle2 };
    }
    if (log.status === "failed") {
      return { label: "Failed", color: "text-red-500", bg: "bg-red-500/10 ring-red-500/30", icon: XCircle };
    }
    return { label: "Sent", color: "text-blue-400", bg: "bg-blue-400/10 ring-blue-400/30", icon: Send };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-2">
        <Clock className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {selectedPhones && selectedPhones.length > 0
            ? "No messages found for selected employees"
            : "No messages sent yet"}
        </p>
        {selectedPhones && selectedPhones.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60">Select employees on the left to filter</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {filteredLogs.map((log) => {
        const config = getStatusConfig(log);
        const StatusIcon = config.icon;
        const isExpanded = expandedId === log._id;

        return (
          <div
            key={log._id}
            className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
          >
            {/* Summary Row */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : log._id)}
            >
              {/* Status Icon */}
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 ring-1", config.bg)}>
                <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
              </div>

              {/* Name + Phone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate">{log.recipientName}</span>
                  <span className="text-[10px] text-muted-foreground">{log.toNumber}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] font-medium", config.color)}>
                    {config.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    • {formatTime(log.sentAt)}
                  </span>
                </div>
              </div>

              {/* Expand indicator */}
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </div>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {/* Sent Message */}
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 ml-6">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowUpRight className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Sent</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(log.sentAt)}</span>
                  </div>
                  <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{log.content}</pre>
                </div>

                {/* Delivery Status */}
                {log.deliveredAt && (
                  <div className="flex items-center gap-2 ml-6 px-3 py-1.5 rounded-md bg-blue-500/5 border border-blue-500/10">
                    <CheckCircle2 className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] text-blue-500 font-medium">Delivered</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(log.deliveredAt)}</span>
                  </div>
                )}

                {/* Confirmation Response */}
                {log.confirmation?.status === "confirmed" && (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 ml-6">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Confirmed</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {log.confirmation.confirmedAt ? formatTime(log.confirmation.confirmedAt) : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      ✅ Employee confirmed their schedule via confirmation link
                    </p>
                  </div>
                )}

                {/* Change Request Response */}
                {log.confirmation?.status === "change_requested" && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 ml-6">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownLeft className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Change Requested</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {log.confirmation.changeRequestedAt ? formatTime(log.confirmation.changeRequestedAt) : ""}
                      </span>
                    </div>
                    {log.confirmation.changeRemarks && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-1">
                        &ldquo;{log.confirmation.changeRemarks}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* Reply Content (from webhook) */}
                {log.replyContent && !log.confirmation && (
                  <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-3 ml-6">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownLeft className="h-3 w-3 text-violet-500" />
                      <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Reply</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {log.repliedAt ? formatTime(log.repliedAt) : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80">{log.replyContent}</p>
                  </div>
                )}

                {/* Failed */}
                {log.status === "failed" && log.errorMessage && (
                  <div className="flex items-center gap-2 ml-6 px-3 py-1.5 rounded-md bg-red-500/5 border border-red-500/10">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-[10px] text-red-500 font-medium">Error: {log.errorMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Messaging Sub-Tab Content ──
function MessagingSubTab({
  tab,
  weeks,
  selectedWeek,
  setSelectedWeek,
  searchQuery,
  selectAllTrigger,
  phoneNumbers,
  fromNumber,
  fromNumberDisplay,
  setFromNumber,
  setFromNumberDisplay,
  loadingPhones,
  prefetchedEmployees,
  employeesLoading,
  prefetchedTemplate,
  templatesLoaded,
  onSelectionReport,
}: {
  tab: SubTab;
  weeks: string[];
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  searchQuery: string;
  selectAllTrigger: number;
  phoneNumbers: QuoPhoneNumber[];
  fromNumber: string;
  fromNumberDisplay: string;
  setFromNumber: (id: string) => void;
  setFromNumberDisplay: (n: string) => void;
  loadingPhones: boolean;
  prefetchedEmployees?: EmployeeRecipient[];
  employeesLoading: boolean;
  prefetchedTemplate?: string;
  templatesLoaded: boolean;
  onSelectionReport?: (count: number) => void;
}) {
  // Use prefetched data from parent — stable reference to avoid infinite re-renders
  const EMPTY: EmployeeRecipient[] = useMemo(() => [], []);
  const employees = prefetchedEmployees ?? EMPTY;
  const loading = employeesLoading;

  // ── "Off Today" toggle for the future-shift tab ──
  const [showOffToday, setShowOffToday] = useState(false);
  const [offTodayEmployees, setOffTodayEmployees] = useState<EmployeeRecipient[]>([]);
  const [offTodayLoading, setOffTodayLoading] = useState(false);

  // Fetch "off-tomorrow" filter employees when toggle is ON
  useEffect(() => {
    if (tab.id !== "future-shift" || !showOffToday) return;
    setOffTodayLoading(true);
    const params = new URLSearchParams({ filter: "off-tomorrow" });
    if (selectedWeek) params.append("yearWeek", selectedWeek);
    fetch(`/api/messaging/employees?${params.toString()}`)
      .then(res => res.json())
      .then(data => setOffTodayEmployees(data.employees || []))
      .catch(() => setOffTodayEmployees([]))
      .finally(() => setOffTodayLoading(false));
  }, [tab.id, showOffToday, selectedWeek]);

  // Pick which employee list to show based on toggle
  const activeEmployees = (tab.id === "future-shift" && showOffToday) ? offTodayEmployees : employees;
  const activeLoading = (tab.id === "future-shift" && showOffToday) ? offTodayLoading : loading;

  const [sending, setSending] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(tab.defaultMessage);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [composerTab, setComposerTab] = useState<"preview" | "compose" | "history">("preview");
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Live Status Polling ─────────────────────────────────────────────────
  const [liveStatuses, setLiveStatuses] = useState<Record<string, { status: string; createdAt: string; changeRemarks?: string }>>({}); 
  const [isPolling, setIsPolling] = useState(false);
  const [liveUpdatedPhones, setLiveUpdatedPhones] = useState<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = useRef<number>(0);
  const sentPhonesRef = useRef<string[]>([]);
  const prevStatusRef = useRef<Record<string, string>>({});

  // Start polling after successful send
  const startPolling = useCallback((phones: string[]) => {
    sentPhonesRef.current = phones;
    pollStartRef.current = Date.now();
    // Snapshot current statuses so we can detect transitions
    const snapshot: Record<string, string> = {};
    phones.forEach(ph => snapshot[ph] = "sent");
    prevStatusRef.current = snapshot;
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (!isPolling || sentPhonesRef.current.length === 0) return;

    const doPoll = async () => {
      try {
        // Stop after 10 minutes
        if (Date.now() - pollStartRef.current > 10 * 60 * 1000) {
          stopPolling();
          return;
        }

        const params = new URLSearchParams({
          messageType: tab.id,
          phones: sentPhonesRef.current.join(","),
        });
        if (selectedWeek) params.set("yearWeek", selectedWeek);

        const res = await fetch(`/api/messaging/live-status?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStatuses = data.statuses || {};

        // Detect status transitions and animate them
        const updatedPhones = new Set<string>();
        Object.entries(newStatuses).forEach(([phone, info]: [string, any]) => {
          const prev = prevStatusRef.current[phone] || liveStatuses[phone]?.status;
          if (prev && prev !== info.status) {
            updatedPhones.add(phone);
            // Show toast for confirmed/change_requested transitions
            if (info.status === "confirmed") {
              const empName = activeEmployees.find(e => {
                const normalized = e.phoneNumber.startsWith("+") ? e.phoneNumber : `+1${e.phoneNumber.replace(/\D/g, "")}`;
                return normalized === phone;
              })?.name;
              toast.success(`✅ ${empName || phone} confirmed their schedule!`, { duration: 5000 });
            } else if (info.status === "change_requested") {
              const empName = activeEmployees.find(e => {
                const normalized = e.phoneNumber.startsWith("+") ? e.phoneNumber : `+1${e.phoneNumber.replace(/\D/g, "")}`;
                return normalized === phone;
              })?.name;
              toast.info(`🔄 ${empName || phone} requested a change`, { duration: 5000 });
            }
          }
          prevStatusRef.current[phone] = info.status;
        });

        if (updatedPhones.size > 0) {
          setLiveUpdatedPhones(prev => {
            const next = new Set(prev);
            updatedPhones.forEach(p => next.add(p));
            return next;
          });
          // Clear the "just updated" animation after 3 seconds
          setTimeout(() => {
            setLiveUpdatedPhones(prev => {
              const next = new Set(prev);
              updatedPhones.forEach(p => next.delete(p));
              return next;
            });
          }, 3000);
        }

        setLiveStatuses(newStatuses);
      } catch {
        // Silently fail — will retry on next interval
      }
    };

    // Poll immediately, then every 4 seconds
    doPoll();
    pollIntervalRef.current = setInterval(doPoll, 4000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, tab.id, selectedWeek, stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Sync template from parent prefetch when it arrives
  useEffect(() => {
    if (templatesLoaded && prefetchedTemplate && !templateLoaded) {
      setMessage(prefetchedTemplate);
      setTemplateLoaded(true);
    }
  }, [templatesLoaded, prefetchedTemplate, templateLoaded]);

  // Auto-save template to DB with debounce
  useEffect(() => {
    if (!templateLoaded) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await fetch("/api/messaging/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: tab.id, template: message }),
        });
      } catch {
        // silently fail
      } finally {
        setSaving(false);
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [message, tab.id, templateLoaded]);

  // Refresh callback for manual refresh button
  const fetchEmployees = useCallback(async () => {
    // Parent handles data fetching
  }, []);

  // Reset selections when the actual employee data reference changes (stable from parent)
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedAll(false);
    setSendResults(null);
  }, [prefetchedEmployees]);

  // Watch selectAllTrigger from header button
  useEffect(() => {
    if (selectAllTrigger === 0) return; // skip initial mount
    toggleSelectAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAllTrigger]);

  // Filter by search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return activeEmployees;
    const q = searchQuery.toLowerCase();
    return activeEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.phoneNumber.includes(q) ||
        emp.transporterId?.toLowerCase().includes(q)
    );
  }, [activeEmployees, searchQuery]);

  // Report selection count to parent when it changes (deferred to avoid setState-during-render)
  useEffect(() => {
    onSelectionReport?.(selectedIds.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.size]);

  // Toggle select
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAll) {
      setSelectedIds(new Set());
      setSelectedAll(false);
    } else {
      const newIds = new Set(filteredEmployees.map((e) => e._id));
      setSelectedIds(newIds);
      setSelectedAll(true);
    }
  };

  // Send messages — personalized per employee
  const handleSend = async () => {
    const selectedEmployees = filteredEmployees.filter((e) => selectedIds.has(e._id));

    if (selectedEmployees.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!fromNumber) {
      toast.error("No phone number configured. Please check your OpenPhone account.");
      return;
    }

    // Build per-employee personalized messages
    const NON_WORKING = ["off", "close", "request off", ""];
    const todayPST = getTodayPacific();
    const tomorrowPST = getTomorrowPacific();

    const recipients = selectedEmployees.map((emp) => {
      // Determine the correct schedule date based on tab context
      let targetScheduleDate: string | undefined;

      if (tab.id === "shift") {
        // Shift notification → use TODAY's schedule (Pacific)
        const todayShift = emp.schedules?.find(
          (s) => s.date?.startsWith(todayPST) && s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
        );
        targetScheduleDate = todayShift?.date || undefined;
      } else if (tab.id === "future-shift" || tab.id === "off-tomorrow") {
        // Future shift / off-tomorrow → use TOMORROW's schedule (Pacific)
        const tomorrowShift = emp.schedules?.find(
          (s) => s.date?.startsWith(tomorrowPST) && s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
        );
        targetScheduleDate = tomorrowShift?.date || undefined;
      } else {
        // Default: first relevant non-off schedule
        const relevantSchedule = emp.schedules?.find(
          (s) => s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
        );
        targetScheduleDate = relevantSchedule?.date || undefined;
      }

      return {
        phone: emp.phoneNumber.startsWith("+") ? emp.phoneNumber : `+1${emp.phoneNumber.replace(/\D/g, "")}`,
        name: emp.name,
        message: personalizeMessage(message.trim(), emp, tab.id, selectedWeek),
        transporterId: emp.transporterId,
        scheduleDate: targetScheduleDate,
        yearWeek: selectedWeek || undefined,
      };
    });

    setSending(true);
    setSendResults(null);

    try {
      // Send each personalized message individually
      const results: SendResult[] = [];

      const sendPromises = recipients.map(async (r) => {
        try {
          const payload = {
            recipients: [{
              phone: r.phone,
              name: r.name,
              message: r.message,
              transporterId: r.transporterId,
              scheduleDate: r.scheduleDate,
            }],
            message: r.message,
            from: fromNumber,
            messageType: tab.id,
          };
          console.log("[Messaging] Sending:", JSON.stringify(payload, null, 2));

          const res = await fetch("/api/messaging/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          console.log("[Messaging] Response:", res.status, JSON.stringify(data, null, 2));
          if (!res.ok) throw new Error(data.error || "Failed");

          return { to: r.phone, name: r.name, success: true };
        } catch (err: any) {
          console.error("[Messaging] Error for", r.name, ":", err.message);
          return { to: r.phone, name: r.name, success: false, error: err.message };
        }
      });

      const batchResults = await Promise.all(sendPromises);
      results.push(...batchResults);

      setSendResults(results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast.success(`${successCount} message(s) sent successfully!`);
      } else {
        toast.warning(`${successCount} sent, ${failCount} failed`);
      }

      // Start live polling for sent phones
      const sentPhones = results
        .filter((r) => r.success)
        .map((r) => r.to);
      if (sentPhones.length > 0) {
        setLiveStatuses({});
        setLiveUpdatedPhones(new Set());
        startPolling(sentPhones);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send messages");
    } finally {
      setSending(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* ── Left: Employee List ── */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="border-b border-border/50 bg-muted/30 sticky top-0 z-10">
            <div className="grid grid-cols-[40px_1fr_100px_120px_120px] items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={
                    filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length
                      ? true
                      : selectedIds.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </div>
              <span>Name</span>
              <span>Client Type</span>
              <span>Phone</span>
              <span>Schedule Type</span>
            </div>
          </div>

          {/* Employee Rows */}
          <div className="flex-1 overflow-auto">
            {activeLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No employees match this filter
                </p>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedIds.has(emp._id);

                const nextShift = emp.schedules?.find(
                  (s) =>
                    s.type &&
                    !["off", "close", "request off", ""].includes(
                      s.type.toLowerCase().trim()
                    )
                );

                const sendResult = sendResults?.find(
                  (r) =>
                    r.to ===
                    (emp.phoneNumber.startsWith("+")
                      ? emp.phoneNumber
                      : `+1${emp.phoneNumber.replace(/\D/g, "")}`)
                );

                // Compute normalized phone for live status lookup
                const normalizedPhone = emp.phoneNumber.startsWith("+")
                  ? emp.phoneNumber
                  : `+1${emp.phoneNumber.replace(/\D/g, "")}`;
                const liveStatus = liveStatuses[normalizedPhone];
                const isLiveHighlight = liveUpdatedPhones.has(normalizedPhone);

                return (
                  <div
                    key={emp._id}
                    className={cn(
                      "grid grid-cols-[40px_1fr_100px_120px_120px] items-center gap-2 px-3 py-2 border-b border-border/20 cursor-pointer transition-all duration-500 hover:bg-muted/30",
                      isSelected &&
                      "bg-primary/5 border-l-2 border-l-primary",
                      isLiveHighlight && liveStatus?.status === "confirmed" && "bg-emerald-500/8 border-l-2 border-l-emerald-500",
                      isLiveHighlight && liveStatus?.status === "change_requested" && "bg-amber-500/8 border-l-2 border-l-amber-500"
                    )}
                    style={isLiveHighlight ? { animation: "rowFlash 1s ease-out" } : undefined}
                    onClick={() => toggleSelect(emp._id)}
                  >
                    {/* Select */}
                    <div className="flex items-center justify-center">
                      <div
                        className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && (
                          <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Name + Status */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold truncate">
                        {emp.name}
                      </span>
                      {/* Status priority: 1) Live polled status, 2) DB status, 3) Send result */}
                      {(() => {
                        // 1. Live polled status (real-time from polling)
                        if (liveStatus) {
                          return (
                            <MessageStatusBadge
                              status={liveStatus.status}
                              createdAt={liveStatus.createdAt}
                              changeRemarks={liveStatus.changeRemarks}
                              isLiveUpdate={isLiveHighlight}
                            />
                          );
                        }
                        // 2. DB status from initial fetch
                        const msgStatus = emp.messagingStatus?.[tab.id];
                        if (msgStatus) {
                          return (
                            <MessageStatusBadge
                              status={msgStatus.status}
                              createdAt={msgStatus.createdAt}
                              changeRemarks={(msgStatus as any).changeRemarks}
                            />
                          );
                        }
                        // 3. Fallback: show live send result from this session
                        if (sendResult) {
                          return sendResult.success ? (
                            <MessageStatusBadge status="sent" />
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>{sendResult.error}</TooltipContent>
                            </Tooltip>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Client Type */}
                    <span className="text-[11px] text-muted-foreground truncate">
                      {emp.type}
                    </span>

                    {/* Phone */}
                    <span className="text-[11px] text-muted-foreground truncate">
                      {emp.phoneNumber}
                    </span>

                    {/* Schedule Type */}
                    <span className={cn(
                      "text-[11px] font-medium truncate",
                      nextShift ? "text-emerald-500" : "text-muted-foreground/40"
                    )}>
                      {nextShift ? `${nextShift.type}` : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* List Footer */}
          <div className="flex items-center justify-between p-2.5 border-t border-border/50 bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              {selectedCount} of {filteredEmployees.length} selected
            </span>
            <div className="flex items-center gap-2">
              {isPolling && <LiveIndicator />}
              {/* Show live confirmed/changed counts */}
              {Object.keys(liveStatuses).length > 0 && (() => {
                const confirmed = Object.values(liveStatuses).filter(s => s.status === "confirmed").length;
                const changed = Object.values(liveStatuses).filter(s => s.status === "change_requested").length;
                return (
                  <>
                    {confirmed > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold">
                        {confirmed} confirmed
                      </span>
                    )}
                    {changed > 0 && (
                      <span className="text-[10px] text-amber-500 font-semibold">
                        {changed} change req
                      </span>
                    )}
                  </>
                );
              })()}
              {sendResults && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-500 font-medium">
                    {sendResults.filter((r) => r.success).length} sent
                  </span>
                  {sendResults.some((r) => !r.success) && (
                    <span className="text-[10px] text-red-500 font-medium">
                      {sendResults.filter((r) => !r.success).length} failed
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Preview & Compose ── */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
          {/* Tabs Header */}
          <div className="flex items-center gap-1 p-2 border-b border-border/50 bg-muted/30">
            <button
              onClick={() => setComposerTab("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                composerTab === "preview"
                  ? "bg-background shadow-sm text-foreground border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => setComposerTab("compose")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                composerTab === "compose"
                  ? "bg-background shadow-sm text-foreground border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              Compose
            </button>
            <button
              onClick={() => setComposerTab("history")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                composerTab === "history"
                  ? "bg-background shadow-sm text-foreground border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              History
            </button>
            {fromNumber && fromNumberDisplay && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 ml-auto"
              >
                From: {fromNumberDisplay}
              </Badge>
            )}
          </div>

          {/* ── Preview Tab ── */}
          {composerTab === "preview" && (
            <div className="flex-1 overflow-auto p-3">
              {filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <Eye className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No employees to preview
                  </p>
                </div>
              ) : selectedIds.size === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <Eye className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Select employees to see message previews
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEmployees
                    .filter((e) => selectedIds.has(e._id))
                    .map((emp) => (
                      <div
                        key={emp._id}
                        className="rounded-lg border border-border/30 bg-muted/10 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-semibold text-primary">
                            {emp.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {emp.phoneNumber}
                          </span>
                        </div>
                        <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                          {personalizeMessage(message, emp, tab.id, selectedWeek)}
                        </pre>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── Compose Tab ── */}
          {composerTab === "compose" && (
            <>
              {/* From Number Select */}
              <div className="px-3 pt-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                  Send From
                </label>
                {loadingPhones ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading phone numbers...
                  </div>
                ) : phoneNumbers.length > 0 ? (
                  <Select
                    value={fromNumber}
                    onValueChange={(id) => {
                      setFromNumber(id);
                      const pn = phoneNumbers.find((p) => p.id === id);
                      if (pn) setFromNumberDisplay(pn.phoneNumber);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((pn) => (
                        <SelectItem key={pn.id} value={pn.id}>
                          {pn.name} ({pn.phoneNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[11px] text-destructive italic">
                    ⚠ No phone numbers found in OpenPhone account. Messages cannot be sent.
                  </p>
                )}
              </div>

              {/* Message Input */}
              <div className="flex-1 p-3 flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Message Content
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 min-h-[180px] w-full rounded-lg border border-border/50 bg-background p-3 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all placeholder:text-muted-foreground/50 font-mono leading-relaxed"
                  placeholder="Type your message here... Use {name}, {date}, {startTime} etc. to personalize."
                />
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      Variables:{" "}
                    </span>
                    {(tab.variables || ["name"]).map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5 cursor-pointer hover:bg-muted"
                        onClick={() =>
                          setMessage((prev) => prev + `{${v}}`)
                        }
                      >
                        {`{${v}}`}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {saving && (
                      <span className="text-[10px] text-amber-500 font-medium animate-pulse">
                        Saving...
                      </span>
                    )}
                    {!saving && templateLoaded && (
                      <span className="text-[10px] text-emerald-500/60 font-medium">
                        Auto-saved
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {message.length} chars
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── History Tab ── */}
          {composerTab === "history" && (
            <MessageHistoryTab
              messageType={tab.id}
              yearWeek={selectedWeek}
              selectedPhones={
                selectedIds.size > 0
                  ? filteredEmployees
                    .filter((e) => selectedIds.has(e._id))
                    .map((e) => e.phoneNumber.startsWith("+") ? e.phoneNumber : `+1${e.phoneNumber.replace(/\D/g, "")}`)
                  : undefined
              }
            />
          )}

          {/* Send Action */}
          <div className="p-3 border-t border-border/50 bg-muted/20">
            {selectedCount === 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Select employees from the list to send messages
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium">
                    Ready to send to{" "}
                    <span className="text-primary font-bold">
                      {selectedCount}
                    </span>{" "}
                    recipient{selectedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Messages will be sent via Quo SMS
                  </p>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="h-9 px-4 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? "Sending..." : "Send Messages"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Messaging Panel ──
export { SUB_TABS };

export interface ActiveTabInfo {
  label: string;
  icon: typeof Bell;
  iconColor: string;
  eligibleCount: number;
  selectedCount: number;
  loading: boolean;
  refresh: () => void;
}

export default function MessagingPanel({
  weeks,
  selectedWeek,
  setSelectedWeek,
  searchQuery,
  selectAllTrigger,
  activeSubTab,
  onSubTabChange,
  onActiveTabInfo,
}: {
  weeks: string[];
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  searchQuery: string;
  selectAllTrigger: number;
  activeSubTab: string;
  onSubTabChange?: (tab: string) => void;
  onActiveTabInfo?: (info: ActiveTabInfo) => void;
}) {
  const resolvedTab = SUB_TABS.find((t) => t.id === activeSubTab) ? activeSubTab : SUB_TABS[0].id;

  // ── Phone numbers fetched ONCE here, shared via props to all sub-tabs ──────
  const [phoneNumbers, setPhoneNumbers] = useState<QuoPhoneNumber[]>([]);
  const [fromNumber, setFromNumber] = useState(""); // phoneNumberId
  const [fromNumberDisplay, setFromNumberDisplay] = useState(""); // readable number
  const [loadingPhones, setLoadingPhones] = useState(true);

  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const res = await fetch("/api/messaging/phone-numbers");
        const data = await res.json();
        if (data.data) {
          setPhoneNumbers(
            data.data.map((pn: any) => ({
              id: pn.id,
              phoneNumber: pn.phoneNumber,
              name: pn.name || pn.phoneNumber,
            }))
          );
          if (data.data.length > 0) {
            setFromNumber(data.data[0].id);
            setFromNumberDisplay(data.data[0].phoneNumber);
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoadingPhones(false);
      }
    };
    fetchPhoneNumbers();
  }, []);

  const store = useDataStore();

  // ── Compute week dates for date pills ──
  const weekDates = useMemo(() => {
    if (!selectedWeek) return [];
    return getWeekDates(selectedWeek);
  }, [selectedWeek]);

  const [selectedDate, setSelectedDate] = useState("");

  // Auto-select today when week changes
  useEffect(() => {
    if (weekDates.length === 0) return;
    const today = getTodayPacific();
    if (weekDates.includes(today)) {
      setSelectedDate(today);
    } else {
      setSelectedDate("");
    }
  }, [weekDates]);

  // ── Prefetch employees for ALL tabs in parallel ───────────────────────────
  const [employeesByTab, setEmployeesByTab] = useState<Record<string, EmployeeRecipient[]>>({});
  const [loadingTabs, setLoadingTabs] = useState<Set<string>>(new Set(SUB_TABS.map(t => t.id)));

  const fetchTabEmployees = useCallback(async (tabId: string, yearWeek: string) => {
    try {
      const params = new URLSearchParams({ filter: tabId });
      if (yearWeek) params.append("yearWeek", yearWeek);
      const res = await fetch(`/api/messaging/employees?${params.toString()}`);
      const data = await res.json();
      return data.employees || [];
    } catch {
      return [];
    }
  }, []);

  // Hydrate from global store for the first week
  const hydratedMessagingRef = useRef(false);
  const fetchedWeekRef = useRef<string>("");

  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;

    const isDefaultWeek = weeks?.[0] === selectedWeek;

    // ── Try hydrating from store (instant load) ──
    if (isDefaultWeek && store.initialized) {
      const storeEmployees = store.messagingEmployees;
      const hydrated: Record<string, EmployeeRecipient[]> = {};
      const stillLoading = new Set<string>();

      for (const tab of SUB_TABS) {
        const data = storeEmployees[tab.id as keyof typeof storeEmployees];
        if (data && Array.isArray(data)) {
          hydrated[tab.id] = data;
        } else {
          stillLoading.add(tab.id);
        }
      }

      if (Object.keys(hydrated).length > 0) {
        hydratedMessagingRef.current = true;
        fetchedWeekRef.current = selectedWeek;
        setEmployeesByTab(hydrated);
        setLoadingTabs(stillLoading);

        // Fetch any tabs not covered by global store
        for (const tabId of stillLoading) {
          fetchTabEmployees(tabId, selectedWeek).then((emps) => {
            if (cancelled) return;
            setEmployeesByTab(prev => ({ ...prev, [tabId]: emps }));
            setLoadingTabs(prev => {
              const next = new Set(prev);
              next.delete(tabId);
              return next;
            });
          });
        }
        return () => { cancelled = true; };
      }
    }

    // ── If default week but store not ready yet, wait for it ──
    if (isDefaultWeek && !store.initialized) {
      // Don't fire API calls — store will initialize soon and re-trigger this effect
      return;
    }

    // ── Non-default week: Skip if we already fetched this week ──
    if (fetchedWeekRef.current === selectedWeek) return;
    fetchedWeekRef.current = selectedWeek;

    // ── Fallback: Fetch active tab first for fastest UX ──
    setLoadingTabs(new Set(SUB_TABS.map(t => t.id)));

    fetchTabEmployees(resolvedTab, selectedWeek).then((emps) => {
      if (cancelled) return;
      setEmployeesByTab(prev => ({ ...prev, [resolvedTab]: emps }));
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(resolvedTab);
        return next;
      });
    });

    // Background-fetch remaining tabs after 100ms so active tab gets priority
    const bgTimer = setTimeout(() => {
      SUB_TABS
        .filter(t => t.id !== resolvedTab)
        .forEach((tab) => {
          fetchTabEmployees(tab.id, selectedWeek).then((emps) => {
            if (cancelled) return;
            setEmployeesByTab(prev => ({ ...prev, [tab.id]: emps }));
            setLoadingTabs(prev => {
              const next = new Set(prev);
              next.delete(tab.id);
              return next;
            });
          });
        });
    }, 100);

    return () => { cancelled = true; clearTimeout(bgTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, store.initialized, fetchTabEmployees]); // re-run when store initializes

  // ── Report active tab info to parent ──────────────────────────────────────
  const activeTabConfig = SUB_TABS.find(t => t.id === resolvedTab) || SUB_TABS[0];
  const activeEligibleCount = employeesByTab[resolvedTab]?.length ?? 0;
  const activeLoading = loadingTabs.has(resolvedTab);
  const [activeSelectedCount, setActiveSelectedCount] = useState(0);

  // Reset selection count when tab switches
  useEffect(() => { setActiveSelectedCount(0); }, [resolvedTab]);

  const handleRefresh = useCallback(() => {
    if (!selectedWeek) return;
    setLoadingTabs(prev => {
      const next = new Set(prev);
      next.add(resolvedTab);
      return next;
    });
    fetchTabEmployees(resolvedTab, selectedWeek).then((emps) => {
      setEmployeesByTab(prev => ({ ...prev, [resolvedTab]: emps }));
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(resolvedTab);
        return next;
      });
    });
  }, [resolvedTab, selectedWeek, fetchTabEmployees]);

  useEffect(() => {
    onActiveTabInfo?.({
      label: activeTabConfig.label,
      icon: activeTabConfig.icon,
      iconColor: activeTabConfig.iconColor,
      eligibleCount: activeEligibleCount,
      selectedCount: activeSelectedCount,
      loading: activeLoading,
      refresh: handleRefresh,
    });
  }, [resolvedTab, activeEligibleCount, activeSelectedCount, activeLoading, handleRefresh]);

  // ── Prefetch ALL templates in parallel ────────────────────────────────────
  const [templatesByTab, setTemplatesByTab] = useState<Record<string, string>>({});
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Single batch fetch for ALL templates (instead of N individual calls)
    const allTypes = SUB_TABS.map(t => t.id).join(",");
    fetch(`/api/messaging/templates?types=${allTypes}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const templateMap = data.templates || {};
        const map: Record<string, string> = {};
        SUB_TABS.forEach(tab => {
          map[tab.id] = templateMap[tab.id]?.template || tab.defaultMessage;
        });
        setTemplatesByTab(map);
        setTemplatesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback to defaults
        const map: Record<string, string> = {};
        SUB_TABS.forEach(tab => { map[tab.id] = tab.defaultMessage; });
        setTemplatesByTab(map);
        setTemplatesLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full gap-3">
        {/* ── Sub-Tab Navigation ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {SUB_TABS.filter(tab => !tab.hidden).map((tab) => {
            const isActive = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSubTabChange?.(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}

          {/* Divider + Date Tabs */}
          {weekDates.length > 0 && (
            <>
              <div className="w-px h-6 bg-border/60 mx-1 shrink-0" />
              {weekDates.map((dateStr: string, idx: number) => {
                const isActive = selectedDate === dateStr;
                const d = new Date(dateStr + "T00:00:00Z");
                const dayNum = d.getUTCDate();
                const monthShort = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
                const today = getTodayPacific();
                const isToday = dateStr === today;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isActive ? "" : dateStr)}
                    className={cn(
                      "flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap min-w-[48px] select-none shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : isToday
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-wider leading-tight opacity-80">{SHORT_DAYS[idx]}</span>
                    <span className="text-xs font-bold leading-tight">{dayNum}</span>
                    <span className="text-[8px] uppercase leading-tight opacity-60">{monthShort}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ── Sub-tab panels — all mounted, data pre-loaded ── */}
        <div className="flex-1 min-h-0">
          {SUB_TABS.map((tab) => (
            <div key={tab.id} className={cn("h-full", resolvedTab !== tab.id && "hidden")}>
              <MessagingSubTab
                tab={tab}
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                searchQuery={searchQuery}
                selectAllTrigger={selectAllTrigger}
                phoneNumbers={phoneNumbers}
                fromNumber={fromNumber}
                fromNumberDisplay={fromNumberDisplay}
                setFromNumber={setFromNumber}
                setFromNumberDisplay={setFromNumberDisplay}
                loadingPhones={loadingPhones}
                prefetchedEmployees={employeesByTab[tab.id]}
                employeesLoading={loadingTabs.has(tab.id)}
                prefetchedTemplate={templatesByTab[tab.id]}
                templatesLoaded={templatesLoaded}
                onSelectionReport={tab.id === resolvedTab ? setActiveSelectedCount : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

