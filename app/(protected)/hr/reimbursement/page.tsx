"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useHrReimbursements } from "@/lib/query/hooks/useHr";
import {
  Search,
  Receipt,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
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
  Archive,
  ArrowLeft,
  UserCircle,
  History,
  Sparkles,
  Info,
  DollarSign,
  Wallet,
  Landmark,
  Undo2,
  Download,
  ImageIcon,
  FileText,
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

type ReimbursementStatus = "pending" | "approved" | "denied" | "queued_for_payroll" | "paid";

interface LineItem {
  description: string;
  category?: string;
  amount: number;
}

interface ActivityEntry {
  type: "note" | "status_change" | "payment" | "system" | "created";
  text: string;
  byName?: string;
  byEmail?: string;
  createdAt: string;
}

interface Reimbursement {
  _id: string;
  requestNumber?: string;
  transporterId?: string;
  employeeId?: string;
  employeeName?: string;
  profileImage?: string;
  suggestedEmployeeId?: string;
  suggestedEmployeeName?: string;
  suggestedProfileImage?: string;
  suggestedTransporterId?: string;
  employeeMatchType?: "auto" | "manual";
  date?: string;
  items?: LineItem[];
  category?: string;
  description?: string;
  amount?: number;
  attachment?: string;
  attachments?: string[];
  status?: ReimbursementStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  denyReason?: string;
  notes?: string;
  paymentMethod?: "direct" | "payroll";
  paidDate?: string;
  paidBy?: string;
  paymentReference?: string;
  payrollQueuedAt?: string;
  payrollQueuedBy?: string;
  payrollBatchLabel?: string;
  payrollConfirmedAt?: string;
  payrollConfirmedBy?: string;
  activity?: ActivityEntry[];
  source?: "public" | "admin" | "import";
  submitterName?: string;
  submitterEmail?: string;
  createdAt?: string;
  createdBy?: string;
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
  "Fuel", "Parking & Tolls", "Vehicle Supplies", "Uniform", "Equipment",
  "Travel & Lodging", "Meals", "Phone / Data", "Other",
];

type StatusFilterKey = ReimbursementStatus | "all";

const STATUS_TABS: { key: StatusFilterKey; label: string; icon: any }[] = [
  { key: "pending", label: "Pending", icon: Inbox },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "queued_for_payroll", label: "Queued", icon: Landmark },
  { key: "paid", label: "Paid", icon: Wallet },
  { key: "denied", label: "Denied", icon: XCircle },
  { key: "all", label: "All", icon: Filter },
];

