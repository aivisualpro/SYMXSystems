"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INTERVIEWS — ATS PIPELINE PROTOTYPE (v2)
 * ═══════════════════════════════════════════════════════════════════════════
 * Local-only redesign of /hr/interviews. Not linked in the sidebar yet —
 * visit directly at /hr/interviews-v2 to review. Swap it in once it's
 * confirmed to feel right; the live route is untouched.
 *
 * What changed from the original:
 *   1. Grid-of-cards → a real Kanban pipeline board (drag a candidate
 *      between stage columns), the standard ATS pattern.
 *   2. Clicking a candidate opens a detail Sheet with grouped profile
 *      sections (Contact & Availability, Experience, Interview, Documents,
 *      Onboarding) instead of a dense card.
 *   3. Interview Notes is now ONE plain autosaving textarea. The original
 *      page's InterviewNotesRenderer heuristically parsed free text into
 *      Question/Answer blocks — this redesign drops that entirely, per
 *      the explicit ask for "simple text field not the Question and
 *      Answer format."
 * Everything else (Share/QR dialog, CSV import, manual "New Applicant"
 * creation, delete) is reused as-is from the original page's exports —
 * no duplicated logic, no behavior change to those flows.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useHrInterviews, useUpsertInterview, useDeleteInterview } from "@/lib/query/hooks/useHr";
import { useDropdowns } from "@/lib/query/hooks/useShared";
import {
  Search,
  Loader2,
  Upload,
  Plus,
  Trash2,
  Pencil,
  X,
  Share2,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Star,
  MapPin,
  ImagePlus,
  GripVertical,
  User,
  IdCard,
  FileText,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notify } from "@/lib/notify";
import Papa from "papaparse";
import {
  type Interview,
  type DropdownStatus,
  ShareDialog,
  InterviewDialog,
  getStatusColors,
  getStatusIcon,
  getRatingStars,
} from "../interviews/page";

const CHUNK_SIZE = 500;

// Same order as the original page's status tabs. "New" (the model's
// default status, not itself an option in the dropdown) buckets into the
// first column so nothing submitted via the public form is ever invisible.
const TAB_ORDER = [
  "Undecided",
  "Move to Next Step",
  "Waiting on background check",
  "Waiting on Hire",
  "Hired",
  "Rejected",
];

