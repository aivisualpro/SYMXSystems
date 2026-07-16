"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useHrTickets } from "@/lib/query/hooks/useHr";
import {
  Search,
  Ticket,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Mail,
  Filter,
  ExternalLink,
  Plus,
  Trash2,
  X,
  Copy,
  QrCode,
  Share2,
  Link2,
  Check,
  Globe,
  Bell,
  UserPlus,
  UserCog,
  Inbox,
  PauseCircle,
  Archive,
  ArrowLeft,
  UserCircle,
  History,
  Sparkles,
  Info,
  Flag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { notify } from "@/lib/notify";
import Papa from "papaparse";
import QRCode from "qrcode";

/* ═══════════════════════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════════════════════ */

type HrTicketStatus = "open" | "on_hold" | "approved" | "denied" | "closed";
type HrTicketPriority = "low" | "normal" | "high";

interface ActivityEntry {
  type: "note" | "status_change" | "system" | "created";
  text: string;
  byName?: string;
  byEmail?: string;
  createdAt: string;
}

interface HrTicket {
  _id: string;
  ticketNumber?: string;
  transporterId?: string;
  employeeId?: string;
  category?: string;
  issue?: string;
  attachment?: string;
  managersEmail?: string;
  notes?: string;
  approveDeny?: string;
  resolution?: string;
  holdReason?: string;
  closedDateTime?: string;
  closedBy?: string;
  closedTicketSent?: string;
  createdAt?: string;
  createdBy?: string;
  employeeName?: string;
  profileImage?: string;
  closedByName?: string;
  source?: "public" | "admin" | "import";
  submitterName?: string;
  submitterEmail?: string;
  employeeMatchType?: "auto" | "manual";
  suggestedEmployeeId?: string;
  suggestedEmployeeName?: string;
  suggestedProfileImage?: string;
  suggestedTransporterId?: string;
  status?: HrTicketStatus;
  priority?: HrTicketPriority;
  assignedTo?: string;
  assignedToName?: string;
  activity?: ActivityEntry[];
}

interface EmployeeLink {
  _id: string;
  employeeName: string;
  profileImage?: string;
  transporterId?: string;
}

interface EmployeeSearchResult {
  _id: string;
  firstName?: string;
  lastName?: string;
  transporterId?: string;
  eeCode?: string;
  profileImage?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  "Payroll Issue", "Schedule Change", "Benefits Question", "Leave Request",
  "Equipment Issue", "Safety Concern", "Workplace Complaint", "Policy Question",
  "Training Request", "Other",
];

type StatusFilterKey = HrTicketStatus | "all";

const STATUS_TABS: { key: StatusFilterKey; label: string; icon: any }[] = [
  { key: "open", label: "Open", icon: Inbox },
  { key: "on_hold", label: "On Hold", icon: PauseCircle },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "denied", label: "Denied", icon: XCircle },
  { key: "closed", label: "Closed", icon: Archive },
  { key: "all", label: "All", icon: Filter },
];

