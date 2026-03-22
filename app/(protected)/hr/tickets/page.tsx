"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Papa from "papaparse";

interface HrTicket {
  _id: string;
  ticketNumber?: string;
  transporterId?: string;
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
}

type StatusFilter = "all" | "pending" | "approved" | "denied";

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: any; color: string; activeColor: string }[] = [
  { key: "pending", label: "Pending", icon: Clock, color: "text-blue-500", activeColor: "bg-blue-500 text-white shadow-blue-500/25" },
  { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-500", activeColor: "bg-emerald-500 text-white shadow-emerald-500/25" },
  { key: "denied", label: "Denied", icon: XCircle, color: "text-red-500", activeColor: "bg-red-500 text-white shadow-red-500/25" },
  { key: "all", label: "All", icon: Filter, color: "text-muted-foreground", activeColor: "bg-primary text-primary-foreground shadow-primary/25" },
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

export default function HRTicketsPage() {
  const [tickets, setTickets] = useState<HrTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [importing, setImporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { setRightContent } = useHeaderActions();

  // ── Mount search + import in header ──
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent]);

  // ── Fetch tickets ──
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/hr-tickets");
        if (res.ok) {
          const data = await res.json();
          setTickets(Array.isArray(data) ? data : data.records || []);
        }
      } catch { /* silently fail */ } finally {
        setLoading(false);
      }
    })();
  }, []);

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

      if (parsed.length === 0) { toast.error("CSV file is empty"); setImporting(false); return; }

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

      toast.success(`Imported ${totalInserted} tickets`);
      const res = await fetch("/api/admin/hr-tickets");
      if (res.ok) { const data = await res.json(); setTickets(Array.isArray(data) ? data : data.records || []); }
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, []);

  // ── Approve / Deny handler ──
  const handleStatusUpdate = useCallback(async (ticketId: string, newStatus: "Approve" | "Deny") => {
    setUpdatingId(ticketId);
    try {
      const res = await fetch(`/api/admin/hr-tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveDeny: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");

      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? { ...t, approveDeny: newStatus } : t))
      );
      toast.success(`Ticket ${newStatus === "Approve" ? "approved" : "denied"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setUpdatingId(null);
    }
  }, []);

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

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => getTicketStatus(t) === statusFilter);
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.ticketNumber || "").toLowerCase().includes(q) ||
        (t.transporterId || "").toLowerCase().includes(q) ||
        (t.employeeName || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.issue || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      );
    }

    // Sort: newest first
    return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [tickets, statusFilter, search]);

  if (loading) {
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
          <p className="text-xs text-muted-foreground/70">
            {tickets.length === 0 ? "Import a CSV to get started" : "Try changing the filter or search term"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((t) => {
            const status = getTicketStatus(t);
            const config = getStatusConfig(status);
            const isPending = status === "pending";
            const isUpdating = updatingId === t._id;
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
                          {t.employeeName || t.transporterId || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.ticketNumber && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              #{t.ticketNumber}
                            </span>
                          )}
                          {t.category && (
                            <span className="text-[10px] font-medium text-muted-foreground truncate">{t.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ring-1 shrink-0", config.bg, config.color, config.ring)}>
                      <config.icon className="h-3 w-3" />
                      {config.label}
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
                  {t.managersEmail && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 truncate max-w-[160px]">
                      <Mail className="h-3 w-3" /> {t.managersEmail}
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