function columnStatusFor(status: string | undefined, knownOrder: string[]): string {
  const s = (status || "").trim();
  if (!s || s.toLowerCase() === "new") return knownOrder[0] || "Undecided";
  const match = knownOrder.find((o) => o.toLowerCase() === s.toLowerCase());
  return match || s;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return "";
  const diffMs = Date.now() - d;
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  CANDIDATE CARD (draggable)
 * ═══════════════════════════════════════════════════════════════════════════ */

function CandidateCard({
  item,
  statusOptions,
  onOpen,
}: {
  item: Interview;
  statusOptions: DropdownStatus[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item._id,
    data: { status: columnStatusFor(item.status, TAB_ORDER) },
  });
  const stars = getRatingStars(item.rating || "");

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "group rounded-xl border border-border/50 bg-card p-3 cursor-pointer transition-all hover:border-border hover:shadow-md",
        isDragging && "opacity-40"
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-[10px] font-black text-white">
          {initials(item.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground truncate">{item.fullName || "Unknown"}</p>
          {item.phoneNumber && (
            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Phone className="h-2.5 w-2.5 shrink-0" /> {item.phoneNumber}
            </p>
          )}
        </div>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to move stage"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.typeOfWork && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {item.typeOfWork}
            </span>
          )}
          {stars ? (
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("h-2.5 w-2.5", n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/15")} />
              ))}
            </span>
          ) : null}
        </div>
        <span className="text-[9px] text-muted-foreground/50 shrink-0">{timeAgo(item.createdAt)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PIPELINE COLUMN (droppable)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PipelineColumn({
  status,
  items,
  colorIndex,
  statusOptions,
  onOpenCandidate,
}: {
  status: string;
  items: Interview[];
  colorIndex: number;
  statusOptions: DropdownStatus[];
  onOpenCandidate: (item: Interview) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colors = getStatusColors(status, colorIndex);
  const Icon = getStatusIcon(status);
  const displayLabel = status === "Move to Next Step" ? "Amazon Onboarding" : status;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[280px] shrink-0 rounded-2xl border transition-colors",
        isOver ? "border-primary/40 bg-primary/[0.03]" : "border-border/40 bg-muted/10"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
        <Icon className={cn("h-3.5 w-3.5", colors.text)} />
        <p className="text-xs font-bold text-foreground truncate flex-1">{displayLabel}</p>
        <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-black", colors.bg, colors.text)}>{items.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px] max-h-[calc(100vh-260px)]">
        {items.length === 0 ? (
          <div className="h-16 rounded-lg border border-dashed border-border/30 flex items-center justify-center text-[10px] text-muted-foreground/30">
            Drop here
          </div>
        ) : (
          items.map((item) => (
            <CandidateCard key={item._id} item={item} statusOptions={statusOptions} onOpen={() => onOpenCandidate(item)} />
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SECTION helper for the detail Sheet
 * ═══════════════════════════════════════════════════════════════════════════ */

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-rose-500" />
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 block mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  CANDIDATE DETAIL SHEET
 * ═══════════════════════════════════════════════════════════════════════════ */

function CandidateDetailSheet({
  item,
  onClose,
  statusOptions,
  onFieldUpdate,
  onStatusChange,
  onDlPhotoUpload,
  onDelete,
}: {
  item: Interview | null;
  onClose: () => void;
  statusOptions: DropdownStatus[];
  onFieldUpdate: (id: string, field: string, value: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDlPhotoUpload: (id: string, file: File) => void;
  onDelete: (id: string) => void;
}) {
  // Local text buffers so typing doesn't refetch/rerender on every
  // keystroke — committed onBlur, same pattern as the rest of the app.
  const [notes, setNotes] = useState(item?.interviewNotes || "");
  const [interviewedBy, setInterviewedBy] = useState(item?.interviewedBy || "");
  const [onboardingNotes, setOnboardingNotes] = useState(item?.onboardingNotes || "");

  useEffect(() => {
    setNotes(item?.interviewNotes || "");
    setInterviewedBy(item?.interviewedBy || "");
    setOnboardingNotes(item?.onboardingNotes || "");
  }, [item?._id]);

  if (!item) return null;
  const stars = getRatingStars(item.rating || "");
  const status = (item.status || "").trim();
  const statusColorIdx = statusOptions.findIndex((o) => o.description.toLowerCase() === status.toLowerCase());
  const colors = getStatusColors(status, statusColorIdx >= 0 ? statusColorIdx : 0);

  const commit = (field: string, value: string, original: string) => {
    if (value.trim() !== (original || "").trim()) onFieldUpdate(item._id, field, value.trim());
  };

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[440px] sm:w-[480px] border-l border-border p-0 flex flex-col bg-card">
        <div className="p-5 border-b border-border bg-gradient-to-br from-rose-500/5 to-transparent shrink-0">
          <SheetHeader className="p-0 space-y-0">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-sm font-black text-white">
                {initials(item.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-bold truncate">{item.fullName || "Unknown"}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black", colors.bg, colors.text)}>
                    {status === "Move to Next Step" ? "Amazon Onboarding" : (status || "Undecided")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(item.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={() => { onDelete(item._id); onClose(); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 shrink-0"
                title="Delete applicant"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500/70" />
              </button>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Section title="Contact & Availability" icon={User}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <p className="text-sm text-foreground flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground/50" />{item.phoneNumber || "—"}</p>
              </Field>
              <Field label="Email">
                <p className="text-sm text-foreground flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 text-muted-foreground/50 shrink-0" />{item.email || "—"}</p>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <p className="text-sm text-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3 text-muted-foreground/50" />{item.workStartDate || "—"}</p>
              </Field>
              <Field label="Type of Work">
                <p className="text-sm text-foreground flex items-center gap-1.5"><Briefcase className="h-3 w-3 text-muted-foreground/50" />{item.typeOfWork || "—"}</p>
              </Field>
            </div>
            {item.workDays && (
              <Field label="Available Days">
                <div className="flex flex-wrap gap-1">
                  {item.workDays.split(",").map((d, i) => d.trim() && (
                    <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                      {d.trim()}
                    </span>
                  ))}
                </div>
              </Field>
            )}
            <Field label="How did you hear?">
              <p className="text-sm text-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3 text-muted-foreground/50" />{item.howDidYouHear || "—"}</p>
            </Field>
          </Section>

          <Section title="Experience" icon={Briefcase}>
            <Field label="Past Experience">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{item.lastEmployerInfo || "—"}</p>
            </Field>
          </Section>

          <Section title="Interview" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interviewed By">
                <Input
                  defaultValue={interviewedBy}
                  onBlur={(e) => commit("interviewedBy", e.target.value, item.interviewedBy || "")}
                  placeholder="Manager name"
                  className="h-8 text-sm"
                />
              </Field>
              <Field label="Rating">
                <div className="flex items-center gap-0.5 h-8">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => onFieldUpdate(item._id, "rating", String(n))} className="transition-transform hover:scale-125">
                      <Star className={cn("h-4 w-4", stars && n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20 hover:text-amber-400/50")} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {/* Plain text field, not a parsed Q&A list — the whole point of this redesign. */}
            <Field label="Interview Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => commit("interviewNotes", notes, item.interviewNotes || "")}
                placeholder="Notes from the interview..."
                rows={6}
                className="resize-y text-sm leading-relaxed"
              />
            </Field>
          </Section>

          <Section title="Documents" icon={IdCard}>
            <Field label="Driver's License Photo">
              {item.dlPhoto ? (
                <a href={item.dlPhoto} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src={item.dlPhoto} alt="DL" className="h-20 w-32 object-cover rounded-lg border border-border/40 hover:border-primary/40 transition-all" />
                </a>
              ) : (
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary cursor-pointer transition-all w-fit">
                  <ImagePlus className="h-3.5 w-3.5" /> Upload photo
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onDlPhotoUpload(item._id, f); e.target.value = ""; }} />
                </label>
              )}
            </Field>
          </Section>

          <Section title="Onboarding" icon={FileText}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Background Check"><p className="text-foreground">{item.backgroundCheckStatus || "—"}</p></Field>
              <Field label="Drug Test"><p className="text-foreground">{item.drugTestStatus || "—"}</p></Field>
              <Field label="Offer Letter"><p className="text-foreground">{item.offerLetterStatus || "—"}</p></Field>
              <Field label="Handbook"><p className="text-foreground">{item.handbookStatus || "—"}</p></Field>
            </div>
            <Field label="Onboarding Notes">
              <Textarea
                value={onboardingNotes}
                onChange={(e) => setOnboardingNotes(e.target.value)}
                onBlur={() => commit("onboardingNotes", onboardingNotes, item.onboardingNotes || "")}
                rows={3}
                className="resize-y text-sm"
                placeholder="Additional onboarding details..."
              />
            </Field>
          </Section>
        </div>

        {/* Pipeline stage controls — same action as dragging the card */}
        <div className="border-t border-border/30 bg-muted/15 p-4 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2">Move to stage</p>
          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map((opt, si) => {
              const isCurrent = status.toLowerCase() === opt.description.toLowerCase();
              const optColors = getStatusColors(opt.description, si);
              const OptIcon = getStatusIcon(opt.description);
              return (
                <button
                  key={opt._id}
                  onClick={() => !isCurrent && onStatusChange(item._id, opt.description)}
                  disabled={isCurrent}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                    isCurrent ? `${optColors.active} cursor-default` : "bg-background border border-border/40 text-muted-foreground hover:border-border hover:bg-muted"
                  )}
                >
                  <OptIcon className="h-3 w-3" />
                  {opt.description === "Move to Next Step" ? "Amazon Onboarding" : opt.description}
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HRInterviewsV2Page() {
  const { data: queryInterviews } = useHrInterviews();
  const { data: queryDropdowns } = useDropdowns();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [statusOptions, setStatusOptions] = useState<DropdownStatus[]>([]);
  const [activeItem, setActiveItem] = useState<Interview | null>(null);
  const [draggingItem, setDraggingItem] = useState<Interview | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  useEffect(() => {
    if (Array.isArray(queryInterviews) && queryInterviews.length > 0 && interviews.length === 0) {
      setInterviews(queryInterviews);
    }
  }, [queryInterviews]);

  useEffect(() => {
    if (Array.isArray(queryDropdowns) && queryDropdowns.length > 0 && statusOptions.length === 0) {
      const opts = queryDropdowns.filter((d: any) => d.type === "interview status" && d.isActive);
      if (opts.length > 0) setStatusOptions(opts);
    }
  }, [queryDropdowns]);

  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=interview status")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStatusOptions(data.filter((d: any) => d.isActive)); })
      .catch(() => {});
  }, []);

  const fetchInterviews = async () => {
    try {
      const res = await fetch("/api/admin/interviews");
      if (res.ok) {
        const data = await res.json();
        setInterviews(Array.isArray(data) ? data : data.records || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (interviews.length === 0) setLoading(true);
    fetchInterviews().finally(() => setLoading(false));
  }, []);

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
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent, search]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject });
      });
      if (parsed.length === 0) { notify.error("CSV file is empty"); setImporting(false); return; }
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
      notify.success(`Imported ${total} applicants`);
      await fetchInterviews();
    } catch (err: any) {
      notify.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const deleteInterview = useDeleteInterview();
  const handleDelete = (id: string) => {
    if (!confirm("Delete this applicant?")) return;
    setInterviews((p) => p.filter((x) => x._id !== id));
    deleteInterview.mutate({ id });
  };

  const upsertInterview = useUpsertInterview();
  const handleStatusChange = (id: string, status: string) => {
    setInterviews((p) => p.map((x) => x._id === id ? { ...x, status } : x));
    setActiveItem((p) => p && p._id === id ? { ...p, status } : p);
    upsertInterview.mutate({ id, data: { status } });
  };

  const handleFieldUpdate = (id: string, field: string, value: string) => {
    setInterviews((p) => p.map((x) => x._id === id ? { ...x, [field]: value } : x));
    setActiveItem((p) => p && p._id === id ? { ...p, [field]: value } : p);
    upsertInterview.mutate({ id, data: { [field]: value } });
  };

  const handleDlPhotoUpload = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch("/api/admin/upload?folder=symx-systems/interviews", { method: "POST", body: formData });
      if (!upRes.ok) throw new Error();
      const { url } = await upRes.json();
      handleFieldUpdate(id, "dlPhoto", url);
      notify.success("DL Photo uploaded");
    } catch {
      notify.error("Upload failed");
    }
  };

  const filtered = useMemo(() => {
    let result = interviews;
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
    return result;
  }, [interviews, search]);

  const orderedColumns = useMemo(() => {
    const known = TAB_ORDER.filter((name) => statusOptions.some((o) => o.description === name));
    // Any dropdown-configured status not in the hardcoded order still gets
    // a column, appended at the end, so a newly added pipeline stage is
    // never silently dropped from the board.
    const extra = statusOptions.map((o) => o.description).filter((d) => !known.includes(d));
    return [...known, ...extra];
  }, [statusOptions]);

  const byColumn = useMemo(() => {
    const map: Record<string, Interview[]> = {};
    for (const col of orderedColumns) map[col] = [];
    for (const item of filtered) {
      const col = columnStatusFor(item.status, orderedColumns);
      if (!map[col]) map[col] = [];
      map[col].push(item);
    }
    for (const col of Object.keys(map)) {
      map[col].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return map;
  }, [filtered, orderedColumns]);

  const handleDragStart = (e: DragStartEvent) => {
    const item = interviews.find((i) => i._id === e.active.id);
    setDraggingItem(item || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingItem(null);
    const { active, over } = e;
    if (!over) return;
    const targetStatus = String(over.id);
    const item = interviews.find((i) => i._id === active.id);
    if (!item) return;
    const currentColumn = columnStatusFor(item.status, orderedColumns);
    if (currentColumn === targetStatus) return;
    handleStatusChange(item._id, targetStatus);
  };

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
    <div className="space-y-4 animate-in fade-in duration-500">
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
      <InterviewDialog open={showDialog} onClose={() => setShowDialog(false)} interview={null} onSaved={fetchInterviews} statusOptions={statusOptions} />
      <CandidateDetailSheet
        item={activeItem}
        onClose={() => setActiveItem(null)}
        statusOptions={statusOptions}
        onFieldUpdate={handleFieldUpdate}
        onStatusChange={handleStatusChange}
        onDlPhotoUpload={handleDlPhotoUpload}
        onDelete={handleDelete}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {orderedColumns.map((status, i) => (
            <PipelineColumn
              key={status}
              status={status}
              items={byColumn[status] || []}
              colorIndex={i}
              statusOptions={statusOptions}
              onOpenCandidate={setActiveItem}
            />
          ))}
        </div>
        <DragOverlay>
          {draggingItem ? (
            <div className="w-[280px] rounded-xl border border-primary/40 bg-card p-3 shadow-2xl rotate-2">
              <p className="text-xs font-bold text-foreground truncate">{draggingItem.fullName || "Unknown"}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {interviews.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-16 text-center">
          <p className="text-sm font-bold text-muted-foreground mb-1">No applicants yet</p>
          <p className="text-xs text-muted-foreground/70 mb-4">Share the application form or create one manually</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white" onClick={() => setShowDialog(true)}>
              <Plus className="h-3.5 w-3.5" /> New Applicant
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowShare(true)}>
              <Share2 className="h-3.5 w-3.5" /> Share Form
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
