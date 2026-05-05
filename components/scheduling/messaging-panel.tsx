"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { MessageStatusBadge, LiveIndicator } from "@/components/ui-elements/message-status-badge";
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
  Map as MapIcon,
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
  Megaphone,
  Paperclip,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  FileSpreadsheet,
  File as FileIcon,
  ToggleLeft,
  ToggleRight,
  Navigation,
  DoorOpen,
  DoorClosed,
  Coffee,
  PhoneOff,
  GraduationCap,
  Truck as TruckIcon,
  CalendarOff,
  UserCheck,
  BookOpen,
  Ban,
  ShieldAlert,
  Minus,
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
    routeNumber?: string;
    stagingLocation?: string;
    pad?: string;
    waveTime?: string;
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

/** Format a raw phone number to (XXX) XXX-XXXX display format. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Strip leading country code "1" if 11 digits
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return raw; // fallback: return as-is if not a standard US number
}

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

/** Get the next day after a given YYYY-MM-DD date string. */
function getNextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

/** Convert any date (string or Date) to YYYY-MM-DD in Pacific Time. */
function toPacificDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  if (isNaN(date.getTime())) return typeof d === "string" ? d : "";
  // Nudge midnight-UTC dates to noon so Intl formatting doesn't slip a day
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
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
  const pacific = toPacificDate(dateStr);
  if (!pacific || pacific === dateStr) {
    // fallback for already-formatted YYYY-MM-DD strings
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return dateStr;
  }
  const parts = pacific.split("-");
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  // Use Pacific timezone for day-of-week
  const dayIdx = new Date(toPacificDate(dateStr) + "T12:00:00.000Z").getUTCDay();
  return FULL_DAY_NAMES[dayIdx];
}

