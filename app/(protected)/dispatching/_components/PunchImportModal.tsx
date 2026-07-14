"use client";

import React, { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
    Upload,
    FileSpreadsheet,
    X,
    Check,
    AlertCircle,
    Loader2,
    ArrowRight,
    FileUp,
    CheckCircle2,
    AlertTriangle,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Records come back from the API as 24-hour "HH:MM" (matching how SYMXRoute stores every
// other time field) — format for display here the same way the Time page does.
function formatAmPm(timeStr?: string): string {
    if (!timeStr || !timeStr.includes(":")) return timeStr || "";
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
}

// Small red flag rendered under an employee's name for anyone matched who isn't
// currently "Active" — surfaces likely stale/terminated matches (e.g. a punch report
// row for someone who's actually left) right in the preview, before import.
function StatusFlag({ status }: { status?: string }) {
    if (!status || status === "Active") return null;
    return <span className="block text-[9px] font-semibold text-red-500 leading-tight">{status}</span>;
}

interface PunchImportModalProps {
    open: boolean;
    onClose: () => void;
    onImportComplete?: () => void;
}

type Step = "upload" | "preview" | "committing" | "done";

interface CleanRecord {
    eeCode: string;
    employeeName: string;
    employeeStatus?: string;
    transporterId: string;
    date: string;
    dateRaw: string;
    paycomInDay?: string;
    paycomOutLunch?: string;
    paycomInLunch?: string;
    paycomOutDay?: string;
    punchesPresent: string[];
    complete: boolean;
    corrections: string[];
    currentValues: { paycomInDay: string; paycomOutLunch: string; paycomInLunch: string; paycomOutDay: string };
    deletedExcluded: number;
}

interface ExceptionRecord {
    eeCode: string;
    employeeName: string;
    employeeStatus?: string;
    dateRaw: string;
    reason: string;
    punches: { type: string; time: string }[];
}

export default function PunchImportModal({ open, onClose, onImportComplete }: PunchImportModalProps) {
    const [step, setStep] = useState<Step>("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [clean, setClean] = useState<CleanRecord[]>([]);
    const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [commitResult, setCommitResult] = useState<{ updated: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setStep("upload");
        setFile(null);
        setParsing(false);
        setClean([]);
        setExceptions([]);
        setError(null);
        setCommitResult(null);
    }, []);

    const handleClose = useCallback(() => {
        onClose();
        setTimeout(reset, 300);
    }, [onClose, reset]);

    const processFile = useCallback(async (selectedFile: File) => {
        if (!selectedFile.name.toLowerCase().endsWith(".xlsx") && !selectedFile.name.toLowerCase().endsWith(".xls")) {
            notify.error("Please select an Excel (.xlsx) file");
            return;
        }
        setFile(selectedFile);
        setError(null);
        setParsing(true);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const res = await fetch("/api/dispatching/time/punch-import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to parse punch report");

            setClean(data.clean || []);
            setExceptions(data.exceptions || []);
            setStep("preview");
        } catch (err: any) {
            setError(err.message || "Failed to parse punch report");
        } finally {
            setParsing(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    }, [processFile]);
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) processFile(selectedFile);
        e.target.value = "";
    }, [processFile]);

    const handleCommit = useCallback(async () => {
        if (clean.length === 0) return;
        setStep("committing");
        setError(null);
        try {
            const res = await fetch("/api/dispatching/time/punch-import/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ records: clean }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to write punch data");
            setCommitResult({ updated: data.updated || 0 });
            setStep("done");
            notify.success(`Updated ${data.updated || 0} route${data.updated === 1 ? "" : "s"} with Paycom punch times`);
            onImportComplete?.();
        } catch (err: any) {
            setError(err.message || "Failed to write punch data");
            setStep("preview");
            notify.error(err.message || "Failed to write punch data");
        }
    }, [clean, onImportComplete]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={step !== "committing" ? handleClose : undefined} />

            <div className={cn(
                "relative z-10 w-full max-w-3xl mx-4 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
                "animate-in zoom-in-95 fade-in duration-300"
            )}>
                <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-indigo-500/30">
                            <Upload className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold">Import Punch Audit Report</h2>
                            <p className="text-[11px] text-muted-foreground">
                                {step === "upload" && "Upload the Paycom Punch Audit Report (.xlsx)"}
                                {step === "preview" && `${clean.length} clean · ${exceptions.length} need review`}
                                {step === "committing" && "Writing punch times to routes..."}
                                {step === "done" && "Import complete!"}
                            </p>
                        </div>
                    </div>
                    {step !== "committing" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
                    {/* ── STEP 1: Upload ── */}
                    {step === "upload" && (
                        <div className="space-y-4">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => !parsing && fileRef.current?.click()}
                                className={cn(
                                    "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
                                    isDragging
                                        ? "border-indigo-400 bg-indigo-500/10 scale-[1.02]"
                                        : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                                )}
                            >
                                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
                                {parsing ? (
                                    <div className="space-y-3">
                                        <Loader2 className="h-8 w-8 mx-auto text-indigo-400 animate-spin" />
                                        <p className="text-sm font-semibold">Parsing and matching punches...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className={cn(
                                            "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-transform duration-300",
                                            isDragging ? "bg-indigo-500/20 ring-2 ring-indigo-500/40 scale-110" : "bg-gradient-to-br from-indigo-500/10 to-blue-500/10 ring-1 ring-indigo-500/20"
                                        )}>
                                            <FileUp className={cn("h-7 w-7", isDragging ? "text-indigo-400" : "text-muted-foreground")} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">
                                                {isDragging ? "Drop the report here" : "Drag & drop the Punch Audit Report here"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                or <span className="text-primary font-medium underline underline-offset-2">browse files</span> to select
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    <p className="text-xs text-red-400 font-medium">{error}</p>
                                </div>
                            )}

                            <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                                <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-muted-foreground">
                                    Matched by <span className="font-semibold text-indigo-400">EE Code</span> against each employee's SYMX record.
                                    Safe to upload multiple times a day (morning, after lunch, evening) — partial days import fine, only
                                    whatever punches exist get written, nothing else is touched. Punches are placed by time order, not the
                                    button pressed — a punch mislabeled "In Lunch" that's actually someone's first punch of the day still
                                    lands in In Day. Only too many punches, an unrecognized punch type, or an EE Code/route that doesn't
                                    match get flagged for manual review.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Preview ── */}
                    {step === "preview" && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                                <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center ring-1 ring-emerald-500/30">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{file?.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{clean.length + exceptions.length} employee-days found</p>
                                </div>
                                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
                                    Change
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-[11px] font-semibold text-emerald-400">{clean.length} ready to import</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {clean.filter((r) => r.complete).length} complete · {clean.filter((r) => !r.complete).length} partial (still mid-shift)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/20">
                                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                    <div>
                                        <p className="text-[11px] font-semibold text-amber-400">{exceptions.length} need review</p>
                                        <p className="text-[10px] text-muted-foreground">Won't be written automatically</p>
                                    </div>
                                </div>
                            </div>

                            {clean.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Ready to import</p>
                                    <div className="rounded-lg border border-border/30 overflow-hidden">
                                        <div className="overflow-x-auto max-h-[220px]">
                                            <table className="w-full text-[10px] border-collapse">
                                                <thead className="sticky top-0 z-10 bg-muted/50">
                                                    <tr className="border-b border-border/30">
                                                        <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Employee</th>
                                                        <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Date</th>
                                                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">In Day</th>
                                                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Out Lunch</th>
                                                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">In Lunch</th>
                                                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Out Day</th>
                                                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clean.map((r, i) => {
                                                        const willOverwrite = Object.entries(r.currentValues).some(
                                                            ([k, v]) => v && (r as any)[k] !== undefined && v !== (r as any)[k]
                                                        );
                                                        const hasCorrections = r.corrections && r.corrections.length > 0;
                                                        return (
                                                            <React.Fragment key={i}>
                                                                <tr className={cn("border-b border-border/20", (willOverwrite || hasCorrections) && "bg-amber-500/5")}>
                                                                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                                                                        {r.employeeName}
                                                                        <StatusFlag status={r.employeeStatus} />
                                                                    </td>
                                                                    <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{r.dateRaw}</td>
                                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">{r.paycomInDay ? formatAmPm(r.paycomInDay) : <span className="text-muted-foreground/30">—</span>}</td>
                                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">{r.paycomOutLunch ? formatAmPm(r.paycomOutLunch) : <span className="text-muted-foreground/30">—</span>}</td>
                                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">{r.paycomInLunch ? formatAmPm(r.paycomInLunch) : <span className="text-muted-foreground/30">—</span>}</td>
                                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">{r.paycomOutDay ? formatAmPm(r.paycomOutDay) : <span className="text-muted-foreground/30">—</span>}</td>
                                                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                                        {r.complete ? (
                                                                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">Complete</span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 text-blue-400 font-semibold">Partial</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                {hasCorrections && (
                                                                    <tr className="bg-amber-500/5 border-b border-border/20">
                                                                        <td colSpan={7} className="px-2 py-1 text-amber-500">
                                                                            {r.corrections.map((c, ci) => (
                                                                                <div key={ci}>Punch type corrected: {c}</div>
                                                                            ))}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {exceptions.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Needs manual review</p>
                                    <div className="rounded-lg border border-amber-500/20 overflow-hidden">
                                        <div className="overflow-x-auto max-h-[220px]">
                                            <table className="w-full text-[10px] border-collapse">
                                                <thead className="sticky top-0 z-10 bg-amber-500/10">
                                                    <tr className="border-b border-amber-500/20">
                                                        <th className="text-left px-2 py-1.5 font-semibold text-amber-400">Employee</th>
                                                        <th className="text-left px-2 py-1.5 font-semibold text-amber-400">Date</th>
                                                        <th className="text-left px-2 py-1.5 font-semibold text-amber-400">Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {exceptions.map((r, i) => (
                                                        <tr key={i} className="border-b border-amber-500/10">
                                                            <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                                                                {r.employeeName || r.eeCode}
                                                                <StatusFlag status={r.employeeStatus} />
                                                            </td>
                                                            <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{r.dateRaw}</td>
                                                            <td className="px-2 py-1.5 text-amber-400">{r.reason}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    <p className="text-xs text-red-400 font-medium">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: Committing ── */}
                    {step === "committing" && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                            <p className="text-sm font-semibold">Writing {clean.length} route{clean.length === 1 ? "" : "s"}...</p>
                        </div>
                    )}

                    {/* ── STEP 4: Done ── */}
                    {step === "done" && commitResult && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-5">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center ring-2 ring-emerald-500/30">
                                <Check className="h-9 w-9 text-emerald-400" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-lg font-bold">{commitResult.updated} route{commitResult.updated === 1 ? "" : "s"} updated</p>
                                {exceptions.length > 0 && (
                                    <p className="text-xs text-muted-foreground">{exceptions.length} still need manual review in the table</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border/30 bg-muted/10 flex items-center justify-between">
                    {step === "upload" && (
                        <>
                            <p className="text-[10px] text-muted-foreground">Excel (.xlsx) export from Paycom's Punch Audit Report</p>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleClose}>Cancel</Button>
                        </>
                    )}
                    {step === "preview" && (
                        <>
                            <p className="text-[10px] text-muted-foreground">Only the {clean.length} clean row{clean.length === 1 ? "" : "s"} will be written</p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>Back</Button>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 font-semibold bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-lg shadow-indigo-500/20"
                                    onClick={handleCommit}
                                    disabled={clean.length === 0}
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                    Import {clean.length} Route{clean.length === 1 ? "" : "s"}
                                    <ArrowRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </>
                    )}
                    {step === "committing" && (
                        <p className="text-[10px] text-muted-foreground w-full text-center">Please do not close this window...</p>
                    )}
                    {step === "done" && (
                        <>
                            <div />
                            <Button size="sm" className="h-8 text-xs gap-1.5 font-semibold" onClick={handleClose}>
                                <Check className="h-3.5 w-3.5" />
                                Done
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