const STATUS_CONFIG: Record<HrTicketStatus, { label: string; color: string; bg: string; ring: string; icon: any }> = {
  open: { label: "Open", color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/20", icon: Inbox },
  on_hold: { label: "On Hold", color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/20", icon: PauseCircle },
  approved: { label: "Approved", color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", icon: CheckCircle2 },
  denied: { label: "Denied", color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/20", icon: XCircle },
  closed: { label: "Closed", color: "text-zinc-500", bg: "bg-zinc-500/10", ring: "ring-zinc-500/20", icon: Archive },
};

const PRIORITY_ACTIVE: Record<HrTicketPriority, string> = {
  low: "bg-zinc-500 text-white",
  normal: "bg-blue-500 text-white",
  high: "bg-red-500 text-white",
};

const CHUNK_SIZE = 500;

/* ═══════════════════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

// Legacy tickets (imports, or ones created before the status field existed)
// only have approveDeny — fall back to deriving a status from that string so
// they still sort into the right queue tab instead of vanishing.
function getEffectiveStatus(t: HrTicket): HrTicketStatus {
  if (t.status) return t.status;
  const val = (t.approveDeny || "").toLowerCase().trim();
  if (val.includes("approv")) return "approved";
  if (val.includes("den")) return "denied";
  return "open";
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  EMPLOYEE PICKER
 *  Lets whoever is reviewing a ticket manually match it to a real
 *  SymxEmployee record — deliberately manual (not auto-matched from
 *  anything the driver typed on the public form) since that's unverified
 *  input and a wrong auto-match would silently misattribute a ticket. An
 *  unambiguous exact name/email match is auto-linked at submission time
 *  instead (see matchEmployeeForTicket) — this picker is for everything
 *  else: manual matches, changes, and confirming ambiguous suggestions.
 * ═══════════════════════════════════════════════════════════════════════════ */

function EmployeePicker({
  linked,
  onSelect,
  onClear,
  trigger,
  align = "start",
}: {
  linked: boolean;
  onSelect: (emp: EmployeeSearchResult) => void;
  onClear?: () => void;
  trigger: React.ReactNode;
  align?: "start" | "end" | "center";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams({
        limit: "8",
        select: "firstName,lastName,transporterId,eeCode,profileImage",
      });
      if (query.trim()) params.set("search", query.trim());
      fetch(`/api/admin/employees?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setResults(Array.isArray(data) ? data : data.records || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-2" align={align} onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">
          Match to Employee
        </p>
        <Input
          autoFocus
          placeholder="Search name, EE code, transporter ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {searching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
          ) : (
            results.map((e) => (
              <button
                key={e._id}
                onClick={() => {
                  onSelect(e);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 text-left transition-colors"
              >
                {e.profileImage ? (
                  <img src={e.profileImage} className="h-6 w-6 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{e.firstName} {e.lastName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{e.transporterId || e.eeCode || ""}</p>
                </div>
              </button>
            ))
          )}
        </div>
        {linked && onClear && (
          <button
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="w-full text-[11px] font-medium text-red-500 hover:text-red-600 text-center mt-2 pt-2 border-t border-border/40"
          >
            Unlink employee
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ASSIGN PICKER
 *  Lightweight assignment — free-form email rather than a full user
 *  directory lookup, since the directory endpoint (/api/admin/users)
 *  requires Admin-module access and would 403 for HR-only staff. Suggests
 *  the configured notification emails as a quick-pick roster.
 * ═══════════════════════════════════════════════════════════════════════════ */

function AssignPicker({
  assignedTo,
  assignedToName,
  currentUser,
  onAssign,
}: {
  assignedTo?: string;
  assignedToName?: string;
  currentUser: { name: string; email: string } | null;
  onAssign: (assignee: { name: string; email: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/hr-tickets/settings")
      .then((res) => res.json())
      .then((d) => setSuggestions(Array.isArray(d.notificationEmails) ? d.notificationEmails : []))
      .catch(() => {});
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <UserCircle className="h-3.5 w-3.5" />
          {assignedToName || "Unassigned"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">Assign To</p>
        {currentUser && (
          <button
            onClick={() => { onAssign({ name: currentUser.name, email: currentUser.email }); setOpen(false); }}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/60 text-xs font-semibold flex items-center gap-2"
          >
            <UserCircle className="h-3.5 w-3.5 text-primary" /> Assign to me
          </button>
        )}
        {suggestions.filter((e) => e !== currentUser?.email).map((email) => (
          <button
            key={email}
            onClick={() => { onAssign({ name: email, email }); setOpen(false); }}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/60 text-xs truncate text-muted-foreground"
          >
            {email}
          </button>
        ))}
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/40">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="name@symxlogistics.com"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                onAssign({ name: text.trim(), email: text.trim() });
                setText("");
                setOpen(false);
              }
            }}
          />
        </div>
        {assignedTo && (
          <button
            onClick={() => { onAssign(null); setOpen(false); }}
            className="w-full text-[11px] font-medium text-red-500 hover:text-red-600 text-center mt-2 pt-2 border-t border-border/40"
          >
            Unassign
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ACTION POPOVER
 *  Shared confirm-with-optional-note control for the lifecycle actions
 *  (Approve / Deny / Hold / Close) — keeps the interaction model consistent
 *  across all of them instead of each having its own bespoke prompt.
 * ═══════════════════════════════════════════════════════════════════════════ */

const ACTION_COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500 hover:bg-emerald-600 text-white",
  red: "bg-red-500 hover:bg-red-600 text-white",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
  zinc: "bg-zinc-700 hover:bg-zinc-800 text-white",
  blue: "bg-blue-500 hover:bg-blue-600 text-white",
};

function ActionPopover({
  label,
  icon: Icon,
  color,
  placeholder,
  requireText,
  onConfirm,
  busy,
}: {
  label: string;
  icon: any;
  color: keyof typeof ACTION_COLOR_CLASSES;
  placeholder: string;
  requireText?: boolean;
  onConfirm: (note: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={busy} className={cn("h-8 text-xs gap-1.5", ACTION_COLOR_CLASSES[color])}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-bold mb-2">{label}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            disabled={requireText && !text.trim()}
            onClick={() => { onConfirm(text.trim()); setText(""); setOpen(false); }}
            className={cn("flex-1 h-7 text-xs", ACTION_COLOR_CLASSES[color])}
          >
            Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SHARE DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/submit-ticket` : "";

  useEffect(() => {
    if (!open || !shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => {});
  }, [open, shareUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    notify.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Share Ticket Form</h2>
                <p className="text-xs text-muted-foreground">Anyone with this link can submit tickets</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 flex justify-center">
          <div className="bg-white rounded-2xl p-4 shadow-lg shadow-black/5">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mb-4">
          Scan QR code or share the link below
        </p>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-2">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{shareUrl}</span>
            <button
              onClick={handleCopy}
              className={cn(
                "shrink-0 h-8 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                copied ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              if (navigator.share) navigator.share({ title: "SYMX HR Ticket Form", url: shareUrl });
              else handleCopy();
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Share
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              const link = document.createElement("a");
              link.href = qrDataUrl;
              link.download = "SYMX_HR_Ticket_QR.png";
              link.click();
            }}
            disabled={!qrDataUrl}
          >
            <QrCode className="h-4 w-4" />
            Download QR
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION SETTINGS DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function NotificationSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/hr-tickets/settings")
      .then((res) => res.json())
      .then((data) => setEmails(Array.isArray(data.notificationEmails) ? data.notificationEmails : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const addEmail = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    const validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!validFormat) {
      notify.error("Enter a valid email address");
      return;
    }
    if (emails.includes(value)) {
      setDraft("");
      return;
    }
    setEmails((prev) => [...prev, value]);
    setDraft("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/hr-tickets/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmails: emails }),
      });
      if (!res.ok) throw new Error("Failed to save");
      notify.success("Notification settings saved");
      onClose();
    } catch {
      notify.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Notification Emails</h2>
                <p className="text-xs text-muted-foreground">Who gets emailed on new public tickets</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder="hr@symxlogistics.com"
                  type="email"
                />
                <Button variant="outline" size="icon" onClick={addEmail} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {emails.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">
                  No notification emails set — HR won&apos;t be emailed when a ticket comes in.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <div key={email} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 rounded-lg pl-3 pr-1.5 py-1.5">
                      <span className="text-xs font-medium text-foreground">{email}</span>
                      <button onClick={() => removeEmail(email)} className="h-5 w-5 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors">
                        <X className="h-3 w-3 text-red-500/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 gap-2 h-10 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  NEW TICKET DIALOG
 *  Create-only now — editing an existing ticket happens entirely inline in
 *  the detail panel (category/priority pills, issue edit-in-place, notes
 *  via the activity composer, status via the action toolbar) rather than
 *  through a separate modal, so there's one obvious place to do everything.
 * ═══════════════════════════════════════════════════════════════════════════ */

function NewTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ticket: HrTicket) => void;
}) {
  const [category, setCategory] = useState("");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState<HrTicketPriority>("normal");
  const [managersEmail, setManagersEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(""); setIssue(""); setPriority("normal"); setManagersEmail("");
      setEmployeeId(""); setEmployeeName(""); setProfileImage(""); setTransporterId("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!category && !issue) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/hr-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, issue, priority, managersEmail,
          employeeId: employeeId || undefined,
          transporterId: transporterId || undefined,
          employeeMatchType: employeeId ? "manual" : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const ticket = await res.json();
      notify.success("Ticket created");
      onCreated({ ...ticket, employeeName, profileImage });
      onClose();
    } catch {
      notify.error("Failed to create ticket");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto">
        <div className="relative px-6 pt-6 pb-4 sticky top-0 bg-card z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-foreground">New Ticket</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Employee <span className="text-muted-foreground/60 normal-case font-normal">(who this ticket is about)</span>
            </label>
            <EmployeePicker
              linked={!!employeeId}
              onSelect={(emp) => {
                setEmployeeId(emp._id);
                setEmployeeName(`${emp.firstName || ""} ${emp.lastName || ""}`.trim());
                setProfileImage(emp.profileImage || "");
                setTransporterId(emp.transporterId || "");
              }}
              onClear={() => { setEmployeeId(""); setEmployeeName(""); setProfileImage(""); setTransporterId(""); }}
              trigger={
                <button type="button" className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-2.5 text-left hover:border-primary/40 transition-colors">
                  {employeeId ? (
                    <>
                      {profileImage ? (
                        <img src={profileImage} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <span className="text-sm font-semibold truncate flex-1">{employeeName}</span>
                      <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-purple-500" /></div>
                      <span className="text-sm text-muted-foreground flex-1">Search &amp; link an employee</span>
                    </>
                  )}
                </button>
              }
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    category === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Priority</label>
            <div className="flex gap-1.5">
              {(["low", "normal", "high"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                    priority === p ? PRIORITY_ACTIVE[p] : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Issue</label>
            <textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Manager&apos;s Email</label>
            <Input value={managersEmail} onChange={(e) => setManagersEmail(e.target.value)} placeholder="manager@symxlogistics.com" type="email" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || (!category && !issue)}
              className="flex-1 gap-2 h-10 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create Ticket
            </Button>
            <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ACTIVITY TIMELINE ROW
 * ═══════════════════════════════════════════════════════════════════════════ */

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const time = formatDateTime(entry.createdAt);

  if (entry.type === "note") {
    return (
      <div className="flex gap-2.5">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
          {(entry.byName || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 bg-muted/40 rounded-xl rounded-tl-sm px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold">{entry.byName || "Unknown"}</p>
            <p className="text-[10px] text-muted-foreground/60">{time}</p>
          </div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{entry.text}</p>
        </div>
      </div>
    );
  }

  const Icon = entry.type === "status_change" ? History : entry.type === "created" ? Sparkles : Info;
  return (
    <div className="flex items-center gap-2 pl-1">
      <Icon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium">{entry.text}</span>
        {entry.byName && <span className="text-muted-foreground/60"> · by {entry.byName}</span>}
        <span className="text-muted-foreground/40"> · {time}</span>
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TICKET DETAIL (right pane)
 * ═══════════════════════════════════════════════════════════════════════════ */

function TicketDetail({
  ticket,
  currentUser,
  busy,
  onBack,
  onStatusChange,
  onAddNote,
  onAssign,
  onLinkEmployee,
  onConfirmSuggestion,
  onDismissSuggestion,
  onDelete,
  onEditMeta,
}: {
  ticket: HrTicket;
  currentUser: { name: string; email: string } | null;
  busy: boolean;
  onBack: () => void;
  onStatusChange: (status: HrTicketStatus, note?: string) => void;
  onAddNote: (text: string) => void;
  onAssign: (assignee: { name: string; email: string } | null) => void;
  onLinkEmployee: (emp: EmployeeLink | null) => void;
  onConfirmSuggestion: () => void;
  onDismissSuggestion: () => void;
  onDelete: () => void;
  onEditMeta: (patch: Record<string, any>) => void;
}) {
  const status = getEffectiveStatus(ticket);
  const cfg = STATUS_CONFIG[status];
  const priority = ticket.priority || "normal";

  const [noteDraft, setNoteDraft] = useState("");
  const [editingIssue, setEditingIssue] = useState(false);
  const [issueDraft, setIssueDraft] = useState(ticket.issue || "");

  const activity = useMemo(
    () => [...(ticket.activity || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [ticket.activity]
  );

  const submitPostedNote = () => {
    if (!noteDraft.trim()) return;
    onAddNote(noteDraft.trim());
    setNoteDraft("");
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="border-b border-border/50 px-5 py-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold truncate">#{ticket.ticketNumber || "—"}</h2>
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ring-1", cfg.bg, cfg.color, cfg.ring)}>
                  <cfg.icon className="h-3 w-3" /> {cfg.label}
                </div>
                {priority === "high" && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
                    <Flag className="h-3 w-3" /> High Priority
                  </div>
                )}
                {ticket.source === "public" && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20">
                    <Globe className="h-3 w-3" /> Public
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {ticket.category || "General"} · Created {formatRelativeTime(ticket.createdAt)}
                {ticket.createdBy ? ` by ${ticket.createdBy}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-red-500/70 shrink-0" title="Delete ticket">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {(status === "open" || status === "on_hold") && (
            <>
              <ActionPopover label="Approve" icon={ThumbsUp} color="emerald" placeholder="Resolution note (optional)" onConfirm={(note) => onStatusChange("approved", note)} busy={busy} />
              <ActionPopover label="Deny" icon={ThumbsDown} color="red" placeholder="Resolution note (optional)" onConfirm={(note) => onStatusChange("denied", note)} busy={busy} />
              {status === "open" ? (
                <ActionPopover label="Put On Hold" icon={PauseCircle} color="amber" placeholder="Reason for hold..." requireText onConfirm={(note) => onStatusChange("on_hold", note)} busy={busy} />
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onStatusChange("open")}>
                  Resume
                </Button>
              )}
            </>
          )}
          {(status === "approved" || status === "denied") && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onStatusChange("open")}>
                Reopen
              </Button>
              <ActionPopover label="Close Ticket" icon={Archive} color="zinc" placeholder="Closing note (optional)" onConfirm={(note) => onStatusChange("closed", note)} busy={busy} />
            </>
          )}
          {status === "closed" && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onStatusChange("open")}>
              Reopen
            </Button>
          )}
          <AssignPicker assignedTo={ticket.assignedTo} assignedToName={ticket.assignedToName} currentUser={currentUser} onAssign={onAssign} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {(ticket.submitterName || ticket.submitterEmail) && (
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 mb-1 flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Submitted via public form
            </p>
            <p className="text-sm font-semibold text-foreground">{ticket.submitterName || "Unknown"}</p>
            {ticket.submitterEmail && <p className="text-xs text-muted-foreground">{ticket.submitterEmail}</p>}
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Linked Employee <span className="text-muted-foreground/60 normal-case font-normal">(who this ticket is about)</span>
          </label>
          <EmployeePicker
            linked={!!ticket.employeeId}
            onSelect={(emp) => onLinkEmployee({
              _id: emp._id,
              employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              profileImage: emp.profileImage,
              transporterId: emp.transporterId,
            })}
            onClear={() => onLinkEmployee(null)}
            trigger={
              <button type="button" className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-2.5 text-left hover:border-primary/40 transition-colors">
                {ticket.employeeId ? (
                  <>
                    {ticket.profileImage ? (
                      <img src={ticket.profileImage} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{ticket.employeeName}</p>
                      {ticket.transporterId && <p className="text-[10px] text-muted-foreground truncate">{ticket.transporterId}</p>}
                    </div>
                    <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                  </>
                ) : (
                  <>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-purple-500" /></div>
                    <span className="text-sm text-muted-foreground flex-1">Search &amp; link an employee</span>
                  </>
                )}
              </button>
            }
          />
          {!ticket.employeeId && ticket.suggestedEmployeeName && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <UserPlus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                Suggested match: <span className="font-semibold text-foreground">{ticket.suggestedEmployeeName}</span>
              </p>
              <button onClick={onConfirmSuggestion} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">Confirm</button>
              <button onClick={onDismissSuggestion} className="text-[11px] font-bold text-red-500 hover:text-red-600">Dismiss</button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Issue</p>
            {!editingIssue && (
              <button onClick={() => setEditingIssue(true)} className="text-[11px] font-bold text-primary hover:underline">Edit</button>
            )}
          </div>
          {editingIssue ? (
            <div className="space-y-2">
              <textarea
                value={issueDraft}
                onChange={(e) => setIssueDraft(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onEditMeta({ issue: issueDraft }); setEditingIssue(false); }}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setIssueDraft(ticket.issue || ""); setEditingIssue(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{ticket.issue || "—"}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => onEditMeta({ category: c })}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                    ticket.category === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Priority</p>
            <div className="flex gap-1.5">
              {(["low", "normal", "high"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onEditMeta({ priority: p })}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all",
                    priority === p ? PRIORITY_ACTIVE[p] : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Manager&apos;s Email</p>
          <Input
            key={ticket._id}
            defaultValue={ticket.managersEmail || ""}
            placeholder="manager@symxlogistics.com"
            onBlur={(e) => {
              if (e.target.value !== (ticket.managersEmail || "")) onEditMeta({ managersEmail: e.target.value });
            }}
          />
        </div>

        {ticket.attachment && (
          <a href={ticket.attachment} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit">
            <Paperclip className="h-3.5 w-3.5" /> View Attachment
          </a>
        )}

        {ticket.holdReason && status === "on_hold" && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Hold Reason</p>
            <p className="text-sm text-foreground/90">{ticket.holdReason}</p>
          </div>
        )}

        {ticket.resolution && (status === "approved" || status === "denied" || status === "closed") && (
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Resolution</p>
            <p className="text-sm text-foreground/90">{ticket.resolution}</p>
          </div>
        )}

        {(ticket.closedByName || ticket.closedBy) && status === "closed" && (
          <p className="text-[11px] text-muted-foreground/60">
            Closed by <span className="font-bold text-muted-foreground">{ticket.closedByName || ticket.closedBy}</span>
            {ticket.closedDateTime && <> on {new Date(ticket.closedDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
          </p>
        )}

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No activity yet</p>
            ) : (
              activity.map((a, i) => <ActivityRow key={i} entry={a} />)
            )}
          </div>
        </div>
      </div>

      {/* Note composer */}
      <div className="border-t border-border/50 px-5 py-3 shrink-0 flex items-center gap-2">
        <Input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Add a note..."
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitPostedNote(); } }}
        />
        <Button size="sm" disabled={!noteDraft.trim()} onClick={submitPostedNote}>Post</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  QUEUE ROW (left pane)
 * ═══════════════════════════════════════════════════════════════════════════ */

function TicketRow({ t, selected, onClick }: { t: HrTicket; selected: boolean; onClick: () => void }) {
  const status = getEffectiveStatus(t);
  const cfg = STATUS_CONFIG[status];
  const name = t.employeeName || t.submitterName || t.transporterId || "Unknown";
  const time = formatRelativeTime(t.createdAt);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3.5 py-3 border-b border-border/40 transition-colors flex gap-3",
        selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
      )}
    >
      {t.profileImage ? (
        <img src={t.profileImage} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/30 shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center ring-1 ring-border/20 shrink-0">
          <User className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{name}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">#{t.ticketNumber || "—"} · {t.category || "General"}</p>
        {t.issue && <p className="text-[11px] text-muted-foreground/70 line-clamp-1 mt-1">{t.issue}</p>}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ring-1", cfg.bg, cfg.color, cfg.ring)}>
            <cfg.icon className="h-2.5 w-2.5" /> {cfg.label}
          </div>
          {t.priority === "high" && <Flag className="h-3 w-3 text-red-500" />}
          {t.source === "public" && <Globe className="h-3 w-3 text-purple-500/70" />}
          {t.source === "public" && !t.employeeId && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Not yet matched to an employee" />
          )}
          {t.assignedToName && (
            <span className="text-[9px] text-muted-foreground/70 ml-auto truncate max-w-[80px]">→ {t.assignedToName}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HRTicketsPage() {
  const { data: queryTickets } = useHrTickets();
  const [tickets, setTickets] = useState<HrTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [myTicketsOnly, setMyTicketsOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  // ── Who am I (for "Assign to me" / "My Tickets") ──
  useEffect(() => {
    fetch("/api/user/me").then((res) => res.json()).then((d) => {
      if (d?.email) setCurrentUser({ name: d.name || d.email, email: d.email });
    }).catch(() => {});
  }, []);

  // ── Mount search + actions in header ──
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-500 hover:bg-purple-500/10" onClick={() => setShowShare(true)}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => setShowSettings(true)} title="Notification email settings">
          <Bell className="h-3.5 w-3.5" /> Notify
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-500 hover:bg-purple-500/10" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700" onClick={() => setShowNewTicket(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent, search]);

  // ── Fetch tickets ──
  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hr-tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : data.records || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (tickets.length === 0) setLoading(true);
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  useEffect(() => {
    if (Array.isArray(queryTickets) && queryTickets.length > 0 && tickets.length === 0) {
      setTickets(queryTickets);
    }
  }, [queryTickets]);

  // ── Generic PUT helper — every mutating action refetches the whole list
  // afterward so enrichment (employee names, assignee names, suggested
  // matches) and the activity timeline always come back fully server-
  // computed, rather than trying to predict/replicate that logic locally. ──
  const performAction = useCallback(async (id: string, body: Record<string, any>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/hr-tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      await fetchTickets();
    } catch {
      notify.error("Failed to update ticket");
    } finally {
      setBusyId(null);
    }
  }, [fetchTickets]);

  const handleStatusChange = useCallback((ticket: HrTicket, status: HrTicketStatus, note?: string) => {
    const body: Record<string, any> = { status };
    if (status === "on_hold" && note) body.holdReason = note;
    if (note) {
      body.activityNote = note;
      if (status === "approved" || status === "denied" || status === "closed") body.resolution = note;
    }
    performAction(ticket._id, body);
  }, [performAction]);

  const handleAddNote = useCallback((ticket: HrTicket, text: string) => {
    performAction(ticket._id, { activityNote: text });
  }, [performAction]);

  const handleAssign = useCallback((ticket: HrTicket, assignee: { name: string; email: string } | null) => {
    performAction(ticket._id, {
      assignedTo: assignee?.email || null,
      activityNote: assignee ? `Assigned to ${assignee.name}` : "Unassigned",
      activityType: "system",
    });
  }, [performAction]);

  const handleLinkEmployee = useCallback((ticket: HrTicket, emp: EmployeeLink | null) => {
    performAction(ticket._id, {
      employeeId: emp?._id || null,
      transporterId: emp?.transporterId || "",
      employeeMatchType: emp ? "manual" : null,
      suggestedEmployeeId: null,
      activityNote: emp ? `Linked to ${emp.employeeName}` : "Employee unlinked",
      activityType: "system",
    });
  }, [performAction]);

  const handleConfirmSuggestion = useCallback((ticket: HrTicket) => {
    if (!ticket.suggestedEmployeeId || !ticket.suggestedEmployeeName) return;
    handleLinkEmployee(ticket, {
      _id: ticket.suggestedEmployeeId,
      employeeName: ticket.suggestedEmployeeName,
      profileImage: ticket.suggestedProfileImage,
      transporterId: ticket.suggestedTransporterId,
    });
  }, [handleLinkEmployee]);

  const handleDismissSuggestion = useCallback((ticket: HrTicket) => {
    performAction(ticket._id, { suggestedEmployeeId: null });
  }, [performAction]);

  const handleEditMeta = useCallback((ticket: HrTicket, patch: Record<string, any>) => {
    performAction(ticket._id, patch);
  }, [performAction]);

  const handleDelete = useCallback((ticket: HrTicket) => {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    fetch(`/api/admin/hr-tickets/${ticket._id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error();
        setTickets((prev) => prev.filter((t) => t._id !== ticket._id));
        if (selectedId === ticket._id) setSelectedId(null);
        notify.success("Ticket deleted");
      })
      .catch(() => notify.error("Failed to delete ticket"));
  }, [selectedId]);

  // ── Import handler ──
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);

    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true, skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err),
        });
      });

      if (parsed.length === 0) { notify.error("CSV file is empty"); setImporting(false); return; }

      const chunks: any[][] = [];
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) chunks.push(parsed.slice(i, i + CHUNK_SIZE));

      let totalInserted = 0;
      for (const chunk of chunks) {
        const res = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "hr-tickets", data: chunk }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Import failed");
        totalInserted += result.inserted || 0;
      }

      notify.success(`Imported ${totalInserted} tickets`);
      await fetchTickets();
    } catch (err: any) {
      notify.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [fetchTickets]);

  // ── KPIs ──
  const kpi = useMemo(() => {
    const counts: Record<StatusFilterKey, number> = { open: 0, on_hold: 0, approved: 0, denied: 0, closed: 0, all: tickets.length };
    tickets.forEach((t) => { counts[getEffectiveStatus(t)]++; });
    return counts;
  }, [tickets]);

  // ── Filter + Search ──
  const filteredTickets = useMemo(() => {
    let result = tickets;

    if (statusFilter !== "all") {
      result = result.filter((t) => getEffectiveStatus(t) === statusFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (myTicketsOnly && currentUser) {
      result = result.filter((t) => t.assignedTo === currentUser.email);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.ticketNumber || "").toLowerCase().includes(q) ||
        (t.transporterId || "").toLowerCase().includes(q) ||
        (t.employeeName || "").toLowerCase().includes(q) ||
        (t.submitterName || "").toLowerCase().includes(q) ||
        (t.submitterEmail || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.issue || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      );
    }

    // Newest first, but bubble high-priority open/on-hold tickets to the
    // top of the queue so they don't get lost under routine ones.
    return [...result].sort((a, b) => {
      const aUrgent = a.priority === "high" && (getEffectiveStatus(a) === "open" || getEffectiveStatus(a) === "on_hold");
      const bUrgent = b.priority === "high" && (getEffectiveStatus(b) === "open" || getEffectiveStatus(b) === "on_hold");
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [tickets, statusFilter, categoryFilter, myTicketsOnly, currentUser, search]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t._id === selectedId) || null,
    [tickets, selectedId]
  );

  const usedCategories = useMemo(
    () => [...new Set(tickets.map((t) => t.category).filter(Boolean))] as string[],
    [tickets]
  );

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
          <p className="text-sm text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full animate-in fade-in duration-500">
      <input ref={fileRef} type="file" className="hidden" accept=".csv" onChange={handleImport} />

      {importing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-card p-8 rounded-2xl border border-border/50 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm font-medium text-muted-foreground">Importing tickets...</p>
          </div>
        </div>
      )}

      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />
      <NotificationSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <NewTicketDialog
        open={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        onCreated={(ticket) => { setTickets((prev) => [ticket, ...prev]); setSelectedId(ticket._id); }}
      />

      {/* ═══ FILTER BAR ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((f) => {
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50 hover:border-border"
                )}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
                <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black", isActive ? "bg-white/20" : "bg-muted")}>
                  {kpi[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 text-xs rounded-lg border border-border/50 bg-card px-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Categories</option>
            {usedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {currentUser && (
            <button
              onClick={() => setMyTicketsOnly((v) => !v)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                myTicketsOnly ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <UserCircle className="h-3.5 w-3.5" /> My Tickets
            </button>
          )}
        </div>
      </div>

      {/* ═══ WORKBENCH SPLIT PANE ═══ */}
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 flex items-center justify-center">
            <Ticket className="h-8 w-8 text-purple-500/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No tickets found</p>
          <p className="text-xs text-muted-foreground/70 mb-4">Create a ticket or share the form to get started</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white" onClick={() => setShowNewTicket(true)}>
              <Plus className="h-3.5 w-3.5" /> New Ticket
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowShare(true)}>
              <Share2 className="h-3.5 w-3.5" /> Share Form
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 rounded-2xl border border-border/50 overflow-hidden">
          {/* Queue */}
          <div className={cn("w-full md:w-[380px] shrink-0 border-r border-border/50 flex flex-col overflow-hidden", selectedId && "hidden md:flex")}>
            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-muted-foreground/70">No tickets match this view</p>
                </div>
              ) : (
                filteredTickets.map((t) => (
                  <TicketRow key={t._id} t={t} selected={t._id === selectedId} onClick={() => setSelectedId(t._id)} />
                ))
              )}
            </div>
          </div>

          {/* Detail */}
          <div className={cn("flex-1 min-w-0", !selectedId && "hidden md:flex", selectedId && "flex")}>
            {selectedTicket ? (
              <TicketDetail
                key={selectedTicket._id}
                ticket={selectedTicket}
                currentUser={currentUser}
                busy={busyId === selectedTicket._id}
                onBack={() => setSelectedId(null)}
                onStatusChange={(status, note) => handleStatusChange(selectedTicket, status, note)}
                onAddNote={(text) => handleAddNote(selectedTicket, text)}
                onAssign={(assignee) => handleAssign(selectedTicket, assignee)}
                onLinkEmployee={(emp) => handleLinkEmployee(selectedTicket, emp)}
                onConfirmSuggestion={() => handleConfirmSuggestion(selectedTicket)}
                onDismissSuggestion={() => handleDismissSuggestion(selectedTicket)}
                onDelete={() => handleDelete(selectedTicket)}
                onEditMeta={(patch) => handleEditMeta(selectedTicket, patch)}
              />
            ) : (
              <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center px-8">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 flex items-center justify-center mb-4">
                  <Ticket className="h-8 w-8 text-purple-500/30" />
                </div>
                <p className="text-sm font-bold text-muted-foreground mb-1">Select a ticket</p>
                <p className="text-xs text-muted-foreground/70">Choose a ticket from the queue to see details, add notes, and take action</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