function personalizeMessage(template: string, emp: EmployeeRecipient, tabId?: string, selectedWeek?: string, routeIconMap?: Record<string, string>, selectedDate?: string): string {
  const NON_WORKING = ["off", "close", "request off", ""];

  // Determine which schedule to use based on tab context
  let targetShift = emp.schedules?.find(
    (s) => s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
  );

  // For future-shift/off-tomorrow, the actual shift day is tomorrow (selectedDate + 1)
  const baseDate = selectedDate || getTodayPacific();
  const targetDate = (tabId === "future-shift" || tabId === "off-tomorrow")
    ? getNextDay(baseDate)
    : baseDate;

  if (tabId === "shift" || tabId === "route-itinerary") {
    const dayShift = emp.schedules?.find(
      (s) => toPacificDate(s.date) === targetDate
    );
    if (dayShift) targetShift = dayShift;
  } else if (tabId === "future-shift") {
    const dayShift = emp.schedules?.find(
      (s) => toPacificDate(s.date) === targetDate
    );
    if (dayShift) targetShift = dayShift;
  } else if (tabId === "off-tomorrow") {
    const dayShift = emp.schedules?.find(
      (s) => toPacificDate(s.date) === targetDate
    );
    if (dayShift) targetShift = dayShift;
  }

  const name = emp.name || `${emp.firstName} ${emp.lastName}`.toUpperCase();
  const startTime = targetShift?.startTime || "";
  const standupTime = startTime ? addMinutesToTime(startTime, 5) : "";

  // Use the target date for date display
  let shiftDate = "";
  let dayOfWeek = "";

  if (targetDate) {
    const dateObj = new Date(targetDate + "T00:00:00Z");
    shiftDate = formatDateMMDDYYYY(dateObj.toISOString());
    dayOfWeek = FULL_DAY_NAMES[dateObj.getUTCDay()];
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
      const isWorking = (s.status || "").trim().toLowerCase() === "scheduled";
      
      let typeDisplay = "";
      const typeStr = (s.type || "").trim();
      const typeLower = typeStr.toLowerCase();
      
      if (typeLower && typeLower !== "route" && typeLower !== "off") {
        typeDisplay = ` | ${typeStr}`;
      }

      if (isWorking) {
        return ` ${dn} ${df} ✅ ${s.startTime || ""}${typeDisplay}`;
      } else {
        return ` ${dn} ${df} ❌ OFF${typeDisplay}`;
      }
    });
    weekSchedule = lines.join("\n");
  }

  const van = targetShift?.van || "";
  const routeNumber = targetShift?.routeNumber || "";
  const stagingLocation = targetShift?.stagingLocation || "";
  const pad = targetShift?.pad || "";
  const waveTime = targetShift?.waveTime || "";

  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{startTime\}/gi, startTime)
    .replace(/\{standupTime\}/gi, standupTime)
    .replace(/\{date\}/gi, shiftDate)
    .replace(/\{dayOfWeek\}/gi, dayOfWeek)
    .replace(/\{yearWeek\}/gi, yearWeekDisplay)
    .replace(/\{weekSchedule\}/gi, weekSchedule)
    .replace(/\{van\}/gi, van)
    .replace(/\{routeNumber\}/gi, routeNumber)
    .replace(/\{stagingLocation\}/gi, stagingLocation)
    .replace(/\{pad\}/gi, pad)
    .replace(/\{waveTime\}/gi, waveTime);
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
    id: "shift",
    label: "Shift Notification",
    icon: Bell,
    description: "Send notifications about current shift schedules",
    gradient: "from-emerald-500/15 to-teal-500/15",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou have a shift scheduled today @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nThank you!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "future-shift",
    label: "Future Shift Notification",
    icon: BellRing,
    description: "Notify employees about their upcoming scheduled shifts",
    gradient: "from-blue-500/15 to-cyan-500/15",
    iconColor: "text-blue-500",
    borderColor: "border-blue-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nSee you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "route-itinerary",
    label: "Route Itinerary",
    icon: MapIcon,
    description: "Share route details and itinerary with drivers",
    gradient: "from-rose-500/15 to-pink-500/15",
    iconColor: "text-rose-500",
    borderColor: "border-rose-500/30",
    defaultMessage:
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYour route itinerary has been updated. Please review your assigned route for today.\nRoute: {routeNumber}\nVan: {van}\nStaging: {stagingLocation}\nPad: {pad}\nWave Time: {waveTime}\n\nPlease confirm here: {confirmationLink}\n\nThank you!",
    variables: ["name", "dayOfWeek", "date", "van", "stagingLocation", "routeNumber", "pad", "waveTime", "confirmationLink"],
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
      "Hi {name}\n\nHere is your schedule for next week {yearWeek}\n----------------------\n\n{weekSchedule}\n\n----------------------\nPlease confirm here: {confirmationLink}\n\nPlease check your start times!",
    variables: ["name", "yearWeek", "weekSchedule", "confirmationLink"],
  },
  {
    id: "flyer",
    label: "Flyer",
    icon: Megaphone,
    description: "Send a custom broadcast message to all active employees",
    gradient: "from-orange-500/15 to-amber-500/15",
    iconColor: "text-orange-500",
    borderColor: "border-orange-500/30",
    defaultMessage: "",
    variables: ["name"],
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
      "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are off today. Reminder: you are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nSee you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
    hidden: true,
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
  sentBy?: string;
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

function MessageHistoryTab({ messageType, selectedPhones, yearWeek, scheduleDate }: { messageType: string; selectedPhones?: string[]; yearWeek?: string; scheduleDate?: string }) {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLogs([]);
    setLoading(true);
    const params = new URLSearchParams({ messageType, limit: "200" });
    if (scheduleDate) {
      params.set("scheduleDate", scheduleDate);
    } else if (yearWeek) {
      params.set("yearWeek", yearWeek);
    }
    fetch(`/api/messaging/history?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [messageType, yearWeek, scheduleDate]);

  const filteredLogs = useMemo(() => {
    if (!selectedPhones || selectedPhones.length === 0) return logs;
    return logs.filter((log) => selectedPhones.includes(log.toNumber));
  }, [logs, selectedPhones]);

  const formatTime = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return d; }
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
          {selectedPhones && selectedPhones.length > 0 ? "No messages found for selected employees" : "No messages sent yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {filteredLogs.map((log) => (
        <div key={log._id} className="border-b border-border/30 last:border-0 px-3 py-3 space-y-2">
          {/* Employee Header */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate">{log.recipientName}</span>
            <span className="text-[10px] text-muted-foreground">{log.toNumber}</span>
          </div>

          {/* Sent Card */}
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowUpRight className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Sent</span>
              {log.sentBy && <span className="text-[10px] text-muted-foreground/70">by {log.sentBy.replace(/@.*$/, "")}</span>}
              <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(log.sentAt)}</span>
            </div>
            <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{log.content}</pre>
          </div>

          {/* Delivered */}
          {log.deliveredAt && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/5 border border-blue-500/10">
              <CheckCircle2 className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] text-blue-500 font-medium">Delivered</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(log.deliveredAt)}</span>
            </div>
          )}

          {/* Confirmed */}
          {log.confirmation?.status === "confirmed" && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Confirmed</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{log.confirmation.confirmedAt ? formatTime(log.confirmation.confirmedAt) : ""}</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">✅ Employee confirmed their schedule</p>
            </div>
          )}

          {/* Change Requested */}
          {log.confirmation?.status === "change_requested" && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Change Requested</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{log.confirmation.changeRequestedAt ? formatTime(log.confirmation.changeRequestedAt) : ""}</span>
              </div>
              {log.confirmation.changeRemarks && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-1">&ldquo;{log.confirmation.changeRemarks}&rdquo;</p>
              )}
            </div>
          )}

          {/* Reply (non-confirmation) */}
          {log.replyContent && !log.confirmation && (
            <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-3">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="h-3 w-3 text-violet-500" />
                <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Reply</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{log.repliedAt ? formatTime(log.repliedAt) : ""}</span>
              </div>
              <p className="text-[11px] text-foreground/80 mt-1">{log.replyContent}</p>
            </div>
          )}

          {/* Error */}
          {log.status === "failed" && log.errorMessage && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/5 border border-red-500/10">
              <XCircle className="h-3 w-3 text-red-500" />
              <span className="text-[10px] text-red-500 font-medium">Error: {log.errorMessage}</span>
            </div>
          )}
        </div>
      ))}
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
  routeTypeMap,
  prefetchedTemplate,
  templatesLoaded,
  showOffToday,
  routeIconMap,
  selectedDate,
  prefetchedOffTomorrowEmployees,
  offTomorrowLoading,
  onSelectionReport,
  onEligibleReport,
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
  routeTypeMap: Record<string, string>;
  prefetchedTemplate?: string;
  templatesLoaded: boolean;
  showOffToday?: boolean;
  routeIconMap?: Record<string, string>;
  selectedDate?: string;
  prefetchedOffTomorrowEmployees?: EmployeeRecipient[];
  offTomorrowLoading: boolean;
  onSelectionReport?: (count: number) => void;
  onEligibleReport?: (count: number) => void;
}) {
  // Use prefetched data from parent — stable reference to avoid infinite re-renders
  const EMPTY: EmployeeRecipient[] = useMemo(() => [], []);
  const employees = prefetchedEmployees ?? EMPTY;
  const loading = employeesLoading;

  // ── "Off Today" data for the future-shift tab ──
  // Uses prefetched off-tomorrow data from parent (employeesByTab["off-tomorrow"])
  const offTodayEmployees = prefetchedOffTomorrowEmployees ?? EMPTY;
  const offTodayLoading = offTomorrowLoading;

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

  // ── Attachment State (Flyer tab only) ──
  interface Attachment {
    name: string;
    url: string;
    type: string;
    size: number;
    publicId: string;
  }
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    if (attachments.length + fileArray.length > 5) {
      toast.error("Maximum 5 attachments allowed");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      fileArray.forEach((f) => formData.append("files", f));
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 15, 90));
      }, 200);
      const res = await fetch("/api/messaging/upload", {
        method: "POST",
        body: formData,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setAttachments((prev) => [...prev, ...data.files]);
      toast.success(`${data.files.length} file(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [attachments.length]);

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type === "application/pdf") return FileText;
    if (type.includes("spreadsheet") || type.includes("excel")) return FileSpreadsheet;
    return FileIcon;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Route Types received from parent (fetched ONCE, shared across all tabs)

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
        // Pass the selected date for date-scoped status lookups
        if (selectedDate && tab.id !== "week-schedule") {
          params.set("scheduleDate", selectedDate);
        }

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

    // Poll immediately, then every 8 seconds (reduced from 4s for performance)
    doPoll();
    pollIntervalRef.current = setInterval(doPoll, 8000);

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
  const initialTemplateRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (templatesLoaded && prefetchedTemplate !== undefined && !templateLoaded) {
      initialTemplateRef.current = prefetchedTemplate;
      setMessage(prefetchedTemplate);
      setTemplateLoaded(true);
    }
  }, [templatesLoaded, prefetchedTemplate, templateLoaded]);

  // Auto-save template to DB with debounce
  const messageRef = useRef(message);
  messageRef.current = message;
  const lastSavedRef = useRef<string | null>(null);

  const saveTemplate = useCallback(async (content: string) => {
    if (lastSavedRef.current === content) return; // skip if unchanged
    try {
      setSaving(true);
      const res = await fetch("/api/messaging/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab.id, template: content }),
      });
      if (res.ok) {
        lastSavedRef.current = content;
      } else {
        const err = await res.json();
        console.error("Failed to save template:", err);
      }
    } catch (e) {
      console.error("Save template network error:", e);
    } finally {
      setSaving(false);
    }
  }, [tab.id]);

  useEffect(() => {
    if (!templateLoaded) return;
    // Don't auto-save the initial empty load — only save when user actually changes something
    if (message === initialTemplateRef.current && lastSavedRef.current === null) {
      lastSavedRef.current = message; // mark initial value as "saved"
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveTemplate(message);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [message, tab.id, templateLoaded, saveTemplate]);

  // Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const current = messageRef.current;
      if (lastSavedRef.current !== current && current !== undefined) {
        // Fire-and-forget save using sendBeacon for reliability on unmount
        try {
          navigator.sendBeacon(
            "/api/messaging/templates",
            new Blob(
              [JSON.stringify({ type: tab.id, template: current })],
              { type: "application/json" }
            )
          );
        } catch {
          // fallback: fire-and-forget fetch
          fetch("/api/messaging/templates", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: tab.id, template: current }),
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

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

  useEffect(() => {
    onEligibleReport?.(filteredEmployees.length);
  }, [filteredEmployees.length, onEligibleReport]);

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
    // For future-shift/off-tomorrow, the actual shift day is tomorrow (selectedDate + 1)
    const baseDateForSend = selectedDate || getTodayPacific();
    const targetDateForSend = (tab.id === "future-shift" || tab.id === "off-tomorrow")
      ? getNextDay(baseDateForSend)
      : baseDateForSend;

    const recipients = selectedEmployees.map((emp) => {
      // Determine the correct schedule date based on selected date or tab context
      let targetScheduleDate: string | undefined = targetDateForSend || undefined;

      // Find matching schedule for the target date to get shift details
      const matchingShift = targetDateForSend
        ? emp.schedules?.find((s) => {
            return toPacificDate(s.date) === targetDateForSend;
          })
        : emp.schedules?.find(
            (s) => s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
          );

      if (matchingShift?.date) {
        targetScheduleDate = toPacificDate(matchingShift.date);
      }

      // Build personalized message and append attachment links for flyer
      let finalMessage = personalizeMessage(message.trim(), emp, tab.id, selectedWeek, routeIconMap, selectedDate);
      if (tab.id === "flyer" && attachments.length > 0) {
        finalMessage += "\n\n📎 Attachments:";
        attachments.forEach((att) => {
          finalMessage += `\n${att.name}: ${att.url}`;
        });
      }

      return {
        phone: emp.phoneNumber.startsWith("+") ? emp.phoneNumber : `+1${emp.phoneNumber.replace(/\D/g, "")}`,
        name: emp.name,
        message: finalMessage,
        transporterId: emp.transporterId,
        scheduleDate: targetScheduleDate,
        yearWeek: selectedWeek || undefined,
      };
    });

    setSending(true);
    setSendResults(null);

    try {
      // Build a single batch payload with all recipients
      const payload = {
        recipients: recipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          message: r.message,
          transporterId: r.transporterId,
          scheduleDate: r.scheduleDate,
          yearWeek: r.yearWeek,
        })),
        message: message.trim(),
        from: fromNumber,
        messageType: tab.id,
      };

      const res = await fetch("/api/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send messages");
      }

      // The API returns per-recipient results — check each one
      const results: SendResult[] = (data.results || []).map((r: any) => ({
        to: r.to,
        name: r.name || "",
        success: r.success,
        error: r.error,
      }));

      setSendResults(results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0 && successCount > 0) {
        toast.success(`${successCount} message(s) sent successfully!`);
      } else if (successCount === 0 && failCount > 0) {
        // All failed — show the first error message for user context
        const firstError = results.find((r) => !r.success)?.error || "Unknown error";
        toast.error(`All ${failCount} message(s) failed: ${firstError}`);
      } else if (failCount > 0) {
        toast.warning(`${successCount} sent, ${failCount} failed`);
      }

      // Start live polling for successfully sent phones
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
            <div className={cn(
              "grid items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold",
              tab.id === "week-schedule"
                ? "grid-cols-[40px_1fr_100px_120px]"
                : "grid-cols-[40px_1fr_100px_120px_120px]"
            )}>
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
              <span>Type</span>
              <span>Phone</span>
              {tab.id !== "week-schedule" && <span>Schedule Type</span>}
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

                // For future-shift, display tomorrow's shift (selectedDate + 1)
                const baseDisplayDate = selectedDate || getTodayPacific();
                const displayDate = (tab.id === "future-shift" || tab.id === "off-tomorrow")
                  ? getNextDay(baseDisplayDate)
                  : baseDisplayDate;
                const nextShift = emp.schedules?.find(
                  (s) => {
                    if (displayDate) {
                      return toPacificDate(s.date) === displayDate;
                    }
                    return true;
                  }
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
                      "grid items-center gap-2 px-3 py-2 border-b border-border/20 cursor-pointer transition-all duration-500 hover:bg-muted/30",
                      tab.id === "week-schedule"
                        ? "grid-cols-[40px_1fr_100px_120px]"
                        : "grid-cols-[40px_1fr_100px_120px_120px]",
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
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/15 text-red-500 ring-1 ring-red-500/30 cursor-help">
                                  <XCircle className="h-3 w-3" />
                                  FAILED
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">{sendResult.error || "Message failed to send"}</TooltipContent>
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
                      {formatPhone(emp.phoneNumber)}
                    </span>

                    {/* Schedule Type — hidden on week-schedule tab */}
                    {tab.id !== "week-schedule" && (
                      nextShift ? (() => {
                        const displayType = (nextShift as any).scheduleType || nextShift.type || "";
                        const typeKey = displayType.toLowerCase().trim();
                        const color = routeTypeMap[typeKey] || "#10b981";
                        
                        let CellIcon = Navigation;
                        let isOff = false;
                        if (typeKey === "open") CellIcon = DoorOpen;
                        else if (typeKey === "close") CellIcon = DoorClosed;
                        else if (["off", "request off"].includes(typeKey)) { CellIcon = Coffee; isOff = true; }
                        else if (typeKey === "call out") CellIcon = PhoneOff;
                        else if (typeKey.includes("train")) CellIcon = GraduationCap;
                        else if (typeKey === "fleet") CellIcon = TruckIcon;
                        else if (typeKey === "trainer") CellIcon = UserCheck;
                        else if (typeKey === "suspension") CellIcon = Ban;
                        else if (typeKey === "modified duty") CellIcon = ShieldAlert;
                        else if (typeKey === "stand by") CellIcon = Clock;

                        return (
                          <span
                            className="flex items-center justify-center gap-1 min-w-[70px] w-max h-6 rounded-md text-[10px] font-semibold tracking-wide border px-2 shadow-sm"
                            style={{
                              backgroundColor: isOff ? "transparent" : color,
                              color: isOff ? color : "#ffffff",
                              borderColor: isOff ? `${color}40` : color
                            }}
                          >
                            <CellIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{displayType}</span>
                          </span>
                        );
                      })() : (
                        <span className="text-[11px] text-muted-foreground/40 truncate">—</span>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* List Footer removed as per user request */}
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
              ) : (() => {
                const selectedEmps = filteredEmployees.filter((e) => selectedIds.has(e._id));
                const previewLimit = 10;
                const showing = selectedEmps.slice(0, previewLimit);
                const remaining = selectedEmps.length - previewLimit;
                return (
                  <div className="space-y-3">
                    {showing.map((emp) => (
                      <div
                        key={emp._id}
                        className="rounded-lg border border-border/30 bg-muted/10 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-semibold text-primary">
                            {emp.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {formatPhone(emp.phoneNumber)}
                          </span>
                        </div>
                        <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                          {personalizeMessage(message, emp, tab.id, selectedWeek, routeIconMap, selectedDate)}
                        </pre>
                        {/* Preview attachments if any */}
                        {tab.id === "flyer" && attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/20">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                              <Paperclip className="h-3 w-3" /> {attachments.length} Attachment{attachments.length > 1 ? "s" : ""}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {attachments.map((att, ai) => {
                                const Icon = getFileIcon(att.type);
                                const isImage = att.type.startsWith("image/");
                                return (
                                  <div key={ai} className="flex items-center gap-1.5 rounded-md bg-muted/30 border border-border/30 px-2 py-1">
                                    {isImage ? (
                                      <img src={att.url} alt={att.name} className="h-5 w-5 rounded object-cover" />
                                    ) : (
                                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span className="text-[9px] font-medium truncate max-w-[100px]">{att.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {remaining > 0 && (
                      <p className="text-center text-[11px] text-muted-foreground py-2">
                        + {remaining} more preview{remaining > 1 ? "s" : ""} not shown
                      </p>
                    )}
                  </div>
                );
              })()}
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

                {/* ── Flyer Attachments Section ── */}
                {tab.id === "flyer" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Attachments
                      </span>
                      {attachments.length > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                          {attachments.length}/5
                        </Badge>
                      )}
                    </div>

                    {/* Drop Zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (e.dataTransfer.files.length > 0) {
                          handleFileUpload(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "relative rounded-lg border-2 border-dashed p-4 cursor-pointer transition-all duration-300 group",
                        dragOver
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-border/50 hover:border-primary/40 hover:bg-muted/20",
                        uploading && "pointer-events-none opacity-70"
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) handleFileUpload(e.target.files);
                          e.target.value = "";
                        }}
                      />

                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative h-10 w-10">
                            <svg className="h-10 w-10 animate-spin" viewBox="0 0 36 36" style={{ animationDuration: "2s" }}>
                              <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeOpacity="0.15" />
                              <circle
                                cx="18" cy="18" r="14" fill="none"
                                stroke="hsl(var(--primary))" strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${uploadProgress * 0.88} 88`}
                                className="transition-all duration-300"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">
                              {uploadProgress}%
                            </span>
                          </div>
                          <span className="text-[11px] text-primary font-medium animate-pulse">
                            Uploading...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Upload className="h-4 w-4 text-primary" />
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            <span className="font-semibold text-foreground">Click to browse</span>{" "}
                            or drag & drop files here
                          </p>
                          <p className="text-[9px] text-muted-foreground/60">
                            Images, PDFs, Documents • Max 10MB per file • Up to 5 files
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Uploaded Files Gallery */}
                    {attachments.length > 0 && (
                      <div className="space-y-1.5">
                        {attachments.map((att, idx) => {
                          const Icon = getFileIcon(att.type);
                          const isImage = att.type.startsWith("image/");
                          return (
                            <div
                              key={`${att.publicId}-${idx}`}
                              className="group/file flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 hover:bg-muted/40 hover:border-border/60 transition-all duration-200"
                            >
                              {/* Thumbnail / Icon */}
                              {isImage ? (
                                <div className="h-10 w-10 rounded-md overflow-hidden border border-border/30 shrink-0 bg-muted">
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className={cn(
                                  "h-10 w-10 rounded-md flex items-center justify-center shrink-0 border border-border/30",
                                  att.type === "application/pdf" ? "bg-red-500/10" : "bg-blue-500/10"
                                )}>
                                  <Icon className={cn(
                                    "h-5 w-5",
                                    att.type === "application/pdf" ? "text-red-500" : "text-blue-500"
                                  )} />
                                </div>
                              )}

                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold truncate">{att.name}</p>
                                <p className="text-[9px] text-muted-foreground">
                                  {formatFileSize(att.size)} • {att.type.split("/").pop()?.toUpperCase()}
                                </p>
                              </div>

                              {/* Actions */}
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[9px] font-medium text-primary hover:underline shrink-0"
                              >
                                View
                              </a>
                              <button
                                onClick={() => removeAttachment(idx)}
                                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover/file:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── History Tab ── */}
          {composerTab === "history" && (
            <MessageHistoryTab
              messageType={tab.id}
              yearWeek={selectedWeek}
              scheduleDate={
                // For date-specific tabs, scope history by the selected date
                tab.id !== "week-schedule" && selectedDate
                  ? selectedDate
                  : undefined
              }
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
                    {tab.id === "flyer" && attachments.length > 0 && (
                      <span className="text-primary font-medium"> • {attachments.length} attachment{attachments.length > 1 ? "s" : ""}</span>
                    )}
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
  refreshTrigger,
  initialDate,
  onDateChange,
}: {
  weeks: string[];
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  searchQuery: string;
  selectAllTrigger: number;
  activeSubTab: string;
  onSubTabChange?: (tab: string) => void;
  onActiveTabInfo?: (info: ActiveTabInfo) => void;
  refreshTrigger?: number;
  initialDate?: string;
  onDateChange?: (date: string) => void;
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

  // ── Route Types fetched ONCE here, shared to all sub-tabs via props ──
  const [routeTypeMap, setRouteTypeMap] = useState<Record<string, string>>({});
  const [routeIconMap, setRouteIconMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/admin/settings/route-types")
      .then(r => r.json())
      .then((data: any[]) => {
        const cMap: Record<string, string> = {};
        const iMap: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach(rt => { 
            const key = rt.name.toLowerCase().trim();
            cMap[key] = rt.color; 
            if (rt.icon) iMap[key] = rt.icon;
          });
        }
        setRouteTypeMap(cMap);
        setRouteIconMap(iMap);
      })
      .catch(() => {});
  }, []);

  const queryClient = useQueryClient();

  // ── Compute week dates for date pills ──
  const weekDates = useMemo(() => {
    if (!selectedWeek) return [];
    return getWeekDates(selectedWeek);
  }, [selectedWeek]);

  const [selectedDate, setSelectedDateState] = useState(initialDate || "");
  const [showOffToday, setShowOffToday] = useState(true);
  const initialDateAppliedRef = useRef(false);

  // Wrapped setter that notifies parent for URL sync
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    onDateChange?.(date);
  }, [onDateChange]);

  // Auto-select the contextual default date when week or tab changes
  useEffect(() => {
    if (weekDates.length === 0) return;
    const today = getTodayPacific();

    // If an initial date was provided from URL and it's valid for this week, use it (once)
    if (initialDate && !initialDateAppliedRef.current && weekDates.includes(initialDate)) {
      initialDateAppliedRef.current = true;
      setSelectedDate(initialDate);
      return;
    }
    initialDateAppliedRef.current = true;

    if (resolvedTab === "week-schedule") {
      // No date selection for week-schedule
      setSelectedDate("");
    } else {
      // Default to today if within this week, otherwise first day of the week
      setSelectedDate(weekDates.includes(today) ? today : weekDates[0]);
    }
  }, [weekDates, resolvedTab]);

  // ── Prefetch employees for ALL tabs in parallel ───────────────────────────
  const [employeesByTab, setEmployeesByTab] = useState<Record<string, EmployeeRecipient[]>>({});
  const [loadingTabs, setLoadingTabs] = useState<Set<string>>(new Set(SUB_TABS.map(t => t.id)));

  const fetchTabEmployees = useCallback(async (tabId: string, yearWeek: string, date?: string) => {
    try {
      const params = new URLSearchParams({ filter: tabId });
      if (yearWeek) params.append("yearWeek", yearWeek);
      // For future-shift/off-tomorrow, API expects the target work day (tomorrow)
      // so pass selectedDate + 1; for other tabs, pass selectedDate directly
      if (date && tabId !== "week-schedule") {
        // future-shift: pass tomorrow (the work day) as the date
        // off-tomorrow: pass today (API computes tomorrow = today + 1 server-side)
        const apiDate = tabId === "future-shift"
          ? getNextDay(date)
          : date;
        params.append("date", apiDate);
      }
      const res = await fetch(`/api/messaging/employees?${params.toString()}`);
      const data = await res.json();
      return data.employees || [];
    } catch {
      return [];
    }
  }, []);

  // Hydrate from TanStack Query cache for the first week
  const hydratedMessagingRef = useRef(false);
  const fetchedWeekRef = useRef<string>("");
  const activeWeekRef = useRef<string>("");

  useEffect(() => {
    if (!selectedWeek) return;
    activeWeekRef.current = selectedWeek;
    
    const effectWeek = selectedWeek;
    const isDefaultWeek = weeks?.[0] === selectedWeek;

    // ── Try hydrating from TanStack Query cache (instant load) ──
    if (isDefaultWeek && !hydratedMessagingRef.current) {
      const hydrated: Record<string, EmployeeRecipient[]> = {};
      const stillLoading = new Set<string>();

      for (const tab of SUB_TABS) {
        const cachedData = queryClient.getQueryData(qk.messaging.employees(tab.id, selectedWeek));
        if (cachedData && Array.isArray(cachedData)) {
          hydrated[tab.id] = cachedData;
        } else {
          stillLoading.add(tab.id);
        }
      }

      if (Object.keys(hydrated).length > 0) {
        hydratedMessagingRef.current = true;
        fetchedWeekRef.current = selectedWeek;
        setEmployeesByTab(hydrated);
        setLoadingTabs(stillLoading);

        // Fetch any tabs not covered by cache
        for (const tabId of stillLoading) {
          fetchTabEmployees(tabId, selectedWeek).then((emps) => {
            if (activeWeekRef.current !== effectWeek) return;
            setEmployeesByTab(prev => ({ ...prev, [tabId]: emps }));
            setLoadingTabs(prev => {
              const next = new Set(prev);
              next.delete(tabId);
              return next;
            });
          });
        }
        return; // Hydration handled this week
      }
    }

    // ── Track forced refreshes ──
    const forced = refreshTrigger !== undefined && refreshTrigger !== (fetchedWeekRef as any).lastRefresh;
    if (forced) {
        (fetchedWeekRef as any).lastRefresh = refreshTrigger;
    }



    // ── Skip if we already fetched/hydrated this week (unless forced) ──
    if (!forced && fetchedWeekRef.current === selectedWeek) return;
    fetchedWeekRef.current = selectedWeek;

    // ── Clear stale data from previous week immediately ──
    // This prevents old records from flashing in the UI while new data loads
    setEmployeesByTab({});
    prevFetchKeyRef.current = "";

    // ── Fetch active tab first for fastest UX ──
    setLoadingTabs(new Set(SUB_TABS.map(t => t.id)));

    fetchTabEmployees(resolvedTab, selectedWeek, selectedDate).then((emps) => {
      if (activeWeekRef.current !== effectWeek) return;
      setEmployeesByTab(prev => ({ ...prev, [resolvedTab]: emps }));
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(resolvedTab);
        return next;
      });
    });

    // Background-fetch remaining tabs after 100ms so active tab gets priority
    const bgTimer = setTimeout(() => {
      if (activeWeekRef.current !== effectWeek) return;

      SUB_TABS
        .filter(t => t.id !== resolvedTab)
        .forEach((tab) => {
          // For non-active tabs, pass date only if it's not week-schedule
          const tabDate = tab.id !== "week-schedule" ? selectedDate : undefined;
          fetchTabEmployees(tab.id, selectedWeek, tabDate).then((emps) => {
            if (activeWeekRef.current !== effectWeek) return;
            setEmployeesByTab(prev => ({ ...prev, [tab.id]: emps }));
            setLoadingTabs(prev => {
              const next = new Set(prev);
              next.delete(tab.id);
              return next;
            });
          });
        });
    }, 100);

    return () => clearTimeout(bgTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, fetchTabEmployees, refreshTrigger]); // re-run when week changes or refreshed

  // ── Re-fetch active tab when selectedDate or tab changes ──
  const prevFetchKeyRef = useRef("");
  useEffect(() => {
    if (!selectedWeek || !selectedDate) return;
    // Track both date AND tab to ensure re-fetch when either changes
    const fetchKey = `${resolvedTab}:${selectedDate}`;
    if (prevFetchKeyRef.current === fetchKey) return;
    prevFetchKeyRef.current = fetchKey;
    // Don't re-fetch for week-schedule since it doesn't use date
    if (resolvedTab === "week-schedule") return;

    setLoadingTabs(prev => {
      const next = new Set(prev);
      next.add(resolvedTab);
      // Also refresh off-tomorrow when on future-shift tab
      if (resolvedTab === "future-shift") next.add("off-tomorrow");
      return next;
    });
    fetchTabEmployees(resolvedTab, selectedWeek, selectedDate).then((emps) => {
      setEmployeesByTab(prev => ({ ...prev, [resolvedTab]: emps }));
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(resolvedTab);
        return next;
      });
    });
    // Also re-fetch off-tomorrow data when date changes on future-shift tab
    if (resolvedTab === "future-shift") {
      fetchTabEmployees("off-tomorrow", selectedWeek, selectedDate).then((emps) => {
        setEmployeesByTab(prev => ({ ...prev, ["off-tomorrow"]: emps }));
        setLoadingTabs(prev => {
          const next = new Set(prev);
          next.delete("off-tomorrow");
          return next;
        });
      });
    }
  }, [selectedDate, selectedWeek, resolvedTab, fetchTabEmployees]);

  // ── Report active tab info to parent ──────────────────────────────────────
  const activeTabConfig = SUB_TABS.find(t => t.id === resolvedTab) || SUB_TABS[0];
  const [activeEligibleCount, setActiveEligibleCount] = useState(0);
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
    const tabDate = resolvedTab !== "week-schedule" ? selectedDate : undefined;
    fetchTabEmployees(resolvedTab, selectedWeek, tabDate).then((emps) => {
      setEmployeesByTab(prev => ({ ...prev, [resolvedTab]: emps }));
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(resolvedTab);
        return next;
      });
    });
  }, [resolvedTab, selectedWeek, selectedDate, fetchTabEmployees]);

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
        <div className="flex items-center gap-1 overflow-x-auto py-1 px-1 -mx-1">
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

          {/* Divider + Date Tabs — hidden for week-schedule */}
          {weekDates.length > 0 && resolvedTab !== "week-schedule" && (
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
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      "flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap min-w-[48px] select-none shrink-0 transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/40"
                        : isToday
                          ? "bg-primary/10 text-primary ring-1 ring-primary/30 hover:bg-primary/20"
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

          {/* ── "Off Today" Toggle — only on future-shift tab ── */}
          {resolvedTab === "future-shift" && (
            <>
              <div className="w-px h-6 bg-border/60 mx-1 shrink-0" />
              <button
                onClick={() => setShowOffToday(prev => !prev)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap select-none shrink-0 transition-all duration-200",
                  showOffToday
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {showOffToday
                  ? <ToggleRight className="h-4 w-4 text-amber-500" />
                  : <ToggleLeft className="h-4 w-4" />
                }
                Off Today
                {showOffToday && (employeesByTab["off-tomorrow"]?.length ?? 0) > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold tabular-nums">
                    {employeesByTab["off-tomorrow"]?.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Only render active sub-tab (no hidden mounts) ── */}
        <div className="flex-1 min-h-0">
          {(() => {
            const tab = SUB_TABS.find(t => t.id === resolvedTab) || SUB_TABS[0];
            return (
              <div key={tab.id} className="h-full">
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
                  routeTypeMap={routeTypeMap}
                  routeIconMap={routeIconMap}
                  prefetchedEmployees={employeesByTab[tab.id]}
                  employeesLoading={loadingTabs.has(tab.id)}
                  prefetchedTemplate={templatesByTab[tab.id]}
                  templatesLoaded={templatesLoaded}
                  showOffToday={showOffToday}
                  prefetchedOffTomorrowEmployees={employeesByTab["off-tomorrow"]}
                  offTomorrowLoading={loadingTabs.has("off-tomorrow")}
                  selectedDate={resolvedTab !== "week-schedule" ? selectedDate : undefined}
                  onSelectionReport={setActiveSelectedCount}
                  onEligibleReport={setActiveEligibleCount}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </TooltipProvider>
  );
}