const STATUS_CONFIG: Record<ReimbursementStatus, { label: string; color: string; bg: string; ring: string; icon: any }> = {
  pending: { label: "Pending", color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/20", icon: Inbox },
  approved: { label: "Approved", color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", icon: CheckCircle2 },
  queued_for_payroll: { label: "Queued for Payroll", color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/20", icon: Landmark },
  paid: { label: "Paid", color: "text-teal-500", bg: "bg-teal-500/10", ring: "ring-teal-500/20", icon: Wallet },
  denied: { label: "Denied", color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/20", icon: XCircle },
};

const CHUNK_SIZE = 500;

/* ═══════════════════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

function getEffectiveStatus(r: Reimbursement): ReimbursementStatus {
  return r.status || "pending";
}

function itemsTotal(items?: LineItem[]): number {
  return (items || []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
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

function formatMoney(n?: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(url) || url.includes("/image/upload/");
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  EMPLOYEE PICKER — identical pattern to the HR Tickets workbench
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
      const params = new URLSearchParams({ limit: "8", select: "firstName,lastName,transporterId,eeCode,profileImage" });
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
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">Match to Employee</p>
        <Input autoFocus placeholder="Search name, EE code, transporter ID..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs mb-2" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {searching ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
          ) : (
            results.map((e) => (
              <button
                key={e._id}
                onClick={() => { onSelect(e); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 text-left transition-colors"
              >
                {e.profileImage ? (
                  <img src={e.profileImage} className="h-6 w-6 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-3 w-3 text-muted-foreground" /></div>
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
          <button onClick={() => { onClear(); setOpen(false); }} className="w-full text-[11px] font-medium text-red-500 hover:text-red-600 text-center mt-2 pt-2 border-t border-border/40">
            Unlink employee
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ACTION POPOVERS
 * ═══════════════════════════════════════════════════════════════════════════ */

const ACTION_COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500 hover:bg-emerald-600 text-white",
  red: "bg-red-500 hover:bg-red-600 text-white",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
  zinc: "bg-zinc-700 hover:bg-zinc-800 text-white",
  teal: "bg-teal-500 hover:bg-teal-600 text-white",
};

function ActionPopover({
  label, icon: Icon, color, placeholder, requireText, onConfirm, busy,
}: {
  label: string; icon: any; color: keyof typeof ACTION_COLOR_CLASSES; placeholder: string;
  requireText?: boolean; onConfirm: (note: string) => void; busy?: boolean;
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
          <Button size="sm" disabled={requireText && !text.trim()} onClick={() => { onConfirm(text.trim()); setText(""); setOpen(false); }} className={cn("flex-1 h-7 text-xs", ACTION_COLOR_CLASSES[color])}>
            Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Payment-lifecycle actions need a bit more than a note (a payment reference
// or a payroll batch label), so this is a separate small popover rather than
// reusing ActionPopover's single textarea.
function PayActionPopover({
  label, icon: Icon, color, fieldLabel, fieldPlaceholder, onConfirm, busy,
}: {
  label: string; icon: any; color: keyof typeof ACTION_COLOR_CLASSES;
  fieldLabel: string; fieldPlaceholder: string; onConfirm: (value: string) => void; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

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
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">{fieldLabel}</label>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={fieldPlaceholder} className="h-8 text-xs" />
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={() => { onConfirm(value.trim()); setValue(""); setOpen(false); }} className={cn("flex-1 h-7 text-xs", ACTION_COLOR_CLASSES[color])}>
            Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ITEMIZED LINES EDITOR
 * ═══════════════════════════════════════════════════════════════════════════ */

interface DraftItem { id: string; description: string; category: string; amount: string }

function newDraftItem(): DraftItem {
  return { id: Math.random().toString(36).slice(2), description: "", category: "", amount: "" };
}

function ItemsEditor({ items, onChange }: { items: DraftItem[]; onChange: (items: DraftItem[]) => void }) {
  const total = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  const update = (id: string, patch: Partial<DraftItem>) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, newDraftItem()]);
  const remove = (id: string) => onChange(items.length > 1 ? items.filter((it) => it.id !== id) : items);

  return (
    <div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-xl border border-border/50 bg-muted/20 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium">Item {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-red-500 text-[11px] transition-colors">Remove</button>
              )}
            </div>
            <Input value={item.description} onChange={(e) => update(item.id, { description: e.target.value })} placeholder="Description" className="h-8 text-xs" />
            <div className="flex gap-2">
              <select
                value={item.category}
                onChange={(e) => update(item.id, { category: e.target.value })}
                className="flex-1 h-8 text-xs rounded-lg border border-border/50 bg-background px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input type="number" step="0.01" min="0" value={item.amount} onChange={(e) => update(item.id, { amount: e.target.value })} placeholder="0.00" className="h-8 text-xs pl-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 w-full py-2 rounded-xl border border-dashed border-border text-muted-foreground text-xs font-semibold hover:border-primary/50 hover:text-primary transition-all">
        + Add another expense
      </button>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
        <span className="text-xs text-primary/80 font-medium">Total</span>
        <span className="text-primary font-bold">{formatMoney(total)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SHARE DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/submit-reimbursement` : "";

  useEffect(() => {
    if (!open || !shareUrl) return;
    QRCode.toDataURL(shareUrl, { width: 280, margin: 2, color: { dark: "#000000", light: "#ffffff" } }).then(setQrDataUrl).catch(() => {});
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
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Share Reimbursement Form</h2>
                <p className="text-xs text-muted-foreground">Anyone with this link can submit a request</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 flex justify-center">
          <div className="bg-white rounded-2xl p-4 shadow-lg shadow-black/5">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" /> : (
              <div className="w-56 h-56 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mb-4">Scan QR code or share the link below</p>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-2">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{shareUrl}</span>
            <button onClick={handleCopy} className={cn("shrink-0 h-8 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5", copied ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90")}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => { if (navigator.share) navigator.share({ title: "SYMX Reimbursement Form", url: shareUrl }); else handleCopy(); }}>
            <ExternalLink className="h-4 w-4" /> Share
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => { const link = document.createElement("a"); link.href = qrDataUrl; link.download = "SYMX_Reimbursement_QR.png"; link.click(); }} disabled={!qrDataUrl}>
            <QrCode className="h-4 w-4" /> Download QR
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
    fetch("/api/admin/reimbursements/settings")
      .then((res) => res.json())
      .then((data) => setEmails(Array.isArray(data.notificationEmails) ? data.notificationEmails : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const addEmail = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { notify.error("Enter a valid email address"); return; }
    if (emails.includes(value)) { setDraft(""); return; }
    setEmails((prev) => [...prev, value]);
    setDraft("");
  };

  const removeEmail = (email: string) => setEmails((prev) => prev.filter((e) => e !== email));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reimbursements/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmails: emails }),
      });
      if (!res.ok) throw new Error();
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
                <p className="text-xs text-muted-foreground">Who gets emailed on new public requests</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} placeholder="finance@symxlogistics.com" type="email" />
                <Button variant="outline" size="icon" onClick={addEmail} className="shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
              {emails.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">No notification emails set — nobody will be emailed when a request comes in.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <div key={email} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 rounded-lg pl-3 pr-1.5 py-1.5">
                      <span className="text-xs font-medium text-foreground">{email}</span>
                      <button onClick={() => removeEmail(email)} className="h-5 w-5 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors"><X className="h-3 w-3 text-red-500/70" /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || loading} className="flex-1 gap-2 h-10 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20">
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
 *  NEW REIMBURSEMENT DIALOG — the "manager on behalf of employee" flow
 * ═══════════════════════════════════════════════════════════════════════════ */

function NewReimbursementDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: Reimbursement) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmployeeId(""); setEmployeeName(""); setProfileImage("");
      setDate(new Date().toISOString().slice(0, 10));
      setItems([newDraftItem()]); setNotes(""); setFiles([]);
    }
  }, [open]);

  const validItems = items.filter((it) => it.description.trim() && parseFloat(it.amount) > 0);
  const canSave = !!employeeId && validItems.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("employeeId", employeeId);
      formData.append("date", date);
      formData.append("notes", notes);
      formData.append("items", JSON.stringify(validItems.map((it) => ({ description: it.description.trim(), category: it.category, amount: it.amount }))));
      files.forEach((f) => formData.append("file", f));

      const res = await fetch("/api/admin/reimbursements", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const created = await res.json();
      notify.success("Reimbursement request created");
      onCreated({ ...created, employeeName, profileImage });
      onClose();
    } catch {
      notify.error("Failed to create reimbursement");
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
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-foreground">New Reimbursement</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Employee <span className="text-muted-foreground/60 normal-case font-normal">(who this is on behalf of)</span>
            </label>
            <EmployeePicker
              linked={!!employeeId}
              onSelect={(emp) => { setEmployeeId(emp._id); setEmployeeName(`${emp.firstName || ""} ${emp.lastName || ""}`.trim()); setProfileImage(emp.profileImage || ""); }}
              onClear={() => { setEmployeeId(""); setEmployeeName(""); setProfileImage(""); }}
              trigger={
                <button type="button" className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-2.5 text-left hover:border-primary/40 transition-colors">
                  {employeeId ? (
                    <>
                      {profileImage ? <img src={profileImage} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="" /> : <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>}
                      <span className="text-sm font-semibold truncate flex-1">{employeeName}</span>
                      <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-emerald-500" /></div>
                      <span className="text-sm text-muted-foreground flex-1">Search &amp; link an employee</span>
                    </>
                  )}
                </button>
              }
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Date of Expense</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Expenses</label>
            <ItemsEditor items={items} onChange={setItems} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Receipts</label>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} />
            <button onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground text-xs hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" /> Attach receipt files
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/40 border border-border/50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="truncate flex-1">{f.name}</span>
                    <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500 ml-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 gap-2 h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create Request
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

  const Icon = entry.type === "status_change" ? History : entry.type === "payment" ? DollarSign : entry.type === "created" ? Sparkles : Info;
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
 *  DETAIL (right pane)
 * ═══════════════════════════════════════════════════════════════════════════ */

function ReimbursementDetail({
  record, canPay, busy, onBack, onReview, onPayAction, onAddNote, onLinkEmployee,
  onConfirmSuggestion, onDismissSuggestion, onDelete,
}: {
  record: Reimbursement; canPay: boolean; busy: boolean; onBack: () => void;
  onReview: (status: "approved" | "denied" | "pending", note?: string) => void;
  onPayAction: (action: "mark_paid_direct" | "queue_payroll" | "confirm_payroll_paid" | "revert", value?: string) => void;
  onAddNote: (text: string) => void;
  onLinkEmployee: (emp: EmployeeLink | null) => void;
  onConfirmSuggestion: () => void;
  onDismissSuggestion: () => void;
  onDelete: () => void;
}) {
  const status = getEffectiveStatus(record);
  const cfg = STATUS_CONFIG[status];
  const [noteDraft, setNoteDraft] = useState("");

  const activity = useMemo(
    () => [...(record.activity || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [record.activity]
  );

  const submitPostedNote = () => {
    if (!noteDraft.trim()) return;
    onAddNote(noteDraft.trim());
    setNoteDraft("");
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="border-b border-border/50 px-5 py-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 shrink-0"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold truncate">#{record.requestNumber || "—"}</h2>
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ring-1", cfg.bg, cfg.color, cfg.ring)}>
                  <cfg.icon className="h-3 w-3" /> {cfg.label}
                </div>
                {record.source === "public" && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20">
                    <Globe className="h-3 w-3" /> Public
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {formatMoney(record.amount)} · Created {formatRelativeTime(record.createdAt)}{record.createdBy ? ` by ${record.createdBy}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-red-500/70 shrink-0" title="Delete request"><Trash2 className="h-4 w-4" /></button>
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {status === "pending" && (
            <>
              <ActionPopover label="Approve" icon={ThumbsUp} color="emerald" placeholder="Note (optional)" onConfirm={(note) => onReview("approved", note)} busy={busy} />
              <ActionPopover label="Deny" icon={ThumbsDown} color="red" placeholder="Reason for denial..." requireText onConfirm={(note) => onReview("denied", note)} busy={busy} />
            </>
          )}
          {status === "denied" && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onReview("pending")}>Reopen</Button>
          )}
          {status === "approved" && (
            canPay ? (
              <>
                <PayActionPopover label="Mark Paid Directly" icon={DollarSign} color="teal" fieldLabel="Reference (check #, ACH ref, etc.)" fieldPlaceholder="Optional" onConfirm={(ref) => onPayAction("mark_paid_direct", ref)} busy={busy} />
                <PayActionPopover label="Queue for Payroll" icon={Landmark} color="amber" fieldLabel="Batch / pay period label" fieldPlaceholder="e.g. 7/14–7/27 pay period" onConfirm={(label) => onPayAction("queue_payroll", label)} busy={busy} />
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onReview("pending")}>Send back</Button>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground/70 italic">Approved — awaiting payment (you don't have Pay permission)</p>
            )
          )}
          {status === "queued_for_payroll" && canPay && (
            <>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-teal-500 hover:bg-teal-600 text-white" disabled={busy} onClick={() => onPayAction("confirm_payroll_paid")}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirm Paid via Payroll
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onPayAction("revert")}>
                <Undo2 className="h-3.5 w-3.5" /> Revert
              </Button>
            </>
          )}
          {status === "paid" && canPay && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onPayAction("revert")}>
              <Undo2 className="h-3.5 w-3.5" /> Revert Payment
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {(record.submitterName || record.submitterEmail) && (
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 mb-1 flex items-center gap-1.5"><Globe className="h-3 w-3" /> Submitted via public form</p>
            <p className="text-sm font-semibold text-foreground">{record.submitterName || "Unknown"}</p>
            {record.submitterEmail && <p className="text-xs text-muted-foreground">{record.submitterEmail}</p>}
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Linked Employee</label>
          <EmployeePicker
            linked={!!record.employeeId}
            onSelect={(emp) => onLinkEmployee({ _id: emp._id, employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(), profileImage: emp.profileImage, transporterId: emp.transporterId })}
            onClear={() => onLinkEmployee(null)}
            trigger={
              <button type="button" className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-2.5 text-left hover:border-primary/40 transition-colors">
                {record.employeeId ? (
                  <>
                    {record.profileImage ? <img src={record.profileImage} className="h-8 w-8 rounded-lg object-cover shrink-0" alt="" /> : <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{record.employeeName}</p>
                      {record.transporterId && <p className="text-[10px] text-muted-foreground truncate">{record.transporterId}</p>}
                    </div>
                    <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                  </>
                ) : (
                  <>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-emerald-500" /></div>
                    <span className="text-sm text-muted-foreground flex-1">Search &amp; link an employee</span>
                  </>
                )}
              </button>
            }
          />
          {!record.employeeId && record.suggestedEmployeeName && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <UserPlus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">Suggested match: <span className="font-semibold text-foreground">{record.suggestedEmployeeName}</span></p>
              <button onClick={onConfirmSuggestion} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">Confirm</button>
              <button onClick={onDismissSuggestion} className="text-[11px] font-bold text-red-500 hover:text-red-600">Dismiss</button>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Itemized Expenses</p>
          {record.items && record.items.length > 0 ? (
            <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
              {record.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-background">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{it.description}</p>
                    {it.category && <p className="text-[10px] text-muted-foreground">{it.category}</p>}
                  </div>
                  <p className="text-sm font-bold shrink-0 ml-3">{formatMoney(it.amount)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-sm font-black">{formatMoney(record.amount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/90">{record.description || "—"} — {formatMoney(record.amount)}</p>
          )}
        </div>

        {record.attachments && record.attachments.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Receipts</p>
            <div className="grid grid-cols-3 gap-2">
              {record.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg border border-border/50 overflow-hidden bg-muted/30 flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition-all">
                  {isImageUrl(url) ? <img src={url} className="w-full h-full object-cover" alt="" /> : <FileText className="h-6 w-6 text-muted-foreground/50" />}
                </a>
              ))}
            </div>
          </div>
        )}

        {record.notes && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</p>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{record.notes}</p>
          </div>
        )}

        {record.denyReason && status === "denied" && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Denial Reason</p>
            <p className="text-sm text-foreground/90">{record.denyReason}</p>
          </div>
        )}

        {(status === "queued_for_payroll" || status === "paid") && (record.paymentMethod || record.payrollBatchLabel || record.paymentReference) && (
          <div className="rounded-xl bg-teal-500/5 border border-teal-500/20 px-4 py-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1">Payment</p>
            {record.paymentMethod === "direct" && (
              <p className="text-xs text-foreground/90">Paid directly{record.paymentReference ? ` — ref: ${record.paymentReference}` : ""}{record.paidBy ? ` by ${record.paidBy}` : ""}</p>
            )}
            {record.paymentMethod === "payroll" && (
              <p className="text-xs text-foreground/90">
                {status === "paid" ? "Paid via payroll" : "Queued for payroll"}{record.payrollBatchLabel ? ` — ${record.payrollBatchLabel}` : ""}
              </p>
            )}
            {record.paidDate && <p className="text-[11px] text-muted-foreground">Paid {new Date(record.paidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
          </div>
        )}

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
          <div className="space-y-3">
            {activity.length === 0 ? <p className="text-xs text-muted-foreground/60">No activity yet</p> : activity.map((a, i) => <ActivityRow key={i} entry={a} />)}
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 px-5 py-3 shrink-0 flex items-center gap-2">
        <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitPostedNote(); } }} />
        <Button size="sm" disabled={!noteDraft.trim()} onClick={submitPostedNote}>Post</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  QUEUE ROW (left pane)
 * ═══════════════════════════════════════════════════════════════════════════ */

function ReimbursementRow({ r, selected, onClick }: { r: Reimbursement; selected: boolean; onClick: () => void }) {
  const status = getEffectiveStatus(r);
  const cfg = STATUS_CONFIG[status];
  const name = r.employeeName || r.submitterName || r.transporterId || "Unknown";
  const time = formatRelativeTime(r.createdAt);
  const itemSummary = r.items && r.items.length > 0 ? `${r.items.length} item${r.items.length > 1 ? "s" : ""}` : (r.category || "General");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3.5 py-3 border-b border-border/40 transition-colors flex gap-3",
        selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
      )}
    >
      {r.profileImage ? (
        <img src={r.profileImage} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/30 shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center ring-1 ring-border/20 shrink-0"><User className="h-4 w-4 text-muted-foreground/60" /></div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{name}</p>
          <span className="text-sm font-bold shrink-0">{formatMoney(r.amount)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">#{r.requestNumber || "—"} · {itemSummary} · {time}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ring-1", cfg.bg, cfg.color, cfg.ring)}>
            <cfg.icon className="h-2.5 w-2.5" /> {cfg.label}
          </div>
          {r.source === "public" && <Globe className="h-3 w-3 text-purple-500/70" />}
          {r.source === "public" && !r.employeeId && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Not yet matched to an employee" />}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function ReimbursementPage() {
  const { data: queryData } = useHrReimbursements();
  const [records, setRecords] = useState<Reimbursement[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("pending");
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canPay, setCanPay] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // ── Can I pay? (client-side convenience only — the /pay route enforces
  // this server-side regardless) ──
  useEffect(() => {
    fetch("/api/user/permissions").then((res) => res.json()).then((d) => {
      const perms = Array.isArray(d.permissions) ? d.permissions : [];
      const hrPerm = perms.find((p: any) => p.module === "HR");
      const allowed = !hrPerm || !hrPerm.actions || !Object.prototype.hasOwnProperty.call(hrPerm.actions, "pay") ? true : !!hrPerm.actions.pay;
      setCanPay(allowed);
    }).catch(() => setCanPay(false));
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reimbursements?skip=0&limit=500");
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : data.records || []);
        setKpi(data.kpi || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (records.length === 0) setLoading(true);
    fetchRecords().finally(() => setLoading(false));
  }, [fetchRecords]);

  useEffect(() => {
    if (queryData && queryData.records && queryData.records.length > 0 && records.length === 0) {
      setRecords(queryData.records);
      setKpi(queryData.kpi || null);
    }
  }, [queryData]);

  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => setShowShare(true)}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => setShowSettings(true)} title="Notification email settings">
          <Bell className="h-3.5 w-3.5" /> Notify
        </Button>
        {canPay && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-teal-500/30 text-teal-500 hover:bg-teal-500/10" onClick={() => window.open("/api/admin/reimbursements/payroll-export", "_blank")} title="Download CSV of requests queued for payroll">
            <Download className="h-3.5 w-3.5" /> Payroll Export
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent, search, canPay]);

  const performAction = useCallback(async (id: string, method: "PUT", url: string, body: Record<string, any>) => {
    setBusyId(id);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update request");
      }
      await fetchRecords();
    } catch (e: any) {
      notify.error(e.message || "Failed to update request");
    } finally {
      setBusyId(null);
    }
  }, [fetchRecords]);

  const handleReview = useCallback((record: Reimbursement, status: "approved" | "denied" | "pending", note?: string) => {
    const body: Record<string, any> = { status };
    if (status === "denied" && note) body.denyReason = note;
    if (note) body.activityNote = note;
    performAction(record._id, "PUT", `/api/admin/reimbursements/${record._id}`, body);
  }, [performAction]);

  const handlePayAction = useCallback((record: Reimbursement, action: "mark_paid_direct" | "queue_payroll" | "confirm_payroll_paid" | "revert", value?: string) => {
    const body: Record<string, any> = { action };
    if (action === "mark_paid_direct") body.paymentReference = value;
    if (action === "queue_payroll") body.payrollBatchLabel = value;
    performAction(record._id, "PUT", `/api/admin/reimbursements/${record._id}/pay`, body);
  }, [performAction]);

  const handleAddNote = useCallback((record: Reimbursement, text: string) => {
    performAction(record._id, "PUT", `/api/admin/reimbursements/${record._id}`, { activityNote: text });
  }, [performAction]);

  const handleLinkEmployee = useCallback((record: Reimbursement, emp: EmployeeLink | null) => {
    performAction(record._id, "PUT", `/api/admin/reimbursements/${record._id}`, {
      employeeId: emp?._id || null,
      transporterId: emp?.transporterId || "",
      activityNote: emp ? `Linked to ${emp.employeeName}` : "Employee unlinked",
      activityType: "system",
    });
  }, [performAction]);

  const handleConfirmSuggestion = useCallback((record: Reimbursement) => {
    if (!record.suggestedEmployeeId || !record.suggestedEmployeeName) return;
    handleLinkEmployee(record, { _id: record.suggestedEmployeeId, employeeName: record.suggestedEmployeeName, profileImage: record.suggestedProfileImage, transporterId: record.suggestedTransporterId });
  }, [handleLinkEmployee]);

  const handleDismissSuggestion = useCallback((record: Reimbursement) => {
    performAction(record._id, "PUT", `/api/admin/reimbursements/${record._id}`, { suggestedEmployeeId: null });
  }, [performAction]);

  const handleDelete = useCallback((record: Reimbursement) => {
    if (!confirm("Delete this reimbursement request? This cannot be undone.")) return;
    fetch(`/api/admin/reimbursements/${record._id}`, { method: "DELETE" })
      .then((res) => { if (!res.ok) throw new Error(); setRecords((prev) => prev.filter((r) => r._id !== record._id)); if (selectedId === record._id) setSelectedId(null); notify.success("Request deleted"); })
      .catch(() => notify.error("Failed to delete request"));
  }, [selectedId]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data), error: (err) => reject(err) });
      });
      if (parsed.length === 0) { notify.error("CSV file is empty"); setImporting(false); return; }
      const chunks: any[][] = [];
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) chunks.push(parsed.slice(i, i + CHUNK_SIZE));
      let totalInserted = 0;
      for (const chunk of chunks) {
        const res = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "reimbursement", data: chunk }) });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Import failed");
        totalInserted += result.inserted || 0;
      }
      notify.success(`Imported ${totalInserted} reimbursements`);
      await fetchRecords();
    } catch (err: any) {
      notify.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [fetchRecords]);

  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilterKey, number> = { pending: 0, approved: 0, queued_for_payroll: 0, paid: 0, denied: 0, all: records.length };
    records.forEach((r) => { counts[getEffectiveStatus(r)]++; });
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (statusFilter !== "all") result = result.filter((r) => getEffectiveStatus(r) === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        (r.requestNumber || "").toLowerCase().includes(q) ||
        (r.transporterId || "").toLowerCase().includes(q) ||
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.submitterName || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (r.items || []).some((it) => (it.description || "").toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [records, statusFilter, search]);

  const selectedRecord = useMemo(() => records.find((r) => r._id === selectedId) || null, [records, selectedId]);

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          <p className="text-sm text-muted-foreground">Loading reimbursements...</p>
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
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-muted-foreground">Importing reimbursements...</p>
          </div>
        </div>
      )}

      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />
      <NotificationSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <NewReimbursementDialog open={showNew} onClose={() => setShowNew(false)} onCreated={(r) => { setRecords((prev) => [r, ...prev]); setSelectedId(r._id); }} />

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</p>
            <p className="text-lg font-black">{formatMoney(kpi.outstandingAmount)}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.outstandingCount || 0} awaiting payment</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Review</p>
            <p className="text-lg font-black">{kpi.pendingCount || 0}</p>
            <p className="text-[10px] text-muted-foreground">{formatMoney(kpi.pendingAmount)}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queued for Payroll</p>
            <p className="text-lg font-black">{kpi.queuedCount || 0}</p>
            <p className="text-[10px] text-muted-foreground">{formatMoney(kpi.queuedAmount)}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
            <p className="text-lg font-black">{kpi.paidCount || 0}</p>
            <p className="text-[10px] text-muted-foreground">{formatMoney(kpi.paidAmount)}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
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
                <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black", isActive ? "bg-white/20" : "bg-muted")}>{tabCounts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workbench split pane */}
      {records.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center"><Receipt className="h-8 w-8 text-emerald-500/30" /></div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No reimbursement requests found</p>
          <p className="text-xs text-muted-foreground/70 mb-4">Create one or share the form to get started</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New Request</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowShare(true)}><Share2 className="h-3.5 w-3.5" /> Share Form</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 rounded-2xl border border-border/50 overflow-hidden">
          <div className={cn("w-full md:w-[380px] shrink-0 border-r border-border/50 flex flex-col overflow-hidden", selectedId && "hidden md:flex")}>
            <div className="flex-1 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center"><p className="text-xs text-muted-foreground/70">No requests match this view</p></div>
              ) : (
                filteredRecords.map((r) => <ReimbursementRow key={r._id} r={r} selected={r._id === selectedId} onClick={() => setSelectedId(r._id)} />)
              )}
            </div>
          </div>

          <div className={cn("flex-1 min-w-0", !selectedId && "hidden md:flex", selectedId && "flex")}>
            {selectedRecord ? (
              <ReimbursementDetail
                key={selectedRecord._id}
                record={selectedRecord}
                canPay={canPay}
                busy={busyId === selectedRecord._id}
                onBack={() => setSelectedId(null)}
                onReview={(status, note) => handleReview(selectedRecord, status, note)}
                onPayAction={(action, value) => handlePayAction(selectedRecord, action, value)}
                onAddNote={(text) => handleAddNote(selectedRecord, text)}
                onLinkEmployee={(emp) => handleLinkEmployee(selectedRecord, emp)}
                onConfirmSuggestion={() => handleConfirmSuggestion(selectedRecord)}
                onDismissSuggestion={() => handleDismissSuggestion(selectedRecord)}
                onDelete={() => handleDelete(selectedRecord)}
              />
            ) : (
              <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center px-8">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-4"><Receipt className="h-8 w-8 text-emerald-500/30" /></div>
                <p className="text-sm font-bold text-muted-foreground mb-1">Select a request</p>
                <p className="text-xs text-muted-foreground/70">Choose a request from the queue to see details, add notes, and take action</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
