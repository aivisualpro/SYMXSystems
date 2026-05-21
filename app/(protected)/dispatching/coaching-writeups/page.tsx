"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  Target,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CoachingWriteUp {
  _id: string;
  employeeId?: string;
  employeeName?: string;
  supervisorName?: string;
  durationOfIncident?: string;
  incidentDate?: string;
  incidentWeek?: string;
  type?: string;
  metric?: string;
  metricName?: string;
  metricIcon?: string;
  metricColor?: string;
  correctiveActionNumber?: string;
  metricNoticeNumber?: string;
  correctiveAction?: string;
  correctiveActionDate?: string;
  supervisor?: string;
  metricValue?: string;
  seatbeltOffRate?: string;
  speedingEventRate?: string;
  distractionsRate?: string;
  signSignalViolationsRate?: string;
  followingDistanceRate?: string;
  DAMishandledPackage?: string;
  DAWasUnprofessional?: string;
  DADidNotFollowMyDeliveryInstructions?: string;
  deliveredToWrongAddress?: string;
  neverReceivedDelivery?: string;
  receivedWrongItem?: string;
  improvedByDate?: string;
  suggestion?: string;
  totalNegativeFeedbacks?: string;
  priorDiscussionOrWarningsOnThisSubject?: string;
  goal?: string;
  files?: { name: string; url: string }[];
  unSignedPdf?: string;
  signedPdf?: string;
  createdBy?: string;
  createdAt?: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function CoachingWriteupsPage() {
  const { searchQuery, setOnCoachingAdd, availableWeeks } = useDispatching();
  const [data, setData] = useState<CoachingWriteUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<CoachingWriteUp | null>(null);
  const [localSearch, setLocalSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (pageNum = 1, search = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", "50");
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/coaching-writeups?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result.records || []);
      setTotalCount(result.totalCount || 0);
    } catch (err) {
      console.error("Failed to fetch coaching writeups:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = searchQuery || localSearch;
    fetchData(page, query);
  }, [page, searchQuery, localSearch, fetchData]);

  // Register add handler with layout
  useEffect(() => {
    setOnCoachingAdd(() => () => {
      setAddForm({});
      setShowAddModal(true);
    });
    return () => setOnCoachingAdd(null);
  }, [setOnCoachingAdd]);

  const handleAddSave = async () => {
    setSaving(true);
    try {
      const body: any = { ...addForm };
      if (body.incidentDate) body.incidentDate = new Date(body.incidentDate).toISOString();
      if (body.correctiveActionDate) body.correctiveActionDate = new Date(body.correctiveActionDate).toISOString();
      if (body.improvedByDate) body.improvedByDate = new Date(body.improvedByDate).toISOString();
      const res = await fetch("/api/admin/coaching-writeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      setShowAddModal(false);
      setAddForm({});
      fetchData(page, searchQuery || localSearch);
    } catch (err) {
      console.error("Failed to add:", err);
    } finally {
      setSaving(false);
    }
  };

  // Filter locally by the dispatching layout's search
  const filteredData = useMemo(() => {
    if (!searchQuery && !localSearch) return data;
    const q = (searchQuery || localSearch).toLowerCase();
    return data.filter(
      (r) =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q) ||
        (r.metricName || "").toLowerCase().includes(q) ||
        (r.supervisorName || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery, localSearch]);

  const getTypeBadgeColor = (type?: string) => {
    if (!type) return "bg-muted text-muted-foreground";
    const t = type.toLowerCase();
    if (t.includes("coaching")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (t.includes("corrective")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (t.includes("writeup") || t.includes("write up")) return "bg-red-500/15 text-red-400 border-red-500/30";
    if (t.includes("termination")) return "bg-rose-600/15 text-rose-400 border-rose-600/30";
    return "bg-primary/10 text-primary border-primary/30";
  };
  // Group by type
  const groupedData = useMemo(() => {
    const groups: { type: string; rows: CoachingWriteUp[] }[] = [];
    const groupMap = new Map<string, CoachingWriteUp[]>();

    for (const row of filteredData) {
      const t = row.type || "Uncategorized";
      if (!groupMap.has(t)) {
        groupMap.set(t, []);
      }
      groupMap.get(t)!.push(row);
    }

    // Sort groups alphabetically
    const sortedKeys = Array.from(groupMap.keys()).sort();
    for (const key of sortedKeys) {
      groups.push({ type: key, rows: groupMap.get(key)! });
    }
    return groups;
  }, [filteredData]);

  return (
    <div className="flex flex-col h-full gap-3 px-1">

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-[30px]"></th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Metric</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Corrective Action</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Supervisor</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Week</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Files</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-[60px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-muted-foreground">
                  No coaching writeups found
                </td>
              </tr>
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.type}>
                  {/* ── Group header ── */}
                  <tr className="bg-muted/40 border-t border-border">
                    <td colSpan={9} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border", getTypeBadgeColor(group.type))}>
                          {group.type}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {group.rows.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {/* ── Group rows ── */}
                  {group.rows.map((row) => {
                    const isExpanded = expandedRow === row._id;
                    return (
                      <React.Fragment key={row._id}>
                        <tr
                          className={cn(
                            "hover:bg-muted/30 transition-colors cursor-pointer",
                            isExpanded && "bg-muted/20"
                          )}
                          onClick={() => setExpandedRow(isExpanded ? null : row._id)}
                        >
                          <td className="px-3 py-2.5">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-foreground">{row.employeeName || "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.incidentDate)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[180px]">
                            {row.metricName ? (
                              <span className="inline-flex items-center gap-1.5 truncate">
                                {row.metricIcon && (() => {
                                  const IconComp = (LucideIcons as any)[row.metricIcon];
                                  return IconComp ? <IconComp className="h-3.5 w-3.5 shrink-0" style={row.metricColor ? { color: row.metricColor } : undefined} /> : null;
                                })()}
                                <span className="truncate">{row.metricName}</span>
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">{row.correctiveAction || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.supervisorName || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{row.incidentWeek || "—"}</td>
                          <td className="px-3 py-2.5">
                            {(row.files && row.files.length > 0) ? (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <FileText className="h-3 w-3" />
                                {row.files.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModal(row);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>

                    {/* ── Expanded row detail ── */}
                    {isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Duration</span>
                              <span>{row.durationOfIncident || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Corrective Action #</span>
                              <span>{row.correctiveActionNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Metric Notice #</span>
                              <span>{row.metricNoticeNumber || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Metric Value</span>
                              <span>{row.metricValue || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Corrective Action Date</span>
                              <span>{formatDate(row.correctiveActionDate)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Improved By Date</span>
                              <span>{formatDate(row.improvedByDate)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Total Neg. Feedbacks</span>
                              <span>{row.totalNegativeFeedbacks || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">Goal</span>
                              <span>{row.goal || "—"}</span>
                            </div>
                          </div>

                          {/* Safety Metrics */}
                          {(row.seatbeltOffRate || row.speedingEventRate || row.distractionsRate || row.signSignalViolationsRate || row.followingDistanceRate) && (
                            <div className="mt-3 pt-3 border-t border-border/40">
                              <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold block mb-2">Safety Metrics</span>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {row.seatbeltOffRate && <Badge variant="outline" className="text-[10px]">Seatbelt: {row.seatbeltOffRate}</Badge>}
                                {row.speedingEventRate && <Badge variant="outline" className="text-[10px]">Speeding: {row.speedingEventRate}</Badge>}
                                {row.distractionsRate && <Badge variant="outline" className="text-[10px]">Distractions: {row.distractionsRate}</Badge>}
                                {row.signSignalViolationsRate && <Badge variant="outline" className="text-[10px]">Sign/Signal: {row.signSignalViolationsRate}</Badge>}
                                {row.followingDistanceRate && <Badge variant="outline" className="text-[10px]">Following Dist: {row.followingDistanceRate}</Badge>}
                              </div>
                            </div>
                          )}

                          {/* CDF Metrics */}
                          {(row.DAMishandledPackage || row.DAWasUnprofessional || row.DADidNotFollowMyDeliveryInstructions || row.deliveredToWrongAddress || row.neverReceivedDelivery || row.receivedWrongItem) && (
                            <div className="mt-3 pt-3 border-t border-border/40">
                              <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold block mb-2">Customer Feedback</span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {row.DAMishandledPackage && <Badge variant="outline" className="text-[10px]">Mishandled: {row.DAMishandledPackage}</Badge>}
                                {row.DAWasUnprofessional && <Badge variant="outline" className="text-[10px]">Unprofessional: {row.DAWasUnprofessional}</Badge>}
                                {row.DADidNotFollowMyDeliveryInstructions && <Badge variant="outline" className="text-[10px]">Didn&apos;t Follow Instructions: {row.DADidNotFollowMyDeliveryInstructions}</Badge>}
                                {row.deliveredToWrongAddress && <Badge variant="outline" className="text-[10px]">Wrong Address: {row.deliveredToWrongAddress}</Badge>}
                                {row.neverReceivedDelivery && <Badge variant="outline" className="text-[10px]">Never Received: {row.neverReceivedDelivery}</Badge>}
                                {row.receivedWrongItem && <Badge variant="outline" className="text-[10px]">Wrong Item: {row.receivedWrongItem}</Badge>}
                              </div>
                            </div>
                          )}

                          {/* Suggestion / Prior Warnings */}
                          {(row.suggestion || row.priorDiscussionOrWarningsOnThisSubject) && (
                            <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {row.suggestion && (
                                <div>
                                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-0.5">Suggestion</span>
                                  <p className="text-xs leading-relaxed">{row.suggestion}</p>
                                </div>
                              )}
                              {row.priorDiscussionOrWarningsOnThisSubject && (
                                <div>
                                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-0.5">Prior Discussions / Warnings</span>
                                  <p className="text-xs leading-relaxed">{row.priorDiscussionOrWarningsOnThisSubject}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalCount > 50 && (
        <div className="flex items-center justify-between px-2 shrink-0 pb-2">
          <span className="text-xs text-muted-foreground">
            Page {page} of {Math.ceil(totalCount / 50)}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * 50 >= totalCount} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Coaching & Writeup Detail
            </DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-4 text-sm">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Employee</span>
                    <span className="font-semibold">{detailModal.employeeName || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Incident Date</span>
                    <span className="font-semibold">{formatDate(detailModal.incidentDate)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Type</span>
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", getTypeBadgeColor(detailModal.type))}>
                      {detailModal.type || "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Supervisor</span>
                  <span className="font-semibold">{detailModal.supervisorName || "—"}</span>
                </div>
              </div>

              {/* All fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(() => {
                  const MetricIconComp = detailModal.metricIcon ? (LucideIcons as any)[detailModal.metricIcon] : null;
                  const metricDisplay = detailModal.metricName ? (
                    <span className="inline-flex items-center gap-1.5">
                      {MetricIconComp && <MetricIconComp className="h-3.5 w-3.5 shrink-0" style={detailModal.metricColor ? { color: detailModal.metricColor } : undefined} />}
                      {detailModal.metricName}
                    </span>
                  ) : undefined;
                  return [
                    ["Metric", metricDisplay],
                  ["Metric Value", detailModal.metricValue],
                  ["Duration", detailModal.durationOfIncident],
                  ["Corrective Action #", detailModal.correctiveActionNumber],
                  ["Metric Notice #", detailModal.metricNoticeNumber],
                  ["Corrective Action", detailModal.correctiveAction],
                  ["Corrective Action Date", formatDate(detailModal.correctiveActionDate)],
                  ["Improved By Date", formatDate(detailModal.improvedByDate)],
                  ["Total Neg. Feedbacks", detailModal.totalNegativeFeedbacks],
                  ["Goal", detailModal.goal],
                  ["Week", detailModal.incidentWeek],
                  ];
                })().map(([label, value]) => (
                  <div key={label as string}>
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-0.5">{label}</span>
                    <span>{value || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Suggestion & Prior Warnings */}
              {(detailModal.suggestion || detailModal.priorDiscussionOrWarningsOnThisSubject) && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  {detailModal.suggestion && (
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">Suggestion</span>
                      <p className="text-xs leading-relaxed p-2 rounded bg-muted/30 border border-border/40">{detailModal.suggestion}</p>
                    </div>
                  )}
                  {detailModal.priorDiscussionOrWarningsOnThisSubject && (
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">Prior Discussions / Warnings</span>
                      <p className="text-xs leading-relaxed p-2 rounded bg-muted/30 border border-border/40">{detailModal.priorDiscussionOrWarningsOnThisSubject}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Files */}
              {detailModal.files && detailModal.files.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold block mb-2">Files</span>
                  <div className="flex flex-wrap gap-2">
                    {detailModal.files.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 hover:bg-muted text-xs transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {f.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* PDFs */}
              {(detailModal.unSignedPdf || detailModal.signedPdf) && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold block mb-2">PDFs</span>
                  <div className="flex flex-wrap gap-2">
                    {detailModal.unSignedPdf && (
                      <a href={detailModal.unSignedPdf} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs transition-colors">
                        <FileText className="h-3.5 w-3.5" /> Unsigned PDF
                      </a>
                    )}
                    {detailModal.signedPdf && (
                      <a href={detailModal.signedPdf} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs transition-colors">
                        <FileText className="h-3.5 w-3.5" /> Signed PDF
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Modal ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" />
              Add Coaching & Writeup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {/* Row 1: Type + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                <Select
                  value={addForm.type || ""}
                  onValueChange={(v) => setAddForm((prev) => ({ ...prev, type: v, durationOfIncident: "", incidentDate: "", incidentWeek: "" }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coaching">Coaching</SelectItem>
                    <SelectItem value="Write Up">Write Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addForm.type && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Duration of Incident</label>
                  <Select
                    value={addForm.durationOfIncident || ""}
                    onValueChange={(v) => setAddForm((prev) => ({ ...prev, durationOfIncident: v, incidentDate: "", incidentWeek: "" }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Week">Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Row 2: Conditional date/week */}
            {addForm.durationOfIncident === "Day" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Date</label>
                  <Input
                    type="date"
                    value={addForm.incidentDate || ""}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, incidentDate: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
            {addForm.durationOfIncident === "Week" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Week</label>
                  <Select
                    value={addForm.incidentWeek || ""}
                    onValueChange={(v) => setAddForm((prev) => ({ ...prev, incidentWeek: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {(availableWeeks || []).map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Remaining fields */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "metric", label: "Metric", type: "text" },
                { key: "metricValue", label: "Metric Value", type: "text" },
                { key: "correctiveActionNumber", label: "Corrective Action #", type: "text" },
                { key: "metricNoticeNumber", label: "Metric Notice #", type: "text" },
                { key: "correctiveAction", label: "Corrective Action", type: "text" },
                { key: "correctiveActionDate", label: "Corrective Action Date", type: "date" },
                { key: "improvedByDate", label: "Improved By Date", type: "date" },
                { key: "totalNegativeFeedbacks", label: "Total Neg. Feedbacks", type: "text" },
                { key: "goal", label: "Goal", type: "text" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{field.label}</label>
                  <Input
                    type={field.type}
                    value={addForm[field.key] || ""}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>

            {/* Text areas */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Suggestion</label>
                <textarea
                  value={addForm.suggestion || ""}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, suggestion: e.target.value }))}
                  className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prior Discussions / Warnings</label>
                <textarea
                  value={addForm.priorDiscussionOrWarningsOnThisSubject || ""}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, priorDiscussionOrWarningsOnThisSubject: e.target.value }))}
                  className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
