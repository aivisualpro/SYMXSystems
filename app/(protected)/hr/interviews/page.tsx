"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  Search,
  Loader2,
  Upload,
  Plus,
  Trash2,
  Pencil,
  X,
  Copy,
  QrCode,
  Share2,
  Link2,
  Check,
  UserSearch,
  User,
  Phone,
  Calendar,
  Briefcase,
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronDown,
  ExternalLink,
  FileText,
  MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Papa from "papaparse";
import QRCode from "qrcode";

interface Interview {
  _id: string;
  fullName?: string;
  phoneNumber?: string;
  workStartDate?: string;
  typeOfWork?: string;
  workDays?: string;
  lastEmployerInfo?: string;
  howDidYouHear?: string;
  disclaimer?: string;
  status?: string;
  amazonOnboardingStatus?: string;
  interviewNotes?: string;
  rating?: string;
  image?: string;
  dlPhoto?: string;
  updatedBy?: string;
  updatedTimestamp?: string;
  interviewedBy?: string;
  interviewTimestamp?: string;
  onboardingPage?: string;
  eeCode?: string;
  transporterId?: string;
  badgeNumber?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  hiredDate?: string;
  dob?: string;
  hourlyStatus?: string;
  rate?: string;
  gasCardPin?: string;
  dlExpiration?: string;
  onboardingNotes?: string;
  backgroundCheckStatus?: string;
  backgroundCheckFile?: string;
  drugTestStatus?: string;
  drugTestFile?: string;
  offerLetterStatus?: string;
  offerLetterFile?: string;
  handbookStatus?: string;
  handbookFile?: string;
  paycomStatus?: string;
  i9Status?: string;
  i9File?: string;
  classroomTrainingDate?: string;
  sexualHarassmentFile?: string;
  workOpportunityTaxCredit?: string;
  finalInterviewDate?: string;
  finalInterviewTime?: string;
  finalInterviewBy?: string;
  finalInterviewStatus?: string;
  createdAt?: string;
}

type StatusFilter = "all" | "New" | "Interviewed" | "Hired" | "Rejected";

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: any; color: string; activeColor: string }[] = [
  { key: "New", label: "New", icon: Clock, color: "text-blue-500", activeColor: "bg-blue-500 text-white shadow-blue-500/25" },
  { key: "Interviewed", label: "Interviewed", icon: MessageSquare, color: "text-amber-500", activeColor: "bg-amber-500 text-white shadow-amber-500/25" },
  { key: "Hired", label: "Hired", icon: CheckCircle2, color: "text-emerald-500", activeColor: "bg-emerald-500 text-white shadow-emerald-500/25" },
  { key: "Rejected", label: "Rejected", icon: XCircle, color: "text-red-500", activeColor: "bg-red-500 text-white shadow-red-500/25" },
  { key: "all", label: "All", icon: Filter, color: "text-muted-foreground", activeColor: "bg-primary text-primary-foreground shadow-primary/25" },
];

