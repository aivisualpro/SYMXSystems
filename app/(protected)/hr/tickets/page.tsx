"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useHrTickets, useUpsertTicket, useDeleteTicket } from "@/lib/query/hooks/useHr";
import {
  Search,
  Ticket,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Mail,
  MessageSquare,
  Calendar,
  Shield,
  Filter,
  ChevronDown,
  ExternalLink,
  Plus,
  Trash2,
  Pencil,
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { notify } from "@/lib/notify";
import Papa from "papaparse";
import QRCode from "qrcode";

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

type StatusFilter = "all" | "pending" | "approved" | "denied";

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: any; color: string; activeColor: string }[] = [
  { key: "pending", label: "Pending", icon: Clock, color: "text-blue-500", activeColor: "bg-blue-500 text-white shadow-blue-500/25" },
  { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-500", activeColor: "bg-emerald-500 text-white shadow-emerald-500/25" },
  { key: "denied", label: "Denied", icon: XCircle, color: "text-red-500", activeColor: "bg-red-500 text-white shadow-red-500/25" },
  { key: "all", label: "All", icon: Filter, color: "text-muted-foreground", activeColor: "bg-primary text-primary-foreground shadow-primary/25" },
];

const CATEGORIES = [
  "Payroll Issue", "Schedule Change", "Benefits Question", "Leave Request",
  "Equipment Issue", "Safety Concern", "Workplace Complaint", "Policy Question",
  "Training Request", "Other",
];

function getTicketStatus(ticket: HrTicket): string {
  const val = (ticket.approveDeny || "").toLowerCase().trim();
  if (val.includes("approv")) return "approved";
  if (val.includes("den")) return "denied";
  return "pending";
}

function getStatusConfig(status: string) {
  switch (status) {
    case "approved":
      return { label: "Approved", color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", icon: CheckCircle2 };
    case "denied":
      return { label: "Denied", color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/20", icon: XCircle };
    default:
      return { label: "Pending", color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/20", icon: Clock };
  }
}

const CHUNK_SIZE = 500;

/* ═══════════════════════════════════════════════════════════════════════════
 *  EMPLOYEE PICKER
 *  Lets whoever is reviewing a ticket manually match it to a real
 *  SymxEmployee record — deliberately manual (not auto-matched from
 *  anything the driver typed on the public form) since that's unverified
 *  input and a wrong auto-match would silently misattribute a ticket.
 * ═══════════════════════════════════════════════════════════════════════════ */

function EmployeePicker({
  linked,
  onSelect,
  onClear,
  trigger,
}: {
  linked: boolean;
  onSelect: (emp: EmployeeSearchResult) => void;
  onClear?: () => void;
  trigger: React.ReactNode;
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
      <PopoverContent className="w-72 p-2" align="end" onClick={(e) => e.stopPropagation()}>
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
        {/* Header */}
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

        {/* QR Code */}
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

        {/* URL + copy */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-2">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{shareUrl}</span>
            <button
              onClick={handleCopy}
              className={cn(
                "shrink-0 h-8 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "SYMX HR Ticket Form", url: shareUrl });
              } else {
                handleCopy();
              }
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
        {/* Header */}
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
              {/* Add email */}
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

              {/* Email chips */}
              {emails.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">
                  No notification emails set — HR won&apos;t be emailed when a ticket comes in.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-1.5 bg-muted/50 border border-border/50 rounded-lg pl-3 pr-1.5 py-1.5"
                    >
                      <span className="text-xs font-medium text-foreground">{email}</span>
                      <button
                        onClick={() => removeEmail(email)}
                        className="h-5 w-5 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors"
                      >
                        <X className="h-3 w-3 text-red-500/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Actions */}
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
 *  CRUD DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function TicketDialog({
  open,
  onClose,
  ticket,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  ticket: HrTicket | null; // null = create
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(ticket?.category || "");
  const [issue, setIssue] = useState(ticket?.issue || "");
  const [notes, setNotes] = useState(ticket?.notes || "");
  const [resolution, setResolution] = useState(ticket?.resolution || "");
  const [holdReason, setHoldReason] = useState(ticket?.holdReason || "");
  const [managersEmail, setManagersEmail] = useState(ticket?.managersEmail || "");
  const [employeeId, setEmployeeId] = useState(ticket?.employeeId || "");
  const [employeeName, setEmployeeName] = useState(ticket?.employeeName || "");
  const [profileImage, setProfileImage] = useState(ticket?.profileImage || "");
  const [transporterId, setTransporterId] = useState(ticket?.transporterId || "");
  const upsert = useUpsertTicket();
  const saving = upsert.isPending;

  useEffect(() => {
    if (open) {
      setCategory(ticket?.category || "");
      setIssue(ticket?.issue || "");
      setNotes(ticket?.notes || "");
      setResolution(ticket?.resolution || "");
      setHoldReason(ticket?.holdReason || "");
      setManagersEmail(ticket?.managersEmail || "");
      setEmployeeId(ticket?.employeeId || "");
      setEmployeeName(ticket?.employeeName || "");
      setProfileImage(ticket?.profileImage || "");
      setTransporterId(ticket?.transporterId || "");
    }
  }, [open, ticket]);

  const handleSelectEmployee = (emp: EmployeeSearchResult) => {
    setEmployeeId(emp._id);
    setEmployeeName(`${emp.firstName || ""} ${emp.lastName || ""}`.trim());
    setProfileImage(emp.profileImage || "");
    setTransporterId(emp.transporterId || "");
  };

  const handleClearEmployee = () => {
    setEmployeeId("");
    setEmployeeName("");
    setProfileImage("");
    setTransporterId("");
  };

  const handleSave = () => {
    if (!category && !issue) return;
    // Whatever the picker ends up holding when Save is clicked reflects a
    // human decision (whether that's picking fresh or accepting the
    // suggestion via "Use this"), so it always counts as a manual link and
    // clears any leftover suggestion.
    const body = {
      category, issue, notes, resolution, holdReason, managersEmail,
      employeeId: employeeId || null,
      transporterId: transporterId || "",
      employeeMatchType: employeeId ? "manual" : null,
      suggestedEmployeeId: null,
    };
    upsert.mutate({ id: ticket?._id, data: body });
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 sticky top-0 bg-card z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shadow-lg",
                ticket
                  ? "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20"
                  : "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20"
              )}>
                {ticket ? <Pencil className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{ticket ? "Edit Ticket" : "New Ticket"}</h2>
                {ticket?.ticketNumber && (
                  <p className="text-xs text-muted-foreground">#{ticket.ticketNumber}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Submitted By (read-only context, public tickets only) */}
          {(ticket?.submitterName || ticket?.submitterEmail) && (
            <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 mb-1 flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Submitted via public form
              </p>
              <p className="text-sm font-semibold text-foreground">{ticket?.submitterName || "Unknown"}</p>
              {ticket?.submitterEmail && (
                <p className="text-xs text-muted-foreground">{ticket.submitterEmail}</p>
              )}
            </div>
          )}

          {/* Linked Employee */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Linked Employee <span className="text-muted-foreground/60 normal-case font-normal">(who this ticket is about)</span>
            </label>
            <EmployeePicker
              linked={!!employeeId}
              onSelect={handleSelectEmployee}
              onClear={handleClearEmployee}
              trigger={
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-2.5 text-left hover:border-primary/40 transition-colors"
                >
                  {employeeId ? (
                    <>
                      {profileImage ? (
                        <img src={profileImage} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{employeeName}</p>
                        {transporterId && <p className="text-[10px] text-muted-foreground truncate">{transporterId}</p>}
                      </div>
                      <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <UserPlus className="h-4 w-4 text-purple-500" />
                      </div>
                      <span className="text-sm text-muted-foreground flex-1">Search &amp; link an employee</span>
                    </>
                  )}
                </button>
              }
            />
            {!employeeId && ticket?.suggestedEmployeeName && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                <UserPlus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">
                  Suggested match: <span className="font-semibold text-foreground">{ticket.suggestedEmployeeName}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeId(ticket.suggestedEmployeeId || "");
                    setEmployeeName(ticket.suggestedEmployeeName || "");
                    setProfileImage(ticket.suggestedProfileImage || "");
                    setTransporterId(ticket.suggestedTransporterId || "");
                  }}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Use this
                </button>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    category === c
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Issue */}
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

          {/* Manager Email */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Manager&apos;s Email</label>
            <Input
              value={managersEmail}
              onChange={(e) => setManagersEmail(e.target.value)}
              placeholder="manager@symxlogistics.com"
              type="email"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none transition-all"
            />
          </div>

          {/* Resolution (edit only) */}
          {ticket && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Resolution</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="How was this resolved?"
                rows={2}
                className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none transition-all"
              />
            </div>
          )}

          {/* Hold Reason (edit only) */}
          {ticket && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Hold Reason</label>
              <Input
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="On hold because..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || (!category && !issue)}
              className="flex-1 gap-2 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {ticket ? "Update" : "Create"} Ticket
            </Button>
            <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HRTicketsPage() {
  const { data: queryTickets } = useHrTickets();
  const upsertTicket = useUpsertTicket();
  const deleteTicket = useDeleteTicket();
  const [tickets, setTickets] = useState<HrTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [importing, setImporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  // Dialog states
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<HrTicket | null>(null);

  // ── Mount search + actions in header ──
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
          onClick={() => setShowShare(true)}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          onClick={() => setShowSettings(true)}
          title="Notification email settings"
        >
          <Bell className="h-3.5 w-3.5" />
          Notify
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
          onClick={() => { setEditingTicket(null); setShowTicketDialog(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          New
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

  // ── Seed from TanStack Query cache ──
  useEffect(() => {
    if (Array.isArray(queryTickets) && queryTickets.length > 0 && tickets.length === 0) {
      setTickets(queryTickets);
    }
  }, [queryTickets]);

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

  // ── Approve / Deny ──
  const handleStatusUpdate = useCallback((ticketId: string, newStatus: "Approve" | "Deny") => {
    setUpdatingId(ticketId);
    setTickets((prev) =>
      prev.map((t) => (t._id === ticketId ? { ...t, approveDeny: newStatus } : t))
    );
    upsertTicket.mutate(
      { id: ticketId, data: { approveDeny: newStatus } },
      { onSettled: () => setUpdatingId(null) },
    );
  }, [upsertTicket]);

  // ── Link / unlink employee ──
  // Once a human picks (or confirms a suggested) employee, the link is
  // marked "manual" — clears any leftover "auto" badge from an earlier
  // exact-match and always clears the suggestion, confirmed or not.
  const handleLinkEmployee = useCallback((ticketId: string, emp: EmployeeLink | null) => {
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticketId
          ? {
              ...t,
              employeeId: emp?._id || undefined,
              employeeName: emp ? emp.employeeName : (t.submitterName || ""),
              profileImage: emp?.profileImage || "",
              transporterId: emp?.transporterId || "",
              employeeMatchType: emp ? "manual" : undefined,
              suggestedEmployeeId: undefined,
              suggestedEmployeeName: "",
              suggestedProfileImage: "",
              suggestedTransporterId: "",
            }
          : t
      )
    );
    upsertTicket.mutate({
      id: ticketId,
      data: {
        employeeId: emp?._id || null,
        transporterId: emp?.transporterId || "",
        employeeMatchType: emp ? "manual" : null,
        suggestedEmployeeId: null,
      },
    });
    notify.success(emp ? `Linked to ${emp.employeeName}` : "Employee unlinked");
  }, [upsertTicket]);

  // ── Confirm a suggested match with one click ──
  const handleConfirmSuggestion = useCallback((t: HrTicket) => {
    if (!t.suggestedEmployeeId || !t.suggestedEmployeeName) return;
    handleLinkEmployee(t._id, {
      _id: t.suggestedEmployeeId,
      employeeName: t.suggestedEmployeeName,
      profileImage: t.suggestedProfileImage,
      transporterId: t.suggestedTransporterId,
    });
  }, [handleLinkEmployee]);

  // ── Dismiss a suggested match without linking it ──
  const handleDismissSuggestion = useCallback((ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticketId
          ? { ...t, suggestedEmployeeId: undefined, suggestedEmployeeName: "", suggestedProfileImage: "", suggestedTransporterId: "" }
          : t
      )
    );
    upsertTicket.mutate({ id: ticketId, data: { suggestedEmployeeId: null } });
  }, [upsertTicket]);

  // ── Delete ──
  const handleDelete = useCallback((ticketId: string) => {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    setDeletingId(ticketId);
    setTickets((prev) => prev.filter((t) => t._id !== ticketId));
    deleteTicket.mutate(
      { id: ticketId },
      { onSettled: () => setDeletingId(null) },
    );
  }, [deleteTicket]);

  // ── KPIs ──
  const kpi = useMemo(() => {
    const total = tickets.length;
    const approved = tickets.filter((t) => getTicketStatus(t) === "approved").length;
    const denied = tickets.filter((t) => getTicketStatus(t) === "denied").length;
    const pending = tickets.filter((t) => getTicketStatus(t) === "pending").length;
    return { total, approved, denied, pending };
  }, [tickets]);

  const kpiForFilter = (key: StatusFilter) => {
    switch (key) {
      case "pending": return kpi.pending;
      case "approved": return kpi.approved;
      case "denied": return kpi.denied;
      default: return kpi.total;
    }
  };

  // ── Filter + Search ──
  const filteredTickets = useMemo(() => {
    let result = tickets;

    if (statusFilter !== "all") {
      result = result.filter((t) => getTicketStatus(t) === statusFilter);
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

    return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [tickets, statusFilter, search]);

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Hidden file input */}
      <input ref={fileRef} type="file" className="hidden" accept=".csv" onChange={handleImport} />

      {/* Import overlay */}
      {importing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-card p-8 rounded-2xl border border-border/50 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm font-medium text-muted-foreground">Importing tickets...</p>
          </div>
        </div>
      )}

      {/* Share Dialog */}
      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />

      {/* Notification Settings Dialog */}
      <NotificationSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      {/* CRUD Dialog */}
      <TicketDialog
        open={showTicketDialog}
        onClose={() => { setShowTicketDialog(false); setEditingTicket(null); }}
        ticket={editingTicket}
        onSaved={fetchTickets}
      />

      {/* ═══ STATUS FILTER PILLS ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          const count = kpiForFilter(f.key);
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                isActive
                  ? `${f.activeColor} shadow-lg scale-[1.02]`
                  : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50 hover:border-border"
              )}
            >
              <f.icon className={cn("h-3.5 w-3.5", isActive ? "" : f.color)} />
              {f.label}
              <span className={cn(
                "ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black",
                isActive ? "bg-white/20" : "bg-muted"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ TICKET CARDS GRID ═══ */}
      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 flex items-center justify-center">
            <Ticket className="h-8 w-8 text-purple-500/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">
            {statusFilter === "all" ? "No tickets found" : `No ${statusFilter} tickets`}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-4">
            {tickets.length === 0 ? "Create a ticket or share the form to get started" : "Try changing the filter or search term"}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
              onClick={() => { setEditingTicket(null); setShowTicketDialog(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Ticket
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowShare(true)}>
              <Share2 className="h-3.5 w-3.5" />
              Share Form
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((t) => {
            const status = getTicketStatus(t);
            const config = getStatusConfig(status);
            const isPending = status === "pending";
            const isUpdating = updatingId === t._id;
            const isDeleting = deletingId === t._id;
            const isExpanded = expandedId === t._id;
            const date = t.createdAt
              ? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : null;

            return (
              <div
                key={t._id}
                className={cn(
                  "group rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5",
                  isPending ? "border-blue-500/20 hover:border-blue-500/40" : "border-border/50 hover:border-border"
                )}
              >
                {/* Accent bar */}
                <div className={cn("h-1 w-full", {
                  "bg-gradient-to-r from-blue-500 to-cyan-500": status === "pending",
                  "bg-gradient-to-r from-emerald-500 to-green-500": status === "approved",
                  "bg-gradient-to-r from-red-500 to-rose-500": status === "denied",
                })} />

                {/* Card Header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Employee + Ticket # */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {t.profileImage ? (
                        <img src={t.profileImage} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-border/30 shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center ring-2 ring-border/20 shrink-0">
                          <User className="h-5 w-5 text-muted-foreground/60" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {t.employeeName || t.submitterName || t.transporterId || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {t.ticketNumber && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              #{t.ticketNumber}
                            </span>
                          )}
                          {t.category && (
                            <span className="text-[10px] font-medium text-muted-foreground truncate">{t.category}</span>
                          )}
                          {t.source === "public" && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded"
                              title="Submitted via the public HR ticket form"
                            >
                              <Globe className="h-2.5 w-2.5" /> Public
                            </span>
                          )}
                          {t.employeeId && t.employeeMatchType === "auto" && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded"
                              title="Automatically matched — the submitter's name/email was an exact match against one employee record"
                            >
                              <Check className="h-2.5 w-2.5" /> Auto-matched
                            </span>
                          )}
                          {!t.employeeId && t.suggestedEmployeeName && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 pl-1.5 pr-1 py-0.5 rounded">
                              <UserPlus className="h-2.5 w-2.5" />
                              Suggested: {t.suggestedEmployeeName}
                              <button
                                onClick={() => handleConfirmSuggestion(t)}
                                title="Confirm this match"
                                className="ml-0.5 h-3.5 w-3.5 rounded-sm flex items-center justify-center hover:bg-emerald-500/20 text-emerald-600"
                              >
                                <Check className="h-2.5 w-2.5" />
                              </button>
                              <button
                                onClick={() => handleDismissSuggestion(t._id)}
                                title="Dismiss suggestion"
                                className="h-3.5 w-3.5 rounded-sm flex items-center justify-center hover:bg-red-500/20 text-red-600"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          )}
                          {t.source === "public" && !t.employeeId && !t.suggestedEmployeeName && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded"
                              title="Not yet matched to an employee record — use the link icon to match"
                            >
                              <UserPlus className="h-2.5 w-2.5" /> Unlinked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge + Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ring-1", config.bg, config.color, config.ring)}>
                        <config.icon className="h-3 w-3" />
                        {config.label}
                      </div>
                      {/* Link Employee + Edit + Delete */}
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <EmployeePicker
                          linked={!!t.employeeId}
                          onSelect={(emp) => handleLinkEmployee(t._id, {
                            _id: emp._id,
                            employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
                            profileImage: emp.profileImage,
                            transporterId: emp.transporterId,
                          })}
                          onClear={() => handleLinkEmployee(t._id, null)}
                          trigger={
                            <button
                              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors"
                              title={t.employeeId ? "Change linked employee" : "Link to employee"}
                            >
                              {t.employeeId ? (
                                <UserCog className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <UserPlus className="h-3 w-3 text-purple-500" />
                              )}
                            </button>
                          }
                        />
                        <button
                          onClick={() => { setEditingTicket(t); setShowTicketDialog(true); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(t._id)}
                          disabled={isDeleting}
                          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-red-500/70" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issue */}
                {t.issue && (
                  <div className="px-4 pb-3">
                    <p className={cn(
                      "text-xs text-muted-foreground leading-relaxed",
                      isExpanded ? "" : "line-clamp-2"
                    )}>
                      {t.issue}
                    </p>
                    {t.issue.length > 120 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : t._id)}
                        className="text-[10px] font-bold text-primary mt-1 hover:underline"
                      >
                        {isExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                )}

                {/* Meta row */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {date && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Calendar className="h-3 w-3" /> {date}
                    </div>
                  )}
                  {(t.submitterEmail || t.managersEmail) && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 truncate max-w-[160px]">
                      <Mail className="h-3 w-3" /> {t.submitterEmail || t.managersEmail}
                    </div>
                  )}
                  {t.attachment && (
                    <a
                      href={t.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Paperclip className="h-3 w-3" /> Attachment
                    </a>
                  )}
                </div>

                {/* Notes / Resolution / Hold Reason */}
                {(t.notes || t.resolution || t.holdReason) && (
                  <div className="px-4 pb-3 space-y-1.5">
                    {t.notes && (
                      <div className="flex items-start gap-1.5">
                        <MessageSquare className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{t.notes}</p>
                      </div>
                    )}
                    {t.resolution && (
                      <div className="flex items-start gap-1.5">
                        <Shield className="h-3 w-3 text-emerald-500/50 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 line-clamp-2">{t.resolution}</p>
                      </div>
                    )}
                    {t.holdReason && (
                      <div className="flex items-start gap-1.5">
                        <Clock className="h-3 w-3 text-amber-500/50 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 line-clamp-2">{t.holdReason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Closed info */}
                {(t.closedByName || t.closedBy) && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] text-muted-foreground/60">
                      Closed by <span className="font-bold text-muted-foreground">{t.closedByName || t.closedBy}</span>
                      {t.closedDateTime && (
                        <> on {new Date(t.closedDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                      )}
                    </p>
                  </div>
                )}

                {/* ── Action Footer ── */}
                {isPending && (
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                      onClick={() => handleStatusUpdate(t._id, "Approve")}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs font-bold gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => handleStatusUpdate(t._id, "Deny")}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                      Deny
                    </Button>
                  </div>
                )}

                {/* Already resolved footer */}
                {!isPending && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 py-2 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/50 font-medium">
                      {status === "approved" ? "✓ This ticket was approved" : "✗ This ticket was denied"}
                    </p>
                    <button
                      onClick={() => handleStatusUpdate(t._id, status === "approved" ? "Deny" : "Approve")}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground font-medium transition-colors"
                    >
                      Change to {status === "approved" ? "Deny" : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
