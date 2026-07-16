"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignaturePad from "@/components/ui/signature-pad";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Loader2, Plus, ClipboardList, FileText, Printer, Upload, AlertTriangle, Download, ThumbsDown, ArrowUp, ArrowDown, ArrowUpDown, FileDown, MessageSquare, Trash2, FileEdit } from "lucide-react";

// Presets keep the range picker fast for the most common lookups (matches
// the Callouts page pattern).
const DATE_PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: string; direction: SortDirection }

function sortByKey<T extends Record<string, any>>(items: T[], sort: SortConfig): T[] {
  const sorted = [...items].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av ?? "").localeCompare(String(bv ?? ""));
  });
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  sort: SortConfig;
  onSort: (key: string) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

interface PriorSnapshot { writeupId: string; incidentDate: string; warningLevel: string }
interface PriorVerbalCoachingSnapshot { coachingDate: string; categoryLabels: string[] }
interface SignatureInfo { name: string; signatureImage: string; signedAt: string }
interface Refusal { refused: boolean; note?: string; witnessName?: string; witnessSignatureImage?: string; refusedAt?: string }
interface Attachment { name: string; url: string; category: string }
interface EscalationResolution { outcome: string; suspensionDays?: number; notes: string; resolvedBy: string; resolvedAt: string }
interface ManagerReview { decision: string; outcome?: string; suspensionDays?: number; notes: string; reviewedBy: string; reviewedAt: string }

interface Writeup {
  _id: string;
  transporterId?: string;
  employeeId?: string;
  employeeName: string;
  categoryId?: string;
  categoryLabel: string;
  warningLevel: string;
  warningLevelAuto: string;
  warningLevelOverrideReason?: string;
  incidentDate: string;
  description?: string;
  planForImprovement?: string;
  consequences?: string;
  priorWriteups: PriorSnapshot[];
  priorVerbalCoachings: PriorVerbalCoachingSnapshot[];
  status: string;
  acknowledgmentType?: string;
  reviewQueuedAt?: string;
  escalatedAt?: string; // legacy — pre-redesign records only
  escalation?: EscalationResolution; // legacy — pre-redesign records only
  managerReview?: ManagerReview;
  managerName: string;
  managerSignature?: SignatureInfo; // the issuer — labeled "Issued By" in the UI
  employeeSignature?: SignatureInfo;
  refusal?: Refusal;
  attachments: Attachment[];
  isHistorical: boolean;
  createdBy?: string;
}

interface EmployeeOption { transporterId: string; firstName: string; lastName: string; _id: string; status: string }
interface CategoryOption { _id: string; description: string }

const WARNING_LEVELS = ["first_warning", "second_warning", "third_warning", "final_warning", "suspension_review"];
const WARNING_LEVEL_LABELS: Record<string, string> = {
  first_warning: "First Warning",
  second_warning: "Second Warning",
  third_warning: "Third Warning",
  final_warning: "Final Warning",
  suspension_review: "Suspension Review",
};
const WARNING_LEVEL_COLORS: Record<string, string> = {
  first_warning: "bg-blue-500 text-white border-blue-600",
  second_warning: "bg-amber-500 text-white border-amber-600",
  third_warning: "bg-orange-500 text-white border-orange-600",
  final_warning: "bg-red-500 text-white border-red-600",
  suspension_review: "bg-red-800 text-white border-red-900",
};
// draft/closed are the only statuses new code writes going forward.
// pending_review is the universal "waiting on a manager" state — every
// write-up passes through it once the employee has acknowledged. escalated
// is a legacy alias (pre-redesign, suspension-only) that's treated exactly
// like pending_review everywhere below. signed/refused_to_sign/
// uploaded_signed_copy are legacy terminal states from before this redesign
// (no review ever happened on those records) — kept only so old rows still
// display something sensible.
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft — needs signature",
  pending_review: "Pending Manager Review",
  escalated: "Pending Manager Review",
  signed: "Signed (pre-review)",
  refused_to_sign: "Refused to Sign (pre-review)",
  uploaded_signed_copy: "Signed — Uploaded Copy (pre-review)",
  closed: "Closed",
};

const REVIEW_DECISIONS = [
  { value: "confirmed", label: "Confirm as issued" },
  { value: "escalated", label: "Escalate / further action" },
];

const ESCALATION_OUTCOMES = [
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
  { value: "downgraded", label: "Downgraded (warning stands, no suspension)" },
  { value: "no_action", label: "No Further Action" },
];
const ESCALATION_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(ESCALATION_OUTCOMES.map((o) => [o.value, o.label]));

function daysSince(d?: string): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

function isPendingReview(w: Writeup): boolean {
  return w.status === "pending_review" || w.status === "escalated";
}

