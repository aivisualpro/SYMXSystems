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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { searchQuery } = useDispatching();
  const [data, setData] = useState<CoachingWriteUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<CoachingWriteUp | null>(null);
  const [localSearch, setLocalSearch] = useState("");

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

  // Filter locally by the dispatching layout's search
  const filteredData = useMemo(() => {
    if (!searchQuery && !localSearch) return data;
    const q = (searchQuery || localSearch).toLowerCase();
    return data.filter(
      (r) =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q) ||
        (r.metric || "").toLowerCase().includes(q) ||
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
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Type</th>
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
                <td colSpan={10} className="text-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-foreground">
                  No coaching writeups found
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
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
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", getTypeBadgeColor(row.type))}>
                          {row.type || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[150px] truncate">{row.metric || "—"}</td>
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
                        <td colSpan={10} className="px-6 py-4">
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
              })
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
                {[
                  ["Metric", detailModal.metric],
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
                ].map(([label, value]) => (
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
    </div>
  );
}