function getStatusConfig(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("hired")) return { label: "Hired", color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", icon: CheckCircle2 };
  if (s.includes("reject")) return { label: "Rejected", color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/20", icon: XCircle };
  if (s.includes("interview")) return { label: "Interviewed", color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/20", icon: MessageSquare };
  return { label: status || "New", color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/20", icon: Clock };
}

function normalizeStatus(s: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("hired")) return "Hired";
  if (v.includes("reject")) return "Rejected";
  if (v.includes("interview")) return "Interviewed";
  return "New";
}

function getRatingStars(r: string) {
  const n = parseInt(r || "0", 10);
  if (isNaN(n) || n <= 0) return null;
  return Math.min(n, 5);
}

const CHUNK_SIZE = 500;

/* ═══════════════════════════════════════════════════════════════════════════
 *  SHARE DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/apply` : "";

  useEffect(() => {
    if (!open || !shareUrl) return;
    QRCode.toDataURL(shareUrl, { width: 280, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl).catch(() => {});
  }, [open, shareUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Share Application Form</h2>
                <p className="text-xs text-muted-foreground">Anyone can apply with this link</p>
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

        <p className="text-center text-xs text-muted-foreground mb-4">Scan QR code or share the link below</p>

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
          <Button variant="outline" className="flex-1 gap-2" onClick={() => { if (navigator.share) { navigator.share({ title: "SYMX Employment Application", url: shareUrl }); } else { handleCopy(); } }}>
            <ExternalLink className="h-4 w-4" /> Share
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => { const link = document.createElement("a"); link.href = qrDataUrl; link.download = "SYMX_Apply_QR.png"; link.click(); }} disabled={!qrDataUrl}>
            <QrCode className="h-4 w-4" /> Download QR
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  CRUD DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

function InterviewDialog({
  open,
  onClose,
  interview,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  interview: Interview | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "interview" | "onboarding">("basic");

  useEffect(() => {
    if (open) {
      setForm({
        fullName: interview?.fullName || "",
        phoneNumber: interview?.phoneNumber || "",
        workStartDate: interview?.workStartDate || "",
        typeOfWork: interview?.typeOfWork || "",
        workDays: interview?.workDays || "",
        lastEmployerInfo: interview?.lastEmployerInfo || "",
        howDidYouHear: interview?.howDidYouHear || "",
        status: interview?.status || "New",
        interviewNotes: interview?.interviewNotes || "",
        rating: interview?.rating || "",
        interviewedBy: interview?.interviewedBy || "",
        email: interview?.email || "",
        transporterId: interview?.transporterId || "",
        badgeNumber: interview?.badgeNumber || "",
        firstName: interview?.firstName || "",
        lastName: interview?.lastName || "",
        backgroundCheckStatus: interview?.backgroundCheckStatus || "",
        drugTestStatus: interview?.drugTestStatus || "",
        offerLetterStatus: interview?.offerLetterStatus || "",
        handbookStatus: interview?.handbookStatus || "",
        onboardingNotes: interview?.onboardingNotes || "",
      });
      setActiveTab("basic");
    }
  }, [open, interview]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = interview ? `/api/admin/interviews/${interview._id}` : "/api/admin/interviews";
      const method = interview ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Save failed");
      toast.success(interview ? "Interview updated" : "Interview created");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tabs = [
    { key: "basic", label: "Applicant Info" },
    { key: "interview", label: "Interview" },
    { key: "onboarding", label: "Onboarding" },
  ] as const;

  const fieldRow = (label: string, key: string, opts?: { type?: string; rows?: number; placeholder?: string }) => (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
      {opts?.rows ? (
        <textarea
          value={form[key] || ""}
          onChange={(e) => set(key, e.target.value)}
          placeholder={opts.placeholder || ""}
          rows={opts.rows}
          className="w-full rounded-xl border border-border/50 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none transition-all"
        />
      ) : (
        <Input
          type={opts?.type || "text"}
          value={form[key] || ""}
          onChange={(e) => set(key, e.target.value)}
          placeholder={opts?.placeholder || ""}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-3 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-lg",
                interview ? "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20" : "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/20"
              )}>
                {interview ? <Pencil className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{interview ? "Edit Applicant" : "New Applicant"}</h2>
                {interview?.fullName && <p className="text-xs text-muted-foreground">{interview.fullName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-0.5 bg-muted/30 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all",
                  activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-4 pt-3">
          {activeTab === "basic" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("Full Name", "fullName", { placeholder: "John Doe" })}
                {fieldRow("Phone", "phoneNumber", { type: "tel", placeholder: "(555) 123-4567" })}
              </div>
              {fieldRow("Email", "email", { type: "email", placeholder: "john@example.com" })}
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("Start Date", "workStartDate", { placeholder: "ASAP" })}
                {fieldRow("Type of Work", "typeOfWork", { placeholder: "Full-Time" })}
              </div>
              {fieldRow("Work Days", "workDays", { placeholder: "Mon, Tue, Wed..." })}
              {fieldRow("Past Experience", "lastEmployerInfo", { rows: 2, placeholder: "Previous employers..." })}
              {fieldRow("How did you hear?", "howDidYouHear", { placeholder: "Indeed, Referral..." })}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Status</label>
                <div className="flex gap-1.5">
                  {["New", "Interviewed", "Hired", "Rejected"].map((s) => (
                    <button
                      key={s}
                      onClick={() => set("status", s)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        form.status === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "interview" && (
            <>
              {fieldRow("Interviewed By", "interviewedBy", { placeholder: "Manager name" })}
              {fieldRow("Rating", "rating", { placeholder: "1-5" })}
              {fieldRow("Interview Notes", "interviewNotes", { rows: 4, placeholder: "Assessment notes..." })}
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("First Name", "firstName")}
                {fieldRow("Last Name", "lastName")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("Transporter ID", "transporterId")}
                {fieldRow("Badge Number", "badgeNumber")}
              </div>
            </>
          )}

          {activeTab === "onboarding" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("Background Check", "backgroundCheckStatus", { placeholder: "Pending / Clear" })}
                {fieldRow("Drug Test", "drugTestStatus", { placeholder: "Pending / Clear" })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {fieldRow("Offer Letter", "offerLetterStatus", { placeholder: "Sent / Signed" })}
                {fieldRow("Handbook", "handbookStatus", { placeholder: "Sent / Signed" })}
              </div>
              {fieldRow("Onboarding Notes", "onboardingNotes", { rows: 3, placeholder: "Additional details..." })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-border/30 flex items-center gap-3 shrink-0">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 gap-2 h-10 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {interview ? "Update" : "Create"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HRInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("New");
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  const [showShare, setShowShare] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Interview | null>(null);

  // ── Header actions ──
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search applicants..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10" onClick={() => setShowShare(true)}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700" onClick={() => { setEditingItem(null); setShowDialog(true); }}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent, search]);

  // ── Fetch ──
  const fetchInterviews = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/interviews");
      if (res.ok) {
        const data = await res.json();
        setInterviews(Array.isArray(data) ? data : data.records || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchInterviews().finally(() => setLoading(false));
  }, [fetchInterviews]);

  // ── Import ──
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject });
      });
      if (parsed.length === 0) { toast.error("CSV file is empty"); setImporting(false); return; }

      const chunks: any[][] = [];
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) chunks.push(parsed.slice(i, i + CHUNK_SIZE));

      let total = 0;
      for (const chunk of chunks) {
        const res = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "interviews", data: chunk }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Import failed");
        total += result.inserted || 0;
      }
      toast.success(`Imported ${total} applicants`);
      await fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [fetchInterviews]);

  // ── Delete ──
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this applicant?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/interviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setInterviews((p) => p.filter((x) => x._id !== id));
      toast.success("Applicant deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Status update ──
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/interviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setInterviews((p) => p.map((x) => x._id === id ? { ...x, status } : x));
      toast.success(`Status → ${status}`);
    } catch {
      toast.error("Failed to update");
    }
  }, []);

  // ── KPIs ──
  const kpi = useMemo(() => {
    const total = interviews.length;
    return {
      total,
      New: interviews.filter((i) => normalizeStatus(i.status || "") === "New").length,
      Interviewed: interviews.filter((i) => normalizeStatus(i.status || "") === "Interviewed").length,
      Hired: interviews.filter((i) => normalizeStatus(i.status || "") === "Hired").length,
      Rejected: interviews.filter((i) => normalizeStatus(i.status || "") === "Rejected").length,
    };
  }, [interviews]);

  const kpiForFilter = (key: StatusFilter) => key === "all" ? kpi.total : kpi[key] || 0;

  // ── Filter + Search ──
  const filtered = useMemo(() => {
    let result = interviews;
    if (statusFilter !== "all") {
      result = result.filter((i) => normalizeStatus(i.status || "") === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        (i.fullName || "").toLowerCase().includes(q) ||
        (i.phoneNumber || "").toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) ||
        (i.typeOfWork || "").toLowerCase().includes(q) ||
        (i.howDidYouHear || "").toLowerCase().includes(q) ||
        (i.transporterId || "").toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [interviews, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
          </div>
          <p className="text-sm text-muted-foreground">Loading applicants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <input ref={fileRef} type="file" className="hidden" accept=".csv" onChange={handleImport} />

      {importing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-card p-8 rounded-2xl border border-border/50 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            <p className="text-sm font-medium text-muted-foreground">Importing applicants...</p>
          </div>
        </div>
      )}

      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />
      <InterviewDialog open={showDialog} onClose={() => { setShowDialog(false); setEditingItem(null); }} interview={editingItem} onSaved={fetchInterviews} />

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
                isActive ? `${f.activeColor} shadow-lg scale-[1.02]` : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <f.icon className={cn("h-3.5 w-3.5", isActive ? "" : f.color)} />
              {f.label}
              <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black", isActive ? "bg-white/20" : "bg-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ CARDS ═══ */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center">
            <UserSearch className="h-8 w-8 text-rose-500/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">
            {statusFilter === "all" ? "No applicants found" : `No ${statusFilter.toLowerCase()} applicants`}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-4">Share the application form or create one manually</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white" onClick={() => { setEditingItem(null); setShowDialog(true); }}>
              <Plus className="h-3.5 w-3.5" /> New Applicant
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowShare(true)}>
              <Share2 className="h-3.5 w-3.5" /> Share Form
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const status = normalizeStatus(item.status || "");
            const config = getStatusConfig(item.status || "");
            const isDeleting = deletingId === item._id;
            const isExpanded = expandedId === item._id;
            const date = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : null;
            const stars = getRatingStars(item.rating || "");

            return (
              <div
                key={item._id}
                className={cn(
                  "group rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5",
                  status === "New" ? "border-blue-500/20 hover:border-blue-500/40" :
                  status === "Hired" ? "border-emerald-500/20 hover:border-emerald-500/40" :
                  "border-border/50 hover:border-border"
                )}
              >
                {/* Accent bar */}
                <div className={cn("h-1 w-full", {
                  "bg-gradient-to-r from-blue-500 to-cyan-500": status === "New",
                  "bg-gradient-to-r from-amber-500 to-orange-500": status === "Interviewed",
                  "bg-gradient-to-r from-emerald-500 to-green-500": status === "Hired",
                  "bg-gradient-to-r from-red-500 to-rose-500": status === "Rejected",
                })} />

                {/* Header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-border/30 shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center ring-2 ring-border/20 shrink-0">
                          <User className="h-5 w-5 text-rose-500/40" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{item.fullName || "Unknown"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.phoneNumber && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Phone className="h-2.5 w-2.5" /> {item.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ring-1", config.bg, config.color, config.ring)}>
                        <config.icon className="h-3 w-3" />
                        {config.label}
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setShowDialog(true); }} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted/50" title="Edit">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(item._id)} disabled={isDeleting} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-red-500/10" title="Delete">
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin text-red-500" /> : <Trash2 className="h-3 w-3 text-red-500/70" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {date && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Calendar className="h-3 w-3" /> {date}
                    </div>
                  )}
                  {item.typeOfWork && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Briefcase className="h-3 w-3" /> {item.typeOfWork}
                    </div>
                  )}
                  {item.howDidYouHear && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <MapPin className="h-3 w-3" /> {item.howDidYouHear}
                    </div>
                  )}
                  {stars && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                      {Array.from({ length: 5 - stars }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 text-muted-foreground/20" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Work Days */}
                {item.workDays && (
                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1">
                      {item.workDays.split(",").map((d, i) => (
                        <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.trim().slice(0, 3)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {item.lastEmployerInfo && (
                  <div className="px-4 pb-3">
                    <p className={cn("text-xs text-muted-foreground leading-relaxed", isExpanded ? "" : "line-clamp-2")}>
                      {item.lastEmployerInfo}
                    </p>
                    {item.lastEmployerInfo.length > 120 && (
                      <button onClick={() => setExpandedId(isExpanded ? null : item._id)} className="text-[10px] font-bold text-primary mt-1 hover:underline">
                        {isExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                )}

                {/* Notes */}
                {item.interviewNotes && (
                  <div className="px-4 pb-3">
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{item.interviewNotes}</p>
                    </div>
                  </div>
                )}

                {/* Quick status footer */}
                {status === "New" && (
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5 flex items-center gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleStatusChange(item._id, "Interviewed")}>
                      <MessageSquare className="h-3.5 w-3.5" /> Interviewed
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(item._id, "Hired")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Hire
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => handleStatusChange(item._id, "Rejected")}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {status === "Interviewed" && (
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5 flex items-center gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs font-bold gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(item._id, "Hired")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Hire
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => handleStatusChange(item._id, "Rejected")}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}

                {(status === "Hired" || status === "Rejected") && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 py-2 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/50 font-medium">
                      {status === "Hired" ? "✓ Applicant hired" : "✗ Applicant rejected"}
                    </p>
                    <button
                      onClick={() => handleStatusChange(item._id, "New")}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground font-medium transition-colors"
                    >
                      Reset to New
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
