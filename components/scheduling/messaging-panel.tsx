"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

function personalizeMessage(template: string, emp: EmployeeRecipient): string {
  // Find the next working shift for this employee
  const NON_WORKING = ["off", "close", "request off", ""];
  const futureShift = emp.schedules?.find(
    (s) => s.type && !NON_WORKING.includes(s.type.toLowerCase().trim())
  );

  const name = emp.name || `${emp.firstName} ${emp.lastName}`.toUpperCase();
  const startTime = futureShift?.startTime || "";
  const standupTime = startTime ? addMinutesToTime(startTime, 5) : "";
  const shiftDate = futureShift?.date ? formatDateMMDDYYYY(futureShift.date) : "";
  const dayOfWeek = futureShift?.date
    ? getDayOfWeek(futureShift.date)
    : futureShift?.weekDay || "";

  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{startTime\}/gi, startTime)
    .replace(/\{standupTime\}/gi, standupTime)
    .replace(/\{date\}/gi, shiftDate)
    .replace(/\{dayOfWeek\}/gi, dayOfWeek);
}

// ── Sub Tab Config ──
const SUB_TABS = [
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
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime"],
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
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime"],
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
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime"],
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
      "Hello {name}\n\nHere is your weekly schedule summary. Please review and confirm. Thank you!",
    variables: ["name"],
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
    variables: ["name", "dayOfWeek", "date"],
  },
];

