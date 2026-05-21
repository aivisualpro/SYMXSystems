"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
  Search,
  Eye,
  FileText,
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

  // Edit modal state
  const [editModal, setEditModal] = useState<CoachingWriteUp | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  const openEditModal = (row: CoachingWriteUp) => {
    setEditModal(row);
    setEditForm({ ...row });
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      const body: any = { ...editForm };
      // Remove enriched fields
      delete body._id;
      delete body.employeeName;
      delete body.supervisorName;
      delete body.metricName;
      delete body.metricIcon;
      delete body.metricColor;
      delete body.__v;
      delete body.createdAt;
      delete body.updatedAt;
      if (body.incidentDate && typeof body.incidentDate === "string" && body.incidentDate.length === 10) {
        body.incidentDate = new Date(body.incidentDate).toISOString();
      }
      if (body.correctiveActionDate && typeof body.correctiveActionDate === "string" && body.correctiveActionDate.length === 10) {
        body.correctiveActionDate = new Date(body.correctiveActionDate).toISOString();
      }
      if (body.improvedByDate && typeof body.improvedByDate === "string" && body.improvedByDate.length === 10) {
        body.improvedByDate = new Date(body.improvedByDate).toISOString();
      }
      const res = await fetch(`/api/admin/coaching-writeups/${editModal._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditModal(null);
      fetchData(page, searchQuery || localSearch);
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const toDateInputValue = (v?: string) => {
    if (!v) return "";
    try { return new Date(v).toISOString().split("T")[0]; } catch { return ""; }
  };

  return (
    <div className="flex flex-col h-full gap-3 px-1">

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Duration</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Week</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Metric</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Supervisor</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-[70px]">Unsigned</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-[70px]">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-muted-foreground">
                  No coaching writeups found
                </td>
              </tr>
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.type}>
                  {/* ── Group header ── */}
                  <tr className="bg-muted/40 border-t border-border">
                    <td colSpan={8} className="px-3 py-2">
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
                  {group.rows.map((row) => (
                    <tr
                      key={row._id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEditModal(row)}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-foreground">{row.employeeName || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.incidentDate)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.durationOfIncident || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{row.incidentWeek || "—"}</td>
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
                      <td className="px-3 py-2.5 text-muted-foreground">{row.supervisorName || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {row.unSignedPdf ? (
                          <a
                            href={row.unSignedPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-amber-500/20 transition-colors"
                            title="View Unsigned PDF"
                          >
                            <FileText className="h-4 w-4 text-amber-400" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.signedPdf ? (
                          <a
                            href={row.signedPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-emerald-500/20 transition-colors"
                            title="View Signed PDF"
                          >
                            <FileText className="h-4 w-4 text-emerald-400" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
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

      {/* ── Edit Modal ── */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Edit Coaching & Writeup
            </DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4 text-sm">
              {/* Header summary */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Employee</span>
                    <span className="font-semibold text-xs">{editModal.employeeName || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Type</span>
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border", getTypeBadgeColor(editModal.type))}>
                      {editModal.type || "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Supervisor</span>
                  <span className="font-semibold text-xs">{editModal.supervisorName || "—"}</span>
                </div>
              </div>

              {/* Row 1: Type + Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                  <Select value={editForm.type || ""} onValueChange={(v) => setEditForm(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Coaching">Coaching</SelectItem>
                      <SelectItem value="Write Up">Write Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Duration of Incident</label>
                  <Select value={editForm.durationOfIncident || ""} onValueChange={(v) => setEditForm(prev => ({ ...prev, durationOfIncident: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select duration" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Week">Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Week</label>
                  <Select value={editForm.incidentWeek || ""} onValueChange={(v) => setEditForm(prev => ({ ...prev, incidentWeek: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select week" /></SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {(availableWeeks || []).map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Date</label>
                  <Input type="date" value={toDateInputValue(editForm.incidentDate)} onChange={(e) => setEditForm(prev => ({ ...prev, incidentDate: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Corrective Action Date</label>
                  <Input type="date" value={toDateInputValue(editForm.correctiveActionDate)} onChange={(e) => setEditForm(prev => ({ ...prev, correctiveActionDate: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Improved By Date</label>
                  <Input type="date" value={toDateInputValue(editForm.improvedByDate)} onChange={(e) => setEditForm(prev => ({ ...prev, improvedByDate: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>

              {/* Row 3: Metric, Value, Numbers */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "metricValue", label: "Metric Value" },
                  { key: "correctiveActionNumber", label: "Corrective Action #" },
                  { key: "metricNoticeNumber", label: "Metric Notice #" },
                  { key: "correctiveAction", label: "Corrective Action" },
                  { key: "totalNegativeFeedbacks", label: "Total Neg. Feedbacks" },
                  { key: "goal", label: "Goal" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{field.label}</label>
                    <Input type="text" value={editForm[field.key] || ""} onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="h-8 text-xs" />
                  </div>
                ))}
              </div>

              {/* Safety Metrics */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">Safety Metrics</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "seatbeltOffRate", label: "Seatbelt Off Rate" },
                    { key: "speedingEventRate", label: "Speeding Event Rate" },
                    { key: "distractionsRate", label: "Distractions Rate" },
                    { key: "signSignalViolationsRate", label: "Sign/Signal Violations" },
                    { key: "followingDistanceRate", label: "Following Distance" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{field.label}</label>
                      <Input type="text" value={editForm[field.key] || ""} onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="h-8 text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Feedback */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">Customer Feedback</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "DAMishandledPackage", label: "Mishandled Package" },
                    { key: "DAWasUnprofessional", label: "Unprofessional" },
                    { key: "DADidNotFollowMyDeliveryInstructions", label: "Didn't Follow Instructions" },
                    { key: "deliveredToWrongAddress", label: "Wrong Address" },
                    { key: "neverReceivedDelivery", label: "Never Received" },
                    { key: "receivedWrongItem", label: "Wrong Item" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{field.label}</label>
                      <Input type="text" value={editForm[field.key] || ""} onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="h-8 text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Text areas */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Suggestion</label>
                  <textarea
                    value={editForm.suggestion || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, suggestion: e.target.value }))}
                    className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prior Discussions / Warnings</label>
                  <textarea
                    value={editForm.priorDiscussionOrWarningsOnThisSubject || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, priorDiscussionOrWarningsOnThisSubject: e.target.value }))}
                    className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none"
                  />
                </div>
              </div>

              {/* PDFs (read-only links) */}
              {(editModal.unSignedPdf || editModal.signedPdf) && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">PDFs</span>
                  <div className="flex flex-wrap gap-2">
                    {editModal.unSignedPdf && (
                      <a href={editModal.unSignedPdf} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs transition-colors">
                        <FileText className="h-3.5 w-3.5" /> Unsigned PDF
                      </a>
                    )}
                    {editModal.signedPdf && (
                      <a href={editModal.signedPdf} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs transition-colors">
                        <FileText className="h-3.5 w-3.5" /> Signed PDF
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Files */}
              {editModal.files && editModal.files.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">Files</span>
                  <div className="flex flex-wrap gap-2">
                    {editModal.files.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 hover:bg-muted text-xs transition-colors">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {f.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" size="sm" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button size="sm" onClick={handleEditSave} disabled={editSaving} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                  {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  Save Changes
                </Button>
              </div>
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
