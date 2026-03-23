"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useDataStore } from "@/hooks/use-data-store";
import {
  Search,
  FileWarning,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
  User,
  IdCard,
  FileText,
  BookOpen,
  CreditCard,
  ClipboardCheck,
  FlaskConical,
  Upload,
  Download,
  Eye,
  X,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuditEmployee {
  _id: string;
  firstName: string;
  lastName: string;
  transporterId?: string;
  dlExpiration?: string;
  offerLetterFile?: string;
  handbookFile?: string;
  driversLicenseFile?: string;
  i9File?: string;
  drugTestFile?: string;
  type?: string;
  phoneNumber?: string;
  profileImage?: string;
}

type DocField = "offerLetterFile" | "handbookFile" | "driversLicenseFile" | "i9File" | "drugTestFile";

const DOC_FIELDS: { key: DocField; label: string; short: string; icon: any }[] = [
  { key: "offerLetterFile", label: "Offer Letter", short: "Offer Letter", icon: FileText },
  { key: "handbookFile", label: "Employee Handbook", short: "Handbook", icon: BookOpen },
  { key: "driversLicenseFile", label: "Driver's License", short: "DL File", icon: CreditCard },
  { key: "i9File", label: "I-9 Form", short: "I-9", icon: ClipboardCheck },
  { key: "drugTestFile", label: "Drug Test Results", short: "Drug Test", icon: FlaskConical },
];

type SortField = "name" | "dlExpiration" | "issues";
type SortDir = "asc" | "desc";

export default function EmployeeAuditPage() {
  const store = useDataStore();
  const [employees, setEmployees] = useState<AuditEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("issues");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEmpId, setPreviewEmpId] = useState<string | null>(null);
  const [previewField, setPreviewField] = useState<DocField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ empId: string; field: DocField } | null>(null);
  const router = useRouter();
  const { setRightContent } = useHeaderActions();

  // ── Mount search in header ──
  useEffect(() => {
    setRightContent(
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 text-sm"
        />
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent]);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        if (employees.length === 0) setLoading(true);
        const res = await fetch("/api/admin/employees?filter=audit&limit=9999&terminated=false");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.records || data || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  // ── Seed from store for instant load ──
  const storeAudit = store.hrAudit as any;
  useEffect(() => {
    if (Array.isArray(storeAudit) && storeAudit.length > 0 && employees.length === 0) {
      setEmployees(storeAudit);
    }
  }, [storeAudit]);

  const now = new Date();

  const enriched = useMemo(() => {
    return employees.map((emp) => {
      const issues: string[] = [];
      const dlExp = emp.dlExpiration ? new Date(emp.dlExpiration) : null;
      const dlExpired = dlExp ? dlExp <= now : false;

      if (dlExpired) issues.push("DL Expired");
      if (!emp.transporterId) issues.push("No Transporter ID");
      if (!emp.offerLetterFile) issues.push("No Offer Letter");
      if (!emp.handbookFile) issues.push("No Handbook");
      if (!emp.driversLicenseFile) issues.push("No Driver's License");
      if (!emp.i9File) issues.push("No I-9");
      if (!emp.drugTestFile) issues.push("No Drug Test");

      return { ...emp, issues, dlExpired, dlExp, issueCount: issues.length };
    });
  }, [employees]);

  const filtered = useMemo(() => {
    if (!search) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        (e.transporterId || "").toLowerCase().includes(q) ||
        (e.phoneNumber || "").includes(q)
    );
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "dlExpiration":
          cmp = (a.dlExp?.getTime() || 0) - (b.dlExp?.getTime() || 0);
          break;
        case "issues":
          cmp = a.issueCount - b.issueCount;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const kpi = useMemo(() => {
    const dlExpired = enriched.filter((e) => e.dlExpired).length;
    const noTransporter = enriched.filter((e) => !e.transporterId).length;
    const noOffer = enriched.filter((e) => !e.offerLetterFile).length;
    const noHandbook = enriched.filter((e) => !e.handbookFile).length;
    const noDL = enriched.filter((e) => !e.driversLicenseFile).length;
    const noI9 = enriched.filter((e) => !e.i9File).length;
    const noDrug = enriched.filter((e) => !e.drugTestFile).length;
    return { dlExpired, noTransporter, noOffer, noHandbook, noDL, noI9, noDrug, total: enriched.length };
  }, [enriched]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Upload handler ──
  const triggerUpload = useCallback((empId: string, field: DocField) => {
    uploadTargetRef.current = { empId, field };
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetRef.current) return;

    const { empId, field } = uploadTargetRef.current;
    const uploadKey = `${empId}-${field}`;
    setUploading(uploadKey);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/admin/upload?folder=symx-systems/employees/documents", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.secure_url || uploadData.url;

      const updateRes = await fetch(`/api/admin/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: fileUrl }),
      });
      if (!updateRes.ok) throw new Error("Failed to save");

      setEmployees((prev) =>
        prev.map((emp) => (emp._id === empId ? { ...emp, [field]: fileUrl } : emp))
      );

      const label = DOC_FIELDS.find((d) => d.key === field)?.label || field;
      toast.success(`${label} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const openPreview = (url: string, label: string, empId: string, field: DocField) => {
    setPreviewUrl(url);
    setPreviewLabel(label);
    setPreviewEmpId(empId);
    setPreviewField(field);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewLabel("");
    setPreviewEmpId(null);
    setPreviewField(null);
  };

  const handleDeleteFile = async () => {
    if (!previewEmpId || !previewField) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/employees/${previewEmpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [previewField]: "" }),
      });
      if (!res.ok) throw new Error("Failed to delete");

      setEmployees((prev) =>
        prev.map((emp) => (emp._id === previewEmpId ? { ...emp, [previewField!]: "" } : emp))
      );

      const label = DOC_FIELDS.find((d) => d.key === previewField)?.label || previewField;
      toast.success(`${label} removed`);
      closePreview();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={cn(
        "h-3 w-3 ml-1 inline-block transition-colors",
        sortField === field ? "text-primary" : "text-muted-foreground/40"
      )}
    />
  );

  // ── Doc cell for table ──
  const DocCell = ({ emp, field }: { emp: AuditEmployee; field: DocField }) => {
    const url = emp[field];
    const isUploadingThis = uploading === `${emp._id}-${field}`;
    const label = DOC_FIELDS.find((d) => d.key === field)?.label || field;

    if (isUploadingThis) {
      return (
        <div className="flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      );
    }

    if (url) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); openPreview(url, `${emp.firstName} ${emp.lastName} — ${label}`, emp._id, field); }}
          className="flex items-center justify-center group/doc"
          title="Click to preview"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover/doc:scale-110 transition-transform" />
        </button>
      );
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); triggerUpload(emp._id, field); }}
        className="flex items-center justify-center group/upload"
        title="Click to upload"
      >
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors">
          <Upload className="h-3 w-3 text-red-500" />
          <span className="text-[9px] font-bold text-red-500">Upload</span>
        </div>
      </button>
    );
  };

  // ── Doc pill for mobile card ──
  const DocPill = ({ emp, field, label, icon: Icon }: { emp: AuditEmployee; field: DocField; label: string; icon: any }) => {
    const url = emp[field];
    const isUploadingThis = uploading === `${emp._id}-${field}`;

    if (isUploadingThis) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[10px] font-bold text-primary">Uploading...</span>
        </div>
      );
    }

    if (url) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); openPreview(url, `${emp.firstName} ${emp.lastName} — ${label}`, emp._id, field); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{label}</span>
        </button>
      );
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); triggerUpload(emp._id, field); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20 border-dashed hover:bg-red-500/15 transition-colors group"
      >
        <Upload className="h-3 w-3 text-red-400 group-hover:text-red-500 transition-colors" />
        <span className="text-[10px] font-bold text-red-400 group-hover:text-red-500 transition-colors">{label}</span>
      </button>
    );
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url) || /\/image\/upload\/.*(?!\.(pdf|doc|docx))/i.test(url) && !/\.(pdf|doc|docx)/i.test(url);

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading audit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
        onChange={handleFileChange}
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        {[
          { label: "Total Flagged", value: kpi.total, color: "text-orange-500", bg: "from-orange-500/20 to-red-500/20", icon: FileWarning },
          { label: "DL Expired", value: kpi.dlExpired, color: "text-red-500", bg: "from-red-500/20 to-rose-500/20", icon: CreditCard },
          { label: "No Transporter", value: kpi.noTransporter, color: "text-purple-500", bg: "from-purple-500/20 to-violet-500/20", icon: IdCard },
          { label: "No Offer Letter", value: kpi.noOffer, color: "text-blue-500", bg: "from-blue-500/20 to-indigo-500/20", icon: FileText },
          { label: "No Handbook", value: kpi.noHandbook, color: "text-teal-500", bg: "from-teal-500/20 to-cyan-500/20", icon: BookOpen },
          { label: "No DL File", value: kpi.noDL, color: "text-amber-500", bg: "from-amber-500/20 to-yellow-500/20", icon: CreditCard },
          { label: "No I-9", value: kpi.noI9, color: "text-rose-500", bg: "from-rose-500/20 to-pink-500/20", icon: ClipboardCheck },
          { label: "No Drug Test", value: kpi.noDrug, color: "text-indigo-500", bg: "from-indigo-500/20 to-blue-500/20", icon: FlaskConical },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/50 bg-card p-2.5 sm:p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className={cn("p-1 sm:p-1.5 rounded-lg bg-gradient-to-br", card.bg)}>
                <card.icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", card.color)} />
              </div>
              <span className={cn("text-lg sm:text-xl font-black", card.color)}>{card.value}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ══════════════ DESKTOP TABLE (hidden on mobile) ══════════════ */}
      <div className="hidden md:block rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border/50 bg-muted/80 backdrop-blur-sm">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground w-[40px]">#</th>
                <th
                  className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("name")}
                >
                  Employee <SortIcon field="name" />
                </th>
                <th
                  className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("dlExpiration")}
                >
                  DL Expiration <SortIcon field="dlExpiration" />
                </th>
                {DOC_FIELDS.map((doc) => (
                  <th key={doc.key} className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {doc.short}
                  </th>
                ))}
                <th
                  className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("issues")}
                >
                  Issues <SortIcon field="issues" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={3 + DOC_FIELDS.length + 1} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500/30" />
                      <p className="text-sm font-semibold text-muted-foreground">All clear!</p>
                      <p className="text-xs text-muted-foreground/70">No employees with compliance issues</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((emp, idx) => {
                  const name = `${emp.firstName} ${emp.lastName}`.toUpperCase();
                  const dlDate = emp.dlExp
                    ? emp.dlExp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—";

                  return (
                    <tr
                      key={emp._id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/hr/${emp._id}`)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {emp.profileImage ? (
                            <img
                              src={emp.profileImage}
                              alt={name}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-border/50"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-xs font-bold text-foreground">{name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-md",
                            emp.dlExpired
                              ? "bg-red-500/10 text-red-500 ring-1 ring-red-500/20"
                              : emp.dlExp
                                ? "text-foreground"
                                : "text-muted-foreground"
                          )}
                        >
                          {emp.dlExpired && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                          {dlDate}
                        </span>
                      </td>
                      {DOC_FIELDS.map((doc) => (
                        <td key={doc.key} className="px-3 py-3 text-center">
                          <DocCell emp={emp} field={doc.key} />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant={emp.issueCount >= 4 ? "destructive" : emp.issueCount >= 2 ? "default" : "secondary"}
                          className="text-[10px] font-black px-2"
                        >
                          {emp.issueCount}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════ MOBILE / TABLET CARDS (hidden on desktop) ══════════════ */}
      <div className="md:hidden space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground/70">No employees with compliance issues</p>
          </div>
        ) : (
          sorted.map((emp) => {
            const name = `${emp.firstName} ${emp.lastName}`.toUpperCase();
            const dlDate = emp.dlExp
              ? emp.dlExp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : null;

            return (
              <div
                key={emp._id}
                className="rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-border transition-colors"
              >
                {/* Card Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/hr/${emp._id}`)}
                >
                  {emp.profileImage ? (
                    <img
                      src={emp.profileImage}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-border/50"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center ring-2 ring-border/30">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {emp.dlExpired ? (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> DL Expired {dlDate}
                        </span>
                      ) : dlDate ? (
                        <span className="text-[10px] text-muted-foreground font-medium">DL: {dlDate}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 font-medium">No DL date</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={emp.issueCount >= 4 ? "destructive" : emp.issueCount >= 2 ? "default" : "secondary"}
                      className="text-[10px] font-black px-2"
                    >
                      {emp.issueCount}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>

                {/* Document Pills */}
                <div className="px-4 pb-3 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {DOC_FIELDS.map((doc) => (
                      <DocPill key={doc.key} emp={emp} field={doc.key} label={doc.short} icon={doc.icon} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── File Preview Dialog ── */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-sm font-bold truncate flex-1">{previewLabel}</DialogTitle>
              <div className="flex items-center gap-2 shrink-0">
                {previewUrl && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                    <a href={previewUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                  onClick={handleDeleteFile}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Delete
                </Button>
                <button
                  onClick={closePreview}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 sm:p-6 overflow-auto max-h-[75vh]">
            {previewUrl && isImage(previewUrl) ? (
              <img
                src={previewUrl}
                alt={previewLabel}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
              />
            ) : previewUrl ? (
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                className="w-full h-[65vh] rounded-lg border border-border/50"
                title={previewLabel}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