// "closed" covers a manager-reviewed write-up (new flow) or a resolved
// legacy escalation (old flow) — distinguish them for display.
function statusLabel(w: Writeup): string {
  if (w.status === "closed" && w.managerReview) {
    if (w.managerReview.decision === "confirmed") return "Reviewed — Confirmed as Issued";
    return `Reviewed — Escalated: ${ESCALATION_OUTCOME_LABELS[w.managerReview.outcome || ""] || w.managerReview.outcome}`;
  }
  if (w.status === "closed" && w.escalation) {
    return `Escalation Resolved — ${ESCALATION_OUTCOME_LABELS[w.escalation.outcome] || w.escalation.outcome}`;
  }
  return STATUS_LABELS[w.status] || w.status;
}

const EMPTY_FORM = {
  employeeId: "", transporterId: "", employeeName: "",
  categoryId: "", subCategory: "", incidentDate: new Date().toISOString().split("T")[0],
  description: "", planForImprovement: "", consequences: "",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

interface FormalWriteupsTabProps {
  // True when rendered as the manager Review Workbench tab: locks the
  // default filter to write-ups awaiting review and sorts oldest-first.
  // Creating a write-up is still available here too — a manager shouldn't
  // have to switch tabs just to issue one while working the queue.
  workbenchMode?: boolean;
  // Reports the current pending-review count while this instance is
  // mounted, so the parent page's tab badge stays live as items get
  // reviewed (only meaningful in workbenchMode).
  onCountChange?: (count: number) => void;
}

export default function FormalWriteupsTab({ workbenchMode = false, onCountChange }: FormalWriteupsTabProps) {
  const [writeups, setWriteups] = useState<Writeup[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [includeTerminated, setIncludeTerminated] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(workbenchMode ? "pending_review" : "all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Date range is optional — empty means "all time". Presets (7/30/90 days)
  // set both at once; the inputs also accept a fully custom range.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(null);
  // Newest first by default; the workbench sorts oldest-waiting-first instead,
  // same instinct as any approvals inbox — the case that's been sitting
  // longest surfaces at the top.
  const [sort, setSort] = useState<SortConfig>(
    workbenchMode ? { key: "reviewQueuedAt", direction: "asc" } : { key: "incidentDate", direction: "desc" }
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  // Gates the review-decision form — the server enforces this too
  // (Write-Ups: approve), this just avoids showing a button that will 403.
  const [canApprove, setCanApprove] = useState(true);
  // Gates the "Delete" button — server enforces via requirePermission("Admin","delete"),
  // this just avoids showing a button that will 403.
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    recommended: string; priorCount: number; priors: PriorSnapshot[]; rationale: string;
    correctiveAction?: { planForImprovement: string; consequences: string };
    verbalCoachingContext?: { count: number; items: { coachingDate: string; categoryLabels: string[]; status: string; notes: string }[] };
    availableSubCategories?: string[];
  } | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  // Tracks which of planForImprovement/consequences currently hold
  // system-generated text (vs. something the manager typed by hand), so
  // switching categories can safely replace a stale auto-fill without ever
  // clobbering a manual edit.
  const [autoFilled, setAutoFilled] = useState({ planForImprovement: false, consequences: false });
  const [levelOverride, setLevelOverride] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Detail / sign dialog
  const [selected, setSelected] = useState<Writeup | null>(null);
  const [managerName, setManagerName] = useState("");
  const [managerSig, setManagerSig] = useState("");
  const [employeeName, setEmployeeSignerName] = useState("");
  const [employeeSig, setEmployeeSig] = useState("");
  const [savingSign, setSavingSign] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseNote, setRefuseNote] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessSig, setWitnessSig] = useState("");
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<string>("confirmed");
  const [resolveOutcome, setResolveOutcome] = useState("");
  const [resolveSuspensionDays, setResolveSuspensionDays] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolvingEscalation, setResolvingEscalation] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/writeups?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load write-ups");
      setWriteups(json.writeups || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      notify.error(err.message || "Failed to load write-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, dateFrom, dateTo]);

  const toggleSort = (key: string) => {
    setSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" }));
  };

  const applyDatePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    setDateFrom(toISODate(d));
    setDateTo(toISODate(new Date()));
    setActivePreset(days);
  };

  const clearDateRange = () => {
    setDateFrom("");
    setDateTo("");
    setActivePreset(null);
  };

  // Pull the full roster once (terminated=true bypasses the server's
  // status filter entirely, so this includes Active/Resigned/Inactive/
  // Terminated alike) — the "only active" default is enforced client-side
  // below via visibleEmployees, since the server's terminated param only
  // excludes the literal "Terminated" status, not Resigned/Inactive.
  useEffect(() => {
    fetch("/api/admin/employees?terminated=true&export=true&select=firstName,lastName,transporterId,status")
      .then((res) => res.json())
      .then((json) => {
        const list = (json.employees || json || []).map((e: any) => ({
          _id: e._id, transporterId: e.transporterId || "", firstName: e.firstName || "", lastName: e.lastName || "", status: e.status || "",
        }));
        setEmployees(list.sort((a: EmployeeOption, b: EmployeeOption) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
      })
      .catch(() => {});
  }, []);

  const visibleEmployees = useMemo(
    () => (includeTerminated ? employees : employees.filter((e) => e.status === "Active")),
    [employees, includeTerminated]
  );

  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=metric")
      .then((res) => res.json())
      .then((d) => setCategories(Array.isArray(d) ? d.filter((c: any) => c.isActive !== false) : []))
      .catch(() => {});
    fetch("/api/user/permissions")
      .then((res) => res.json())
      .then((d) => {
        setIsSuperAdmin(d.role === "Super Admin");
        if (d.role === "Super Admin") { setCanApprove(true); return; }
        const perm = (d.permissions || []).find((p: any) => p.module === "Write-Ups");
        setCanApprove(perm ? perm.actions?.approve !== false : true);
      })
      .catch(() => {});
  }, []);

  const emptyMessage = workbenchMode
    ? "Nothing waiting on your review right now."
    : "No write-ups found.";

  // "Include terminated employees" hides those write-ups everywhere on
  // this screen — the summary cards and the table should agree with each
  // other, so both derive from this same base set. Only excludes rows
  // once the employee roster has loaded, and only when the write-up's
  // employeeId actually resolves to a known employee — an unresolvable
  // employeeId (e.g. a deleted employee record) stays visible rather
  // than silently vanishing.
  const visibleWriteups = useMemo(() => {
    if (includeTerminated || employees.length === 0) return writeups;
    return writeups.filter((w) => {
      if (!w.employeeId) return true;
      const emp = employees.find((e) => e._id === w.employeeId);
      return !emp || emp.status === "Active";
    });
  }, [writeups, includeTerminated, employees]);

  // In workbenchMode statusFilter is locked to "pending_review", so
  // visibleWriteups already IS the review queue — report its size upward
  // for the parent tab's badge, live, as items get reviewed.
  useEffect(() => {
    if (workbenchMode) onCountChange?.(visibleWriteups.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbenchMode, visibleWriteups]);

  const filtered = useMemo(() => {
    let rows = visibleWriteups;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (w) => (w.employeeName || "").toLowerCase().includes(q) || (w.categoryLabel || "").toLowerCase().includes(q)
      );
    }
    return sortByKey(rows, sort);
  }, [visibleWriteups, searchQuery, sort]);

  // ── Row selection ──
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((w) => selectedIds.has(w._id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      return new Set(filtered.map((w) => w._id));
    });
  };

  const downloadCombinedPdf = async () => {
    if (selectedIds.size === 0) return;
    setDownloadingPdf(true);
    try {
      // Preserve current table order (respects the active sort) rather
      // than Set insertion order.
      const ids = filtered.filter((w) => selectedIds.has(w._id)).map((w) => w._id);
      const res = await fetch("/api/writeups/combined-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to generate combined PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Writeups_Combined_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notify.error(err.message || "Failed to download combined PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const summary = useMemo(() => {
    const pending = visibleWriteups.filter((w) => w.status === "draft").length;
    const pendingReviewList = visibleWriteups.filter(isPendingReview);
    const escalated = pendingReviewList.length;
    const oldestEscalatedDays = pendingReviewList.reduce(
      (max, w) => Math.max(max, daysSince(w.reviewQueuedAt || w.escalatedAt)),
      0
    );
    return { total: visibleWriteups.length, pending, escalated, oldestEscalatedDays };
  }, [visibleWriteups]);

  // ── Live recommendation preview (also carries corrective-action auto-fill
  // and prior verbal-coaching context) ──
  useEffect(() => {
    if (!form.employeeId || !form.categoryId) {
      setRecommendation(null);
      return;
    }
    setLoadingRec(true);
    const params = new URLSearchParams({ employeeId: form.employeeId, categoryId: form.categoryId });
    if (form.subCategory) params.set("subCategory", form.subCategory);
    fetch(`/api/writeups/recommend?${params.toString()}`)
      .then((r) => r.json())
      .then((rec) => {
        setRecommendation(rec);
        setLevelOverride(rec.recommended || "");
        // Auto-fill Plan for Improvement / Consequences from the category's
        // corrective-action template. A field is only left alone if it's
        // non-empty AND wasn't itself system-generated — i.e. the manager
        // actually typed something. Otherwise (blank, or still holding a
        // stale auto-fill from a category they've since changed away from)
        // it's safe to replace with the new category's template.
        const keepPlan = !autoFilled.planForImprovement && !!form.planForImprovement;
        const keepConsequences = !autoFilled.consequences && !!form.consequences;
        setForm((prev: any) => ({
          ...prev,
          planForImprovement: keepPlan ? prev.planForImprovement : (rec.correctiveAction?.planForImprovement || ""),
          consequences: keepConsequences ? prev.consequences : (rec.correctiveAction?.consequences || ""),
        }));
        setAutoFilled({ planForImprovement: !keepPlan, consequences: !keepConsequences });
      })
      .catch(() => setRecommendation(null))
      .finally(() => setLoadingRec(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.employeeId, form.categoryId, form.subCategory]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setRecommendation(null);
    setAutoFilled({ planForImprovement: false, consequences: false });
    setLevelOverride("");
    setOverrideReason("");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.employeeId) {
      notify.error("Employee is required");
      return;
    }
    if (!form.categoryId) {
      notify.error("Category is required");
      return;
    }
    const isOverride = recommendation && levelOverride !== recommendation.recommended;
    if (isOverride && overrideReason.trim().length < 10) {
      notify.error("Override reason must be at least 10 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/writeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          warningLevelOverride: isOverride ? levelOverride : undefined,
          warningLevelOverrideReason: isOverride ? overrideReason : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create write-up");
      notify.success("Write-up saved as draft");
      setCreateOpen(false);
      await load();
      openDetail(json.writeup);
    } catch (err: any) {
      notify.error(err.message || "Failed to create write-up");
    } finally {
      setCreating(false);
    }
  };

  // ── Detail / sign ──
  const openDetail = (w: Writeup) => {
    setSelected(w);
    setManagerName(w.managerSignature?.name || w.managerName || "");
    setManagerSig(w.managerSignature?.signatureImage || "");
    setEmployeeSignerName(w.employeeSignature?.name || w.employeeName || "");
    setEmployeeSig(w.employeeSignature?.signatureImage || "");
    setRefuseOpen(false);
    setRefuseNote("");
    setWitnessName("");
    setWitnessSig("");
    setReviewDecision("confirmed");
    setResolveOutcome("");
    setResolveSuspensionDays("");
    setResolveNotes("");
    setEditMode(false);
    setEditForm({
      incidentDate: w.incidentDate ? new Date(w.incidentDate).toISOString().split("T")[0] : "",
      description: w.description || "",
      planForImprovement: w.planForImprovement || "",
      consequences: w.consequences || "",
      warningLevel: w.warningLevel,
      warningLevelOverrideReason: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const isOverride = editForm.warningLevel !== selected.warningLevelAuto;
    if (isOverride && (!editForm.warningLevelOverrideReason || editForm.warningLevelOverrideReason.trim().length < 10)) {
      notify.error("Override reason must be at least 10 characters");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentDate: editForm.incidentDate,
          description: editForm.description,
          planForImprovement: editForm.planForImprovement,
          consequences: editForm.consequences,
          warningLevel: editForm.warningLevel,
          warningLevelOverrideReason: isOverride ? editForm.warningLevelOverrideReason : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save changes");
      notify.success("Write-up updated");
      setEditMode(false);
      await refreshSelected(selected._id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  };

  const refreshSelected = async (id: string) => {
    const res = await fetch(`/api/writeups/${id}`);
    const json = await res.json();
    if (res.ok) {
      setSelected(json.writeup);
      setWriteups((prev) => prev.map((w) => (w._id === id ? json.writeup : w)));
    }
  };

  const handleSaveManagerSignature = async () => {
    if (!selected) return;
    if (!managerName.trim() || !managerSig) {
      notify.error("Your name and signature are required");
      return;
    }
    setSavingSign(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerSignature: { name: managerName.trim(), signatureImage: managerSig } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sign");
      notify.success("Issued — hand the device to the employee to sign");
      await refreshSelected(selected._id);
    } catch (err: any) {
      notify.error(err.message || "Failed to sign");
    } finally {
      setSavingSign(false);
    }
  };

  const handleSaveEmployeeSignature = async () => {
    if (!selected) return;
    if (!employeeName.trim() || !employeeSig) {
      notify.error("Employee name and signature are required");
      return;
    }
    setSavingSign(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeSignature: { name: employeeName.trim(), signatureImage: employeeSig } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sign");
      notify.success("Signed — sent for manager review");
      await refreshSelected(selected._id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to sign");
    } finally {
      setSavingSign(false);
    }
  };

  const handleRefuse = async () => {
    if (!selected) return;
    if (!refuseNote.trim()) {
      notify.error("A short note explaining the refusal is required");
      return;
    }
    setSavingSign(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}/refuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: refuseNote.trim(), witnessName: witnessName.trim(), witnessSignatureImage: witnessSig }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record refusal");
      notify.success("Refusal recorded — sent for manager review");
      setRefuseOpen(false);
      await refreshSelected(selected._id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to record refusal");
    } finally {
      setSavingSign(false);
    }
  };

  const handleUploadSigned = async (file: File) => {
    if (!selected) return;
    setUploadingSigned(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", "Write-Ups");
      const uploadRes = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || "Upload failed");

      const res = await fetch(`/api/writeups/${selected._id}/upload-signed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: uploadJson.url, name: file.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to attach signed copy");
      notify.success("Signed copy uploaded — sent for manager review");
      await refreshSelected(selected._id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to upload signed copy");
    } finally {
      setUploadingSigned(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selected) return;
    if (reviewDecision === "escalated") {
      if (!resolveOutcome) {
        notify.error("Select an outcome");
        return;
      }
      if (resolveNotes.trim().length < 10) {
        notify.error("Notes must be at least 10 characters when escalating");
        return;
      }
      if (resolveOutcome === "suspended" && (!resolveSuspensionDays || Number(resolveSuspensionDays) <= 0)) {
        notify.error("Enter the number of suspension days");
        return;
      }
    }
    setResolvingEscalation(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: reviewDecision,
          outcome: reviewDecision === "escalated" ? resolveOutcome : undefined,
          notes: resolveNotes.trim(),
          suspensionDays: reviewDecision === "escalated" && resolveOutcome === "suspended" ? Number(resolveSuspensionDays) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record review");
      notify.success(reviewDecision === "confirmed" ? "Confirmed as issued — closed" : "Escalated and closed");
      await refreshSelected(selected._id);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to record review");
    } finally {
      setResolvingEscalation(false);
    }
  };

  // Drafts (or historical bulk-imported records) only — the server
  // enforces this too; signed/escalated/closed write-ups are locked to
  // preserve the audit trail.
  const canDeleteSelected = !!selected && (selected.status === "draft" || selected.isHistorical);

  const handleDeleteWriteup = async () => {
    if (!selected) return;
    if (!confirm(`Delete this write-up for ${selected.employeeName}? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/writeups/${selected._id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete write-up");
      notify.success("Write-up deleted");
      setSelected(null);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete write-up");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary rounded cursor-pointer" checked={includeTerminated} onChange={(e) => setIncludeTerminated(e.target.checked)} />
          Include terminated employees
        </label>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Write-Up
        </Button>
      </div>

      {!workbenchMode && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{summary.total}</div><div className="text-xs text-muted-foreground">Total write-ups</div></CardContent></Card>
          <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-amber-600">{summary.pending}</div><div className="text-xs text-muted-foreground">Awaiting signature</div></CardContent></Card>
          <Card
            className={cn("cursor-pointer transition-colors", summary.escalated > 0 && "border-red-300 bg-red-50/60 dark:bg-red-950/20")}
            onClick={() => setStatusFilter("pending_review")}
          >
            <CardContent className="pt-0">
              <div className="flex items-center gap-1.5">
                {summary.escalated > 0 && <AlertTriangle className="h-4 w-4 text-red-600" />}
                <div className="text-2xl font-bold text-red-600">{summary.escalated}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Pending manager review{summary.escalated > 0 ? ` — oldest ${summary.oldestEscalatedDays}d` : ""}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!workbenchMode && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
            <Button size="sm" variant={statusFilter === "draft" ? "default" : "outline"} onClick={() => setStatusFilter("draft")}>Awaiting Signature</Button>
            <Button
              size="sm"
              variant={statusFilter === "pending_review" ? "default" : "outline"}
              className={statusFilter !== "pending_review" && summary.escalated > 0 ? "border-red-300 text-red-700 hover:text-red-700" : ""}
              onClick={() => setStatusFilter("pending_review")}
            >
              Pending Manager Review{summary.escalated > 0 ? ` (${summary.escalated})` : ""}
            </Button>
            <Button size="sm" variant={statusFilter === "closed" ? "default" : "outline"} onClick={() => setStatusFilter("closed")}>Reviewed</Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.description}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }}
              className="w-40"
            />
          </div>
          <div className="flex gap-1">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant={activePreset === p.days ? "default" : "ghost"}
                onClick={() => applyDatePreset(p.days)}
              >
                {p.label}
              </Button>
            ))}
            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" onClick={clearDateRange}>All time</Button>
            )}
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <Label htmlFor="search">Search</Label>
            <Input id="search" placeholder="Employee or category..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={downloadCombinedPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Download Combined PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary rounded cursor-pointer"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <SortableHeader label="Date" sortKey="incidentDate" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Employee" sortKey="employeeName" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Category" sortKey="categoryLabel" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Warning Level" sortKey="warningLevel" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableHeader label={workbenchMode ? "Issued By" : "Manager"} sortKey="managerName" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{emptyMessage}</td></tr>
            )}
            {filtered.map((w) => (
              <tr
                key={w._id}
                className={cn("border-t hover:bg-muted/30", isPendingReview(w) && "border-l-2 border-l-red-500 bg-red-50/40 dark:bg-red-950/10")}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary rounded cursor-pointer"
                    checked={selectedIds.has(w._id)}
                    onChange={() => toggleSelectOne(w._id)}
                    aria-label={`Select write-up for ${w.employeeName}`}
                  />
                </td>
                <td className="cursor-pointer px-3 py-2" onClick={() => openDetail(w)}>{fmtDate(w.incidentDate)}</td>
                <td className="cursor-pointer px-3 py-2 font-medium" onClick={() => openDetail(w)}>{w.employeeName}</td>
                <td className="cursor-pointer px-3 py-2" onClick={() => openDetail(w)}><Badge variant="outline">{w.categoryLabel}</Badge></td>
                <td className="cursor-pointer px-3 py-2" onClick={() => openDetail(w)}>
                  <Badge className={WARNING_LEVEL_COLORS[w.warningLevel] || ""}>{WARNING_LEVEL_LABELS[w.warningLevel] || w.warningLevel}</Badge>
                </td>
                <td className="cursor-pointer px-3 py-2 text-xs" onClick={() => openDetail(w)}>
                  {isPendingReview(w) && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-red-600" />}
                  <span className={isPendingReview(w) ? "font-medium text-red-700 dark:text-red-400" : ""}>{statusLabel(w)}</span>
                  {isPendingReview(w) && <span className="ml-1 text-muted-foreground">({daysSince(w.reviewQueuedAt || w.escalatedAt)}d)</span>}
                </td>
                <td className="cursor-pointer px-3 py-2 text-muted-foreground" onClick={() => openDetail(w)}>{w.managerName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── New Write-Up dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>New Write-Up</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Employee *</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) => {
                  const emp = visibleEmployees.find((e) => e._id === v);
                  setForm({ ...form, employeeId: v, transporterId: emp?.transporterId || "", employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "" });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {visibleEmployees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Category *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v, subCategory: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.description}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Incident Date</Label>
                <Input type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
              </div>
            </div>

            {!!recommendation?.availableSubCategories?.length && (
              <div className="flex flex-col gap-1.5">
                <Label>Specific Issue</Label>
                <Select value={form.subCategory} onValueChange={(v) => setForm({ ...form, subCategory: v })}>
                  <SelectTrigger><SelectValue placeholder="Select the specific issue" /></SelectTrigger>
                  <SelectContent>
                    {recommendation.availableSubCategories.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">This category has more than one corrective-action template — pick the specific issue so the right one auto-fills below.</p>
              </div>
            )}

            {loadingRec && <div className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Checking prior history...</div>}

            {recommendation && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Prior Write-Ups ({recommendation.priorCount})</div>
                {recommendation.priors.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {recommendation.priors.map((p, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{fmtDate(p.incidentDate)}</span>
                        <Badge variant="outline" className="text-xs">{WARNING_LEVEL_LABELS[p.warningLevel] || p.warningLevel}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No prior write-ups for this category.</p>
                )}
                <p className="text-xs text-muted-foreground">{recommendation.rationale}</p>
                <div className="flex flex-col gap-1.5 pt-1">
                  <Label className="text-xs">Warning Level</Label>
                  <Select value={levelOverride} onValueChange={setLevelOverride}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WARNING_LEVELS.map((l) => <SelectItem key={l} value={l}>{WARNING_LEVEL_LABELS[l]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {levelOverride !== recommendation.recommended && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Reason for override (required)</Label>
                    <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} placeholder="Explain why you're changing the recommended level..." />
                  </div>
                )}
              </div>
            )}

            {recommendation && recommendation.verbalCoachingContext && recommendation.verbalCoachingContext.count > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-900 dark:bg-cyan-950/20">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-cyan-800 dark:text-cyan-400">
                  <MessageSquare className="h-3.5 w-3.5" /> Prior Verbal Coaching ({recommendation.verbalCoachingContext.count}) — reference only
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {recommendation.verbalCoachingContext.items.slice(0, 5).map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate text-muted-foreground">{fmtDate(v.coachingDate)}{v.notes ? ` — ${v.notes}` : ""}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">{v.status === "unable_to_coach" ? "Unable to Coach" : v.status === "scheduled" ? "Scheduled" : "Completed"}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-cyan-800/70 dark:text-cyan-400/70">Not counted toward the warning level above — verbal coachings are informal reference context only.</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plan for Improvement</Label>
              <Textarea
                value={form.planForImprovement}
                onChange={(e) => {
                  setForm({ ...form, planForImprovement: e.target.value });
                  setAutoFilled((prev) => ({ ...prev, planForImprovement: false }));
                }}
                rows={2}
              />
              {form.categoryId && recommendation && !recommendation.correctiveAction?.planForImprovement && !recommendation.availableSubCategories?.length && (
                <p className="text-xs text-muted-foreground">
                  No template configured for this category, so nothing auto-filled — you can type one here, or{" "}
                  <Link href="/admin/writeup-settings" target="_blank" className="text-primary underline">add a reusable template</Link> for next time.
                </p>
              )}
              {form.categoryId && !!recommendation?.availableSubCategories?.length && !form.subCategory && (
                <p className="text-xs text-muted-foreground">
                  Select the specific issue above to auto-fill this field.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Consequences</Label>
              <Textarea
                value={form.consequences}
                onChange={(e) => {
                  setForm({ ...form, consequences: e.target.value });
                  setAutoFilled((prev) => ({ ...prev, consequences: false }));
                }}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail / Sign dialog ── */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-8">
            <DialogTitle>Write-Up — {selected?.employeeName}</DialogTitle>
            {selected && selected.status === "draft" && !editMode && (
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                <FileEdit className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </DialogHeader>
          {selected && !editMode && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground">Category</div><div>{selected.categoryLabel}</div></div>
                <div><div className="text-muted-foreground">Date</div><div>{fmtDate(selected.incidentDate)}</div></div>
                <div><div className="text-muted-foreground">Warning Level</div><Badge className={WARNING_LEVEL_COLORS[selected.warningLevel] || ""}>{WARNING_LEVEL_LABELS[selected.warningLevel]}</Badge></div>
                <div><div className="text-muted-foreground">Status</div><div>{statusLabel(selected)}</div></div>
              </div>

              {selected.warningLevelOverrideReason && (
                <div className="rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  Level overridden from {WARNING_LEVEL_LABELS[selected.warningLevelAuto]} — reason: {selected.warningLevelOverrideReason}
                </div>
              )}

              {isPendingReview(selected) && (
                <div className="flex flex-col gap-3 rounded-md border border-red-300 bg-red-50/60 p-3 dark:bg-red-950/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                      Awaiting Manager Review ({daysSince(selected.reviewQueuedAt || selected.escalatedAt)} day{daysSince(selected.reviewQueuedAt || selected.escalatedAt) === 1 ? "" : "s"} pending)
                    </div>
                  </div>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80">
                    The employee has acknowledged this write-up ({selected.acknowledgmentType === "refused" ? "refused to sign" : selected.acknowledgmentType === "uploaded_signed_copy" ? "signed paper copy uploaded" : "signed"}). A manager needs to confirm it was handled correctly, or escalate.
                  </p>

                  {canApprove ? (
                    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-background p-2.5 dark:border-red-900">
                      <Label className="text-xs">Decision *</Label>
                      <Select value={reviewDecision} onValueChange={setReviewDecision}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REVIEW_DECISIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {reviewDecision === "escalated" && (
                        <>
                          <Label className="text-xs">Outcome *</Label>
                          <Select value={resolveOutcome} onValueChange={setResolveOutcome}>
                            <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                            <SelectContent>
                              {ESCALATION_OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {resolveOutcome === "suspended" && (
                            <>
                              <Label className="text-xs">Suspension Days *</Label>
                              <Input type="number" min={1} value={resolveSuspensionDays} onChange={(e) => setResolveSuspensionDays(e.target.value)} className="w-24" />
                            </>
                          )}
                          <Label className="text-xs">Notes * (min 10 characters)</Label>
                        </>
                      )}
                      {reviewDecision === "confirmed" && <Label className="text-xs">Notes (optional)</Label>}
                      <Textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={2} placeholder="Document the decision and rationale..." />
                      <Button size="sm" className="self-start bg-red-600 text-white hover:bg-red-700" onClick={handleSubmitReview} disabled={resolvingEscalation}>
                        {resolvingEscalation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {reviewDecision === "confirmed" ? "Confirm & Close" : "Escalate & Close"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs italic text-red-700/80 dark:text-red-400/80">Awaiting review from a Manager with Approve access to Write-Ups.</p>
                  )}
                </div>
              )}

              {selected.status === "closed" && selected.managerReview && (
                <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Manager Review</div>
                  <div className="font-medium">
                    {selected.managerReview.decision === "confirmed"
                      ? "Confirmed as issued"
                      : `Escalated — ${ESCALATION_OUTCOME_LABELS[selected.managerReview.outcome || ""] || selected.managerReview.outcome}`}
                    {selected.managerReview.outcome === "suspended" && selected.managerReview.suspensionDays ? ` — ${selected.managerReview.suspensionDays} day${selected.managerReview.suspensionDays === 1 ? "" : "s"}` : ""}
                  </div>
                  {selected.managerReview.notes && <p className="whitespace-pre-wrap text-muted-foreground">{selected.managerReview.notes}</p>}
                  <p className="text-xs text-muted-foreground">Reviewed by {selected.managerReview.reviewedBy} on {fmtDate(selected.managerReview.reviewedAt)}</p>
                </div>
              )}

              {selected.status === "closed" && !selected.managerReview && selected.escalation && (
                <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Escalation Resolution (legacy)</div>
                  <div className="font-medium">
                    {ESCALATION_OUTCOME_LABELS[selected.escalation.outcome] || selected.escalation.outcome}
                    {selected.escalation.outcome === "suspended" && selected.escalation.suspensionDays ? ` — ${selected.escalation.suspensionDays} day${selected.escalation.suspensionDays === 1 ? "" : "s"}` : ""}
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{selected.escalation.notes}</p>
                  <p className="text-xs text-muted-foreground">Resolved by {selected.escalation.resolvedBy} on {fmtDate(selected.escalation.resolvedAt)}</p>
                </div>
              )}

              {selected.description && (
                <div className="text-sm"><div className="text-muted-foreground text-xs uppercase">Description</div><p className="whitespace-pre-wrap">{selected.description}</p></div>
              )}
              {selected.planForImprovement && (
                <div className="text-sm"><div className="text-muted-foreground text-xs uppercase">Plan for Improvement</div><p className="whitespace-pre-wrap">{selected.planForImprovement}</p></div>
              )}
              {selected.consequences && (
                <div className="text-sm"><div className="text-muted-foreground text-xs uppercase">Consequences</div><p className="whitespace-pre-wrap">{selected.consequences}</p></div>
              )}

              {selected.priorWriteups.length > 0 && (
                <div className="rounded-md border p-3">
                  <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Prior {selected.categoryLabel} write-ups</div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {selected.priorWriteups.map((p, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{fmtDate(p.incidentDate)}</span>
                        <Badge variant="outline" className="text-xs">{WARNING_LEVEL_LABELS[p.warningLevel] || p.warningLevel}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.priorVerbalCoachings && selected.priorVerbalCoachings.length > 0 && (
                <div className="rounded-md border border-cyan-200 bg-cyan-50/40 p-3 dark:border-cyan-900 dark:bg-cyan-950/10">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-cyan-800 dark:text-cyan-400">
                    <MessageSquare className="h-3.5 w-3.5" /> Prior verbal coaching on file
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {selected.priorVerbalCoachings.map((v, i) => (
                      <li key={i} className="text-muted-foreground">{fmtDate(v.coachingDate)} — {v.categoryLabels.join(", ")}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <a href={`/api/writeups/${selected._id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><FileText className="h-4 w-4" /> View PDF</Button>
                </a>
                <a href={`/api/writeups/${selected._id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><Printer className="h-4 w-4" /> Print</Button>
                </a>
              </div>

              {selected.status === "draft" && (
                <div className="flex flex-col gap-4 rounded-md border p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Issue &amp; Sign In Person</div>

                  {!selected.managerSignature?.signatureImage ? (
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs">Issued By (Your Name)</Label>
                      <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} />
                      <SignaturePad value={managerSig} onChange={setManagerSig} label="Issuer Signature" height={100} />
                      <Button size="sm" onClick={handleSaveManagerSignature} disabled={savingSign}>
                        {savingSign ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Issuer Signature
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-emerald-600">Issued by {selected.managerSignature.name} on {fmtDate(selected.managerSignature.signedAt)}</div>

                      {!refuseOpen ? (
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs">Now hand the device to the employee — Employee Name</Label>
                          <Input value={employeeName} onChange={(e) => setEmployeeSignerName(e.target.value)} />
                          <SignaturePad value={employeeSig} onChange={setEmployeeSig} label="Employee Signature" height={100} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEmployeeSignature} disabled={savingSign}>
                              {savingSign ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign & Close
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRefuseOpen(true)}>
                              <ThumbsDown className="h-4 w-4" /> Employee Refuses to Sign
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 p-2">
                          <Label className="text-xs">Refusal note (required)</Label>
                          <Textarea value={refuseNote} onChange={(e) => setRefuseNote(e.target.value)} rows={2} placeholder="Describe the circumstance..." />
                          <Label className="text-xs">Witness Name (optional)</Label>
                          <Input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />
                          {witnessName && <SignaturePad value={witnessSig} onChange={setWitnessSig} label="Witness Signature" height={80} />}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setRefuseOpen(false)}>Cancel</Button>
                            <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRefuse} disabled={savingSign}>
                              {savingSign ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Record Refusal
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex flex-col gap-2 border-t pt-3">
                    <Label className="text-xs">Or: print, get it signed on paper, then upload the signed copy</Label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,.pdf" disabled={uploadingSigned} onChange={(e) => e.target.files?.[0] && handleUploadSigned(e.target.files[0])} />
                      {uploadingSigned && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>
                </div>
              )}

              {selected.refusal?.refused && (
                <div className="rounded-md border border-destructive/40 p-3 text-sm">
                  <div className="font-medium text-destructive">Employee refused to sign</div>
                  <p className="text-muted-foreground">{selected.refusal.note}</p>
                  {selected.refusal.witnessName && <p className="text-xs text-muted-foreground">Witness: {selected.refusal.witnessName}</p>}
                </div>
              )}

              {selected.attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs uppercase text-muted-foreground">Signed Copies</Label>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachments.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:underline">
                        <Download className="h-3 w-3" /> {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {isSuperAdmin && canDeleteSelected ? (
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDeleteWriteup} disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
                  </Button>
                ) : isSuperAdmin ? (
                  <span className="text-xs italic text-muted-foreground">Signed/closed write-ups can't be deleted — preserved for the audit trail.</span>
                ) : <span />}
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          )}

          {selected && editMode && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground">Category</div><div>{selected.categoryLabel} <span className="text-xs text-muted-foreground">(not editable)</span></div></div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Incident Date</Label>
                  <Input type="date" value={editForm.incidentDate} onChange={(e) => setEditForm({ ...editForm, incidentDate: e.target.value })} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Warning Level</Label>
                <Select value={editForm.warningLevel} onValueChange={(v) => setEditForm({ ...editForm, warningLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WARNING_LEVELS.map((l) => <SelectItem key={l} value={l}>{WARNING_LEVEL_LABELS[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {editForm.warningLevel !== selected.warningLevelAuto && (
                  <>
                    <Label className="text-xs">Reason for override (required)</Label>
                    <Textarea value={editForm.warningLevelOverrideReason} onChange={(e) => setEditForm({ ...editForm, warningLevelOverrideReason: e.target.value })} rows={2} placeholder="Explain why you're changing the recommended level..." />
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Plan for Improvement</Label>
                <Textarea value={editForm.planForImprovement} onChange={(e) => setEditForm({ ...editForm, planForImprovement: e.target.value })} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Consequences</Label>
                <Textarea value={editForm.consequences} onChange={(e) => setEditForm({ ...editForm, consequences: e.target.value })} rows={2} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={savingEdit}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
