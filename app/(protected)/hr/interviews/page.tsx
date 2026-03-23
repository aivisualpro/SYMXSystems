"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useDataStore } from "@/hooks/use-data-store";
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
  Circle,
  ImagePlus,
  Eye,
  type LucideIcon,
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

interface DropdownStatus {
  _id: string;
  description: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

// ── Dynamic color palette based on status name ──
const STATUS_COLOR_MAP: Record<string, { text: string; bg: string; ring: string; active: string; gradient: string }> = {
  undecided:                    { text: "text-blue-500",    bg: "bg-blue-500/10",    ring: "ring-blue-500/20",    active: "bg-blue-500 text-white shadow-blue-500/25",      gradient: "from-blue-500 to-cyan-500" },
  "move to next step":          { text: "text-teal-500",    bg: "bg-teal-500/10",    ring: "ring-teal-500/20",    active: "bg-teal-500 text-white shadow-teal-500/25",      gradient: "from-teal-500 to-cyan-500" },
  hired:                        { text: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", active: "bg-emerald-500 text-white shadow-emerald-500/25", gradient: "from-emerald-500 to-green-500" },
  reject:                       { text: "text-red-500",     bg: "bg-red-500/10",     ring: "ring-red-500/20",     active: "bg-red-500 text-white shadow-red-500/25",        gradient: "from-red-500 to-rose-500" },
  "background check complete":  { text: "text-violet-500",  bg: "bg-violet-500/10",  ring: "ring-violet-500/20",  active: "bg-violet-500 text-white shadow-violet-500/25",  gradient: "from-violet-500 to-purple-500" },
  "waiting on background check":{ text: "text-amber-500",   bg: "bg-amber-500/10",   ring: "ring-amber-500/20",   active: "bg-amber-500 text-white shadow-amber-500/25",    gradient: "from-amber-500 to-orange-500" },
  "waiting on hire":            { text: "text-sky-500",     bg: "bg-sky-500/10",     ring: "ring-sky-500/20",     active: "bg-sky-500 text-white shadow-sky-500/25",        gradient: "from-sky-500 to-blue-500" },
};

const FALLBACK_PALETTE = [
  { text: "text-pink-500",   bg: "bg-pink-500/10",   ring: "ring-pink-500/20",   active: "bg-pink-500 text-white shadow-pink-500/25",   gradient: "from-pink-500 to-rose-500" },
  { text: "text-indigo-500", bg: "bg-indigo-500/10", ring: "ring-indigo-500/20", active: "bg-indigo-500 text-white shadow-indigo-500/25", gradient: "from-indigo-500 to-blue-500" },
  { text: "text-lime-500",   bg: "bg-lime-500/10",   ring: "ring-lime-500/20",   active: "bg-lime-500 text-white shadow-lime-500/25",   gradient: "from-lime-500 to-green-500" },
  { text: "text-orange-500", bg: "bg-orange-500/10", ring: "ring-orange-500/20", active: "bg-orange-500 text-white shadow-orange-500/25", gradient: "from-orange-500 to-amber-500" },
  { text: "text-cyan-500",   bg: "bg-cyan-500/10",   ring: "ring-cyan-500/20",   active: "bg-cyan-500 text-white shadow-cyan-500/25",   gradient: "from-cyan-500 to-teal-500" },
];

const STATUS_ICON_MAP: Record<string, LucideIcon> = {
  undecided: Clock,
  "move to next step": ChevronDown,
  hired: CheckCircle2,
  reject: XCircle,
  "background check complete": CheckCircle2,
  "waiting on background check": Clock,
  "waiting on hire": Clock,
};

function getStatusColors(name: string, index = 0) {
  const key = name.toLowerCase().trim();
  return STATUS_COLOR_MAP[key] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function getStatusIcon(name: string): LucideIcon {
  const key = name.toLowerCase().trim();
  return STATUS_ICON_MAP[key] || Circle;
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
  statusOptions,
}: {
  open: boolean;
  onClose: () => void;
  interview: Interview | null;
  onSaved: () => void;
  statusOptions: DropdownStatus[];
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
        status: interview?.status || "Undecided",
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
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map((opt, i) => {
                    const colors = getStatusColors(opt.description, i);
                    const Icon = getStatusIcon(opt.description);
                    const isActive = form.status === opt.description;
                    return (
                      <button
                        key={opt._id}
                        onClick={() => set("status", opt.description)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                          isActive ? `${colors.active} shadow-sm` : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {opt.description}
                      </button>
                    );
                  })}
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
 *  INTERVIEW NOTES RENDERER
 * ═══════════════════════════════════════════════════════════════════════════ */

function parseInterviewNotes(text: string) {
  if (!text?.trim()) return [];
  const lines = text.split("\n");
  const blocks: { type: "qa" | "section" | "text"; question?: string; answer?: string; content?: string }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) { i++; continue; }

    // Section header like "Others:"
    if (/^(others|additional|notes|comments)\s*:/i.test(line)) {
      const sectionContent: string[] = [];
      i++;
      while (i < lines.length) {
        const sLine = lines[i].trim();
        if (sLine) sectionContent.push(sLine);
        i++;
      }
      blocks.push({ type: "section", question: line.replace(/:$/, ""), content: sectionContent.join("\n") });
      continue;
    }

    // Line ending with "?" or multi-word line not starting with "A:" = question
    if (line.endsWith("?") || (line.length > 20 && !line.startsWith("A:"))) {
      const question = line;
      let answer = "";
      i++;
      // Collect answer lines (starting with A: or continuation lines)
      while (i < lines.length) {
        const aLine = lines[i].trim();
        if (!aLine) { i++; continue; }
        if (aLine.startsWith("A:")) {
          answer = aLine.replace(/^A:\s*/, "").trim();
          i++;
          break;
        }
        // If it looks like the next question, stop
        if (aLine.endsWith("?") || (aLine.length > 20 && !aLine.startsWith("A:"))) break;
        answer += (answer ? " " : "") + aLine;
        i++;
      }
      blocks.push({ type: "qa", question, answer: answer || "\u2014" });
      continue;
    }

    // Standalone A: line (orphan answer)
    if (line.startsWith("A:")) {
      blocks.push({ type: "text", content: line.replace(/^A:\s*/, "").trim() || "\u2014" });
      i++;
      continue;
    }

    // Plain text
    blocks.push({ type: "text", content: line });
    i++;
  }

  return blocks;
}

function rebuildNotes(blocks: { type: "qa" | "section" | "text"; question?: string; answer?: string; content?: string }[]): string {
  return blocks.map((b) => {
    if (b.type === "qa") {
      const ans = b.answer === "\u2014" || !b.answer ? "" : b.answer;
      return `${b.question}\nA: ${ans}`;
    }
    if (b.type === "section") return `${b.question}:\n${b.content || ""}`;
    return b.content || "";
  }).join("\n\n");
}

function InterviewNotesRenderer({
  notes,
  isEditing,
  onToggleEdit,
  onSave,
}: {
  notes: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (val: string) => void;
}) {
  const blocks = parseInterviewNotes(notes || "");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleInlineSave = (idx: number, newAnswer: string) => {
    const updated = blocks.map((b, i) => {
      if (i === idx) {
        if (b.type === "qa") return { ...b, answer: newAnswer.trim() || "\u2014" };
        if (b.type === "section") return { ...b, content: newAnswer.trim() };
      }
      return b;
    });
    setEditingIdx(null);
    onSave(rebuildNotes(updated));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Interview Notes</p>
        <button
          onClick={onToggleEdit}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all",
            isEditing ? "bg-primary text-primary-foreground" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
          )}
        >
          {isEditing ? <><Eye className="h-2.5 w-2.5" /> View</> : <><Pencil className="h-2.5 w-2.5" /> Edit</>}
        </button>
      </div>

      {isEditing ? (
        <textarea
          defaultValue={notes || ""}
          placeholder={"Add interview notes...\n\nFormat:\nQuestion?\nA: Answer\n\nOthers:\nAdditional info"}
          rows={8}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val !== (notes || "").trim()) onSave(val);
          }}
          className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y min-h-[120px] transition-all font-mono leading-relaxed"
        />
      ) : blocks.length > 0 ? (
        <div className="space-y-2">
          {blocks.map((block, bi) => {
            if (block.type === "qa") {
              const isEditingThis = editingIdx === bi;
              return (
                <div key={bi} className="rounded-xl bg-muted/20 border border-border/30 overflow-hidden">
                  <div className="flex gap-2 px-3 py-2 bg-gradient-to-r from-rose-500/5 to-transparent">
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center bg-rose-500/15 text-rose-500 text-[8px] font-black">Q</span>
                    <p className="text-[11px] text-foreground/80 font-medium leading-relaxed">{block.question}</p>
                  </div>
                  <div
                    className={cn(
                      "flex gap-2 px-3 py-2 border-t border-border/20 cursor-text transition-colors",
                      !isEditingThis && "hover:bg-emerald-500/5"
                    )}
                    onDoubleClick={() => setEditingIdx(bi)}
                  >
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center bg-emerald-500/15 text-emerald-500 text-[8px] font-black">A</span>
                    {isEditingThis ? (
                      <input
                        autoFocus
                        defaultValue={block.answer === "\u2014" ? "" : block.answer}
                        placeholder="Type answer..."
                        onBlur={(e) => handleInlineSave(bi, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInlineSave(bi, (e.target as HTMLInputElement).value); } }}
                        className="flex-1 bg-transparent text-[11px] text-foreground font-medium leading-relaxed outline-none border-b border-emerald-500/30 pb-0.5 placeholder:text-muted-foreground/30"
                      />
                    ) : (
                      <p className={cn(
                        "text-[11px] leading-relaxed flex-1",
                        block.answer === "\u2014" ? "text-muted-foreground/30 italic" : "text-foreground font-medium"
                      )}>
                        {block.answer}
                        {block.answer === "\u2014" && <span className="ml-2 text-[9px] text-muted-foreground/20 not-italic">double-click to answer</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (block.type === "section") {
              const isEditingThis = editingIdx === bi;
              return (
                <div key={bi} className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                  <p className="text-[9px] font-black text-amber-500/70 uppercase tracking-wider mb-1">{block.question}</p>
                  {isEditingThis ? (
                    <textarea
                      autoFocus
                      defaultValue={block.content || ""}
                      rows={3}
                      placeholder="Add details..."
                      onBlur={(e) => handleInlineSave(bi, e.target.value)}
                      className="w-full bg-transparent text-[11px] text-foreground/80 leading-relaxed outline-none border border-amber-500/20 rounded-lg px-2 py-1 resize-none placeholder:text-muted-foreground/30"
                    />
                  ) : (
                    <p
                      className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line cursor-text hover:bg-amber-500/5 rounded px-1 -mx-1 transition-colors"
                      onDoubleClick={() => setEditingIdx(bi)}
                    >
                      {block.content || <span className="text-muted-foreground/30 italic">double-click to edit</span>}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <p key={bi} className="text-[11px] text-muted-foreground leading-relaxed px-1">{block.content}</p>
            );
          })}
        </div>
      ) : (
        <button
          onClick={onToggleEdit}
          className="w-full py-4 rounded-xl border border-dashed border-border/40 bg-muted/10 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-border/60 transition-all"
        >
          Click to add interview notes...
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HRInterviewsPage() {
  const store = useDataStore();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Undecided");
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  const [showShare, setShowShare] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Interview | null>(null);
  const [statusOptions, setStatusOptions] = useState<DropdownStatus[]>([]);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  // ── Seed from store for instant load ──
  const storeInterviews = store.hrInterviews as any;
  useEffect(() => {
    if (Array.isArray(storeInterviews) && storeInterviews.length > 0 && interviews.length === 0) {
      setInterviews(storeInterviews);
    }
  }, [storeInterviews]);

  // ── Seed status options from store ──
  const storeDropdowns = store.admin?.dropdowns as any[] ?? [];
  useEffect(() => {
    if (Array.isArray(storeDropdowns) && storeDropdowns.length > 0 && statusOptions.length === 0) {
      const opts = storeDropdowns.filter((d: any) => d.type === "interview status" && d.isActive);
      if (opts.length > 0) setStatusOptions(opts);
    }
  }, [storeDropdowns]);

  // ── Fetch interview status dropdown options ──
  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=interview status")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStatusOptions(data.filter((d: any) => d.isActive));
        }
      })
      .catch(() => {});
  }, []);

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
    if (interviews.length === 0) setLoading(true);
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

  // ── Generic inline field update ──
  const handleFieldUpdate = useCallback(async (id: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/admin/interviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      setInterviews((p) => p.map((x) => x._id === id ? { ...x, [field]: value } : x));
    } catch {
      toast.error("Failed to save");
    }
  }, []);

  // ── DL Photo upload ──
  const handleDlPhotoUpload = useCallback(async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch("/api/admin/upload?folder=symx-systems/interviews", {
        method: "POST",
        body: formData,
      });
      if (!upRes.ok) throw new Error();
      const { url } = await upRes.json();
      await handleFieldUpdate(id, "dlPhoto", url);
      toast.success("DL Photo uploaded");
    } catch {
      toast.error("Upload failed");
    }
  }, [handleFieldUpdate]);

  // ── KPIs (dynamic from dropdown statuses) ──
  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    statusOptions.forEach((opt) => {
      map[opt.description] = interviews.filter((i) => (i.status || "").toLowerCase().trim() === opt.description.toLowerCase().trim()).length;
    });
    return map;
  }, [interviews, statusOptions]);

  // ── Filter + Search ──
  const filtered = useMemo(() => {
    let result = interviews;
    if (statusFilter !== "all") {
      result = result.filter((i) => (i.status || "").toLowerCase().trim() === statusFilter.toLowerCase().trim());
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

  if (loading && interviews.length === 0) {
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
      <InterviewDialog open={showDialog} onClose={() => { setShowDialog(false); setEditingItem(null); }} interview={editingItem} onSaved={fetchInterviews} statusOptions={statusOptions} />

      {/* ═══ STATUS FILTER PILLS (dynamic) ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* "All" pill */}
        <button
          key="all"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
            statusFilter === "all" ? "bg-primary text-primary-foreground shadow-primary/25 shadow-lg scale-[1.02]" : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50"
          )}
        >
          All
          <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black", statusFilter === "all" ? "bg-white/20" : "bg-muted")}>{interviews.length}</span>
        </button>

        {/* Hardcoded tab order: Undecided, Amazon Onboarding (Move to Next Step), Waiting on background check, Waiting on Hire, Hired, Rejected */}
        {(() => {
          const TAB_ORDER = [
            "Undecided",
            "Move to Next Step",
            "Waiting on background check",
            "Waiting on Hire",
            "Hired",
            "Rejected",
          ];
          const orderedOptions = TAB_ORDER
            .map(name => statusOptions.find(opt => opt.description === name))
            .filter(Boolean) as DropdownStatus[];
          return orderedOptions.map((opt, i) => {
            const isActive = statusFilter === opt.description;
            const count = kpiMap[opt.description] || 0;
            const colors = getStatusColors(opt.description, i);
            const Icon = getStatusIcon(opt.description);
            const displayLabel = opt.description === "Move to Next Step" ? "Amazon Onboarding" : opt.description;
            return (
              <button
                key={opt._id}
                onClick={() => setStatusFilter(opt.description)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  isActive ? `${colors.active} shadow-lg scale-[1.02]` : "bg-card border border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "" : colors.text)} />
                {displayLabel}
                <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black", isActive ? "bg-white/20" : "bg-muted")}>{count}</span>
              </button>
            );
          });
        })()}
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
          {filtered.map((item, itemIdx) => {
            const status = (item.status || "").trim();
            const statusLower = status.toLowerCase();
            const statusColorIdx = statusOptions.findIndex((o) => o.description.toLowerCase() === statusLower);
            const colors = getStatusColors(status, statusColorIdx >= 0 ? statusColorIdx : itemIdx);
            const StatusIcon = getStatusIcon(status);
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
                  "border-border/50 hover:border-border"
                )}
              >
                {/* Accent bar */}
                <div className={cn("h-1 w-full bg-gradient-to-r", colors.gradient)} />

                {/* ── 1. Name + createdAt inline + actions ── */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{item.fullName || "Unknown"}</p>
                      {date && <span className="text-[10px] text-muted-foreground/60 shrink-0">{date}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black ring-1", colors.bg, colors.text, colors.ring)}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {status === "Move to Next Step" ? "Amazon Onboarding" : (status || "Undecided")}
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setShowDialog(true); }} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted/50" title="Edit">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(item._id)} disabled={isDeleting} className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-500/10" title="Delete">
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin text-red-500" /> : <Trash2 className="h-3 w-3 text-red-500/70" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Phone below name */}
                  {item.phoneNumber && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" /> {item.phoneNumber}
                    </p>
                  )}
                </div>

                {/* ── 2-4. Info row: Work Start, Type, Source ── */}
                <div className="px-4 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {item.workStartDate && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Calendar className="h-3 w-3" /> Start: {item.workStartDate}
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
                </div>

                {/* ── 5. Work Days chips ── */}
                {item.workDays && (
                  <div className="px-4 pb-2">
                    <div className="flex flex-wrap gap-1">
                      {item.workDays.split(",").map((d, i) => {
                        const day = d.trim();
                        if (!day) return null;
                        return (
                          <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                            {day.length > 3 ? day.slice(0, 3) : day}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── 6. Last Employer Info ── */}
                {item.lastEmployerInfo && (
                  <div className="px-4 pb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-0.5">Past Experience</p>
                    <p className={cn("text-xs text-muted-foreground leading-relaxed", isExpanded ? "" : "line-clamp-2")}>
                      {item.lastEmployerInfo}
                    </p>
                    {item.lastEmployerInfo.length > 100 && (
                      <button onClick={() => setExpandedId(isExpanded ? null : item._id)} className="text-[10px] font-bold text-primary mt-0.5 hover:underline">
                        {isExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                )}

                {/* ── 7. Interview Notes (premium Q&A renderer) ── */}
                <div className="px-4 pb-2">
                  <InterviewNotesRenderer
                    notes={item.interviewNotes || ""}
                    isEditing={editingNotesId === item._id}
                    onToggleEdit={() => setEditingNotesId(editingNotesId === item._id ? null : item._id)}
                    onSave={(val) => {
                      handleFieldUpdate(item._id, "interviewNotes", val);
                      setEditingNotesId(null);
                    }}
                  />
                </div>

                {/* ── 8+9. Rating + DL Photo (inline) ── */}
                <div className="px-4 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Rating</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleFieldUpdate(item._id, "rating", String(n))}
                          className="transition-transform hover:scale-125"
                        >
                          <Star className={cn("h-3.5 w-3.5", stars && n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20 hover:text-amber-400/50")} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">DL</p>
                    {item.dlPhoto ? (
                      <a href={item.dlPhoto} target="_blank" rel="noopener noreferrer">
                        <img src={item.dlPhoto} alt="DL" className="h-8 w-12 object-cover rounded border border-border/40 hover:border-primary/40 transition-all hover:shadow-md" />
                      </a>
                    ) : (
                      <label className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border/50 bg-muted/20 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary cursor-pointer transition-all">
                        <ImagePlus className="h-3 w-3" />
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDlPhotoUpload(item._id, f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* ── 10. Dynamic status footer ── */}
                <div className="border-t border-border/30 bg-muted/15 px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {statusOptions.map((opt, si) => {
                      const isCurrent = statusLower === opt.description.toLowerCase();
                      const optColors = getStatusColors(opt.description, si);
                      const OptIcon = getStatusIcon(opt.description);
                      return (
                        <button
                          key={opt._id}
                          onClick={() => !isCurrent && handleStatusChange(item._id, opt.description)}
                          disabled={isCurrent}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                            isCurrent
                              ? `${optColors.active} cursor-default`
                              : "bg-muted/50 border border-border/40 text-muted-foreground hover:border-border hover:bg-muted"
                          )}
                        >
                          <OptIcon className="h-2.5 w-2.5" />
                          {opt.description === "Move to Next Step" ? "Amazon Onboarding" : opt.description}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