// ── Messaging Sub-Tab Content ──
function MessagingSubTab({
  tab,
  weeks,
  selectedWeek,
  setSelectedWeek,
  searchQuery,
  selectAllTrigger,
}: {
  tab: (typeof SUB_TABS)[0];
  weeks: string[];
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  searchQuery: string;
  selectAllTrigger: number;
}) {
  const [employees, setEmployees] = useState<EmployeeRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(tab.defaultMessage);
  const [fromNumber, setFromNumber] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<QuoPhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(true);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [composerTab, setComposerTab] = useState<"preview" | "compose">("preview");

  // Fetch phone numbers from Quo
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
            setFromNumber(data.data[0].phoneNumber);
          }
        }
      } catch {
        // silently fail — fromNumber is optional
      } finally {
        setLoadingPhones(false);
      }
    };
    fetchPhoneNumbers();
  }, []);

  // Fetch employees for this filter
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setSendResults(null);
    try {
      const params = new URLSearchParams({ filter: tab.id });
      if (selectedWeek) params.append("yearWeek", selectedWeek);
      const res = await fetch(`/api/messaging/employees?${params.toString()}`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [tab.id, selectedWeek]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset selections when employees change
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedAll(false);
  }, [employees]);

  // Watch selectAllTrigger from header button
  useEffect(() => {
    if (selectAllTrigger === 0) return; // skip initial mount
    toggleSelectAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAllTrigger]);

  // Filter by search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.phoneNumber.includes(q) ||
        emp.transporterId?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

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
      setSelectedIds(new Set(filteredEmployees.map((e) => e._id)));
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

    // Build per-employee personalized messages
    const recipients = selectedEmployees.map((emp) => ({
      phone: emp.phoneNumber.startsWith("+") ? emp.phoneNumber : `+1${emp.phoneNumber.replace(/\D/g, "")}`,
      name: emp.name,
      message: personalizeMessage(message.trim(), emp),
    }));

    setSending(true);
    setSendResults(null);

    try {
      // Send each personalized message individually
      const results: SendResult[] = [];

      const sendPromises = recipients.map(async (r) => {
        try {
          const res = await fetch("/api/messaging/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipients: [{ phone: r.phone, name: r.name }],
              message: r.message,
              from: fromNumber || undefined,
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed");

          return { to: r.phone, name: r.name, success: true };
        } catch (err: any) {
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
    } catch (err: any) {
      toast.error(err.message || "Failed to send messages");
    } finally {
      setSending(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header Card ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 bg-gradient-to-br",
          tab.gradient,
          tab.borderColor
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center bg-background/50 backdrop-blur-sm border border-border/50"
              )}
            >
              <tab.icon className={cn("h-5 w-5", tab.iconColor)} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{tab.label}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {tab.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] h-5 bg-background/60 backdrop-blur-sm"
            >
              <Users className="h-3 w-3 mr-1" />
              {loading ? "..." : employees.length} eligible
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={fetchEmployees}
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* ── Left: Employee List ── */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
          {/* Employee Rows */}
          <div className="flex-1 overflow-auto">
            {loading ? (
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

                // Determine the schedule summary for this employee
                const nextShift = emp.schedules?.find(
                  (s) =>
                    s.type &&
                    !["off", "close", "request off", ""].includes(
                      s.type.toLowerCase().trim()
                    )
                );

                return (
                  <div
                    key={emp._id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 border-b border-border/20 cursor-pointer transition-all hover:bg-muted/30",
                      isSelected &&
                        "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => toggleSelect(emp._id)}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                      )}
                    </div>

                    {/* Employee Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">
                          {emp.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 shrink-0"
                        >
                          {emp.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground/60" />
                        <span className="text-[11px] text-muted-foreground">
                          {emp.phoneNumber}
                        </span>
                        {nextShift && (
                          <>
                            <span className="text-muted-foreground/20">|</span>
                            <span className="text-[10px] text-emerald-500 font-medium">
                              {nextShift.type} — {nextShift.weekDay}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Send result indicator */}
                    {sendResults && (
                      <div className="shrink-0">
                        {sendResults.find(
                          (r) =>
                            r.to ===
                            (emp.phoneNumber.startsWith("+")
                              ? emp.phoneNumber
                              : `+1${emp.phoneNumber.replace(/\D/g, "")}`)
                        )?.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : sendResults.find(
                            (r) =>
                              r.to ===
                              (emp.phoneNumber.startsWith("+")
                                ? emp.phoneNumber
                                : `+1${emp.phoneNumber.replace(/\D/g, "")}`)
                          ) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <XCircle className="h-4 w-4 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {
                                sendResults.find(
                                  (r) =>
                                    r.to ===
                                    (emp.phoneNumber.startsWith("+")
                                      ? emp.phoneNumber
                                      : `+1${emp.phoneNumber.replace(
                                          /\D/g,
                                          ""
                                        )}`)
                                )?.error
                              }
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    )}
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
            {fromNumber && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 ml-auto"
              >
                From: {fromNumber}
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
                          {personalizeMessage(message, emp)}
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
                  <Select value={fromNumber} onValueChange={setFromNumber}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((pn) => (
                        <SelectItem key={pn.id} value={pn.phoneNumber}>
                          {pn.name} ({pn.phoneNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No phone numbers found in Quo account. Messages will use default
                    number.
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
                  <span className="text-[10px] text-muted-foreground">
                    {message.length} chars
                  </span>
                </div>
              </div>
            </>
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
export default function MessagingPanel({
  weeks,
  selectedWeek,
  setSelectedWeek,
  searchQuery,
  selectAllTrigger,
}: {
  weeks: string[];
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  searchQuery: string;
  selectAllTrigger: number;
}) {
  const [activeSubTab, setActiveSubTab] = useState(SUB_TABS[0].id);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full gap-3">
        {/* ── Sub-Tab Navigation ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
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
        </div>

        {/* ── Active Sub-Tab Content ── */}
        <div className="flex-1 min-h-0">
          {SUB_TABS.map((tab) =>
            activeSubTab === tab.id ? (
              <MessagingSubTab
                key={tab.id}
                tab={tab}
                weeks={weeks}
                selectedWeek={selectedWeek}
                setSelectedWeek={setSelectedWeek}
                searchQuery={searchQuery}
                selectAllTrigger={selectAllTrigger}
              />
            ) : null
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
