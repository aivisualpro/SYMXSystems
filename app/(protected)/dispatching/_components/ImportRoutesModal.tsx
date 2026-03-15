"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { toast } from "sonner";
import {
    Upload,
    FileSpreadsheet,
    X,
    Check,
    AlertCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Sparkles,
    FileUp,
    ShieldCheck,
    Database,
    Layers,
    CheckCircle2,
    XCircle,
    Info,
    Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── All expected fields organized by category ──
const FIELD_CATEGORIES = [
    {
        label: "Core",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        fields: ["date", "yearWeek", "transporterId", "type", "subType", "trainingDay"],
    },
    {
        label: "Route Info",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        fields: ["routeSize", "van", "serviceType", "dashcam", "routeNumber", "stopCount", "packageCount", "routeDuration", "waveTime", "pad", "wst", "wstDuration", "wstRevenue", "notes", "stagingLocation", "extraStops", "stopsRescued"],
    },
    {
        label: "Departure & Stems",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        fields: ["departureDelay", "actualDepartureTime", "plannedOutboundStem", "actualOutboundStem", "outboundDelay"],
    },
    {
        label: "Stops",
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
        fields: ["plannedFirstStop", "actualFirstStop", "firstStopDelay", "plannedLastStop", "actualLastStop", "lastStopDelay"],
    },
    {
        label: "RTS & Duration",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
        fields: ["plannedRTSTime", "plannedInboundStem", "estimatedRTSTime", "plannedDuration1stToLast", "actualDuration1stToLast", "stopsPerHour"],
    },
    {
        label: "Delivery",
        color: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        fields: ["deliveryCompletionTime", "dctDelay", "driverEfficiency"],
    },
    {
        label: "Attendance",
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        fields: ["attendance", "attendanceTime"],
    },
    {
        label: "Amazon & Paycom",
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/20",
        fields: ["amazonOutLunch", "amazonInLunch", "amazonAppLogout", "inspectionTime", "paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay", "driversUpdatedForLunch"],
    },
    {
        label: "Hours & Pay",
        color: "text-teal-400",
        bg: "bg-teal-500/10",
        border: "border-teal-500/20",
        fields: ["totalHours", "regHrs", "otHrs", "totalCost", "regPay", "otPay"],
    },
    {
        label: "Misc",
        color: "text-zinc-400",
        bg: "bg-zinc-500/10",
        border: "border-zinc-500/20",
        fields: ["punchStatus", "whc", "createdAt", "createdBy", "bags", "ov"],
    },
];

const ALL_EXPECTED_FIELDS = FIELD_CATEGORIES.flatMap(c => c.fields);

const CHUNK_SIZE = 300;

interface ImportRoutesModalProps {
    open: boolean;
    onClose: () => void;
    onImportComplete?: () => void;
}

type ImportStep = "upload" | "preview" | "importing" | "done";

interface ImportResult {
    success: boolean;
    count: number;
    inserted: number;
    updated: number;
    infoSynced: number;
    skipped: number;
}

export default function ImportRoutesModal({ open, onClose, onImportComplete }: ImportRoutesModalProps) {
    const [step, setStep] = useState<ImportStep>("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [matchedFields, setMatchedFields] = useState<string[]>([]);
    const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
    const [showFieldMap, setShowFieldMap] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState("");
    const [progressPercent, setProgressPercent] = useState(0);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStep("upload");
                setFile(null);
                setParsedData([]);
                setHeaders([]);
                setMatchedFields([]);
                setUnmatchedHeaders([]);
                setShowFieldMap(false);
                setImporting(false);
                setImportProgress("");
                setProgressPercent(0);
                setResult(null);
                setError(null);
            }, 300);
        }
    }, [open]);

    // ── Drag & Drop Handlers ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const processFile = useCallback((selectedFile: File) => {
        if (!selectedFile.name.endsWith(".csv")) {
            toast.error("Please select a CSV file");
            return;
        }

        setFile(selectedFile);
        setError(null);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    setError("CSV file is empty or has no valid rows");
                    return;
                }

                const csvHeaders = results.meta.fields || [];
                setHeaders(csvHeaders);
                setParsedData(results.data as any[]);

                // Compute matched/unmatched fields
                const headerMapKeys = new Set(Object.keys(getHeaderMap()));
                const matched: string[] = [];
                const unmatched: string[] = [];

                csvHeaders.forEach(h => {
                    const trimmed = h.trim();
                    if (headerMapKeys.has(trimmed)) {
                        matched.push(trimmed);
                    } else {
                        unmatched.push(trimmed);
                    }
                });

                setMatchedFields(matched);
                setUnmatchedHeaders(unmatched);
                setStep("preview");
            },
            error: (err) => {
                setError(`Failed to parse CSV: ${err.message}`);
            },
        });
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) processFile(selectedFile);
        e.target.value = "";
    }, [processFile]);

    // ── Import Handler ──
    const handleImport = useCallback(async () => {
        if (parsedData.length === 0) return;

        setStep("importing");
        setImporting(true);
        setError(null);

        try {
            const chunks: any[][] = [];
            for (let i = 0; i < parsedData.length; i += CHUNK_SIZE) {
                chunks.push(parsedData.slice(i, i + CHUNK_SIZE));
            }

            let totalInserted = 0;
            let totalUpdated = 0;
            let totalCount = 0;
            let totalInfoSynced = 0;
            let totalSkipped = 0;

            for (let i = 0; i < chunks.length; i++) {
                setImportProgress(`Uploading batch ${i + 1} of ${chunks.length} (${chunks[i].length} rows)...`);
                setProgressPercent(Math.round(((i + 1) / chunks.length) * 100));

                const res = await fetch("/api/dispatching/routes/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ data: chunks[i] }),
                });

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.error || `Import failed on batch ${i + 1}`);
                }

                totalInserted += result.inserted || 0;
                totalUpdated += result.updated || 0;
                totalCount += result.count || 0;
                totalInfoSynced += result.infoSynced || 0;
                totalSkipped += result.skipped || 0;
            }

            setResult({
                success: true,
                count: totalCount,
                inserted: totalInserted,
                updated: totalUpdated,
                infoSynced: totalInfoSynced,
                skipped: totalSkipped,
            });
            setStep("done");

            toast.success(
                `Imported ${totalCount} route records (${totalInserted} new, ${totalUpdated} updated)${
                    totalInfoSynced > 0 ? ` + ${totalInfoSynced} Routes Info synced` : ""
                }`
            );

            onImportComplete?.();
        } catch (err: any) {
            setError(err.message || "Import failed");
            setStep("preview");
            toast.error(err.message || "Import failed");
        } finally {
            setImporting(false);
        }
    }, [parsedData, onImportComplete]);

    if (!open) return null;

    // ── Determine which expected fields are matched vs missing ──
    const matchedExpectedFields = ALL_EXPECTED_FIELDS.filter(f =>
        matchedFields.some(h => h === f || getHeaderMap()[h] === f)
    );
    const missingExpectedFields = ALL_EXPECTED_FIELDS.filter(f =>
        !matchedFields.some(h => h === f || getHeaderMap()[h] === f)
    );

    // Check for required fields
    const hasDate = matchedFields.some(h => h === "date" || h === "Date");
    const hasTransporterId = matchedFields.some(h => h === "transporterId" || h === "Transporter ID");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={step !== "importing" ? onClose : undefined}
            />

            {/* Modal */}
            <div className={cn(
                "relative z-10 w-full max-w-2xl mx-4 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
                "animate-in zoom-in-95 fade-in duration-300"
            )}>
                {/* Gradient top bar */}
                <div className="h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-violet-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 flex items-center justify-center ring-1 ring-orange-500/30">
                            <Upload className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold">Import Routes</h2>
                            <p className="text-[11px] text-muted-foreground">
                                {step === "upload" && "Upload a CSV file to import route data"}
                                {step === "preview" && `${parsedData.length} rows ready to import`}
                                {step === "importing" && "Importing route data..."}
                                {step === "done" && "Import complete!"}
                            </p>
                        </div>
                    </div>
                    {step !== "importing" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
                    {/* ── STEP 1: Upload ── */}
                    {step === "upload" && (
                        <div className="space-y-4">
                            {/* Drop zone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileRef.current?.click()}
                                className={cn(
                                    "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
                                    isDragging
                                        ? "border-orange-400 bg-orange-500/10 scale-[1.02]"
                                        : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                                )}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <div className="space-y-3">
                                    <div className={cn(
                                        "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-transform duration-300",
                                        isDragging
                                            ? "bg-orange-500/20 ring-2 ring-orange-500/40 scale-110"
                                            : "bg-gradient-to-br from-orange-500/10 to-rose-500/10 ring-1 ring-orange-500/20"
                                    )}>
                                        <FileUp className={cn(
                                            "h-7 w-7 transition-colors",
                                            isDragging ? "text-orange-400" : "text-muted-foreground"
                                        )} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {isDragging ? "Drop your CSV file here" : "Drag & drop your CSV file here"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            or <span className="text-primary font-medium underline underline-offset-2">browse files</span> to select
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    <p className="text-xs text-red-400 font-medium">{error}</p>
                                </div>
                            )}

                            {/* Field categories preview */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground font-medium">Supported field categories ({ALL_EXPECTED_FIELDS.length} fields)</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {FIELD_CATEGORIES.map(cat => (
                                        <span
                                            key={cat.label}
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                                                cat.bg, cat.color, cat.border
                                            )}
                                        >
                                            {cat.label}
                                            <span className="opacity-60">({cat.fields.length})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Required fields note */}
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-muted-foreground">
                                    <span className="font-semibold text-amber-400">Required:</span>{" "}
                                    <code className="px-1 py-0.5 rounded bg-muted text-[10px]">transporterId</code> and{" "}
                                    <code className="px-1 py-0.5 rounded bg-muted text-[10px]">date</code>.
                                    Route info fields (routeNumber, stops, packages, etc.) auto-sync to <span className="font-semibold">Routes Info</span>.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Preview ── */}
                    {step === "preview" && (
                        <div className="space-y-4">
                            {/* File info card */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                                <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center ring-1 ring-emerald-500/30">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{file?.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {parsedData.length.toLocaleString()} rows · {headers.length} columns · {(file?.size || 0) > 1024 * 1024 ? `${(file!.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round((file?.size || 0) / 1024)} KB`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setStep("upload"); setFile(null); setParsedData([]); }}
                                    className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                    Change
                                </button>
                            </div>

                            {/* Validation Status */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className={cn(
                                    "flex items-center gap-2 p-2.5 rounded-lg border",
                                    hasTransporterId && hasDate
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-red-500/5 border-red-500/20"
                                )}>
                                    {hasTransporterId && hasDate ? (
                                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    )}
                                    <div>
                                        <p className={cn("text-[11px] font-semibold", hasTransporterId && hasDate ? "text-emerald-400" : "text-red-400")}>
                                            {hasTransporterId && hasDate ? "Required fields found" : "Missing required fields"}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {!hasTransporterId && "transporterId missing · "}
                                            {!hasDate && "date missing"}
                                            {hasTransporterId && hasDate && "transporterId & date ✓"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-blue-500/5 border-blue-500/20">
                                    <Database className="h-4 w-4 text-blue-400 shrink-0" />
                                    <div>
                                        <p className="text-[11px] font-semibold text-blue-400">
                                            {matchedFields.length} / {headers.length} fields matched
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {unmatchedHeaders.length > 0 ? `${unmatchedHeaders.length} unrecognized` : "All columns mapped"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Field Mapping Toggle */}
                            <button
                                onClick={() => setShowFieldMap(!showFieldMap)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold">Field Mapping Details</span>
                                </div>
                                {showFieldMap ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            {showFieldMap && (
                                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    {/* Matched by category */}
                                    {FIELD_CATEGORIES.map(cat => {
                                        const catMatched = cat.fields.filter(f =>
                                            matchedFields.some(h => h === f || matchedExpectedFields.includes(f))
                                        );
                                        const catMissing = cat.fields.filter(f =>
                                            !matchedFields.some(h => h === f || matchedExpectedFields.includes(f))
                                        );

                                        if (catMatched.length === 0) return null;

                                        return (
                                            <div key={cat.label} className="space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", cat.color)}>
                                                        {cat.label}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground">
                                                        {catMatched.length}/{cat.fields.length}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {catMatched.map(f => (
                                                        <span
                                                            key={f}
                                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                                                        >
                                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                                            {f}
                                                        </span>
                                                    ))}
                                                    {catMissing.map(f => (
                                                        <span
                                                            key={f}
                                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-500 ring-1 ring-zinc-500/20"
                                                        >
                                                            <Minus className="h-2.5 w-2.5" />
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Unmatched headers */}
                                    {unmatchedHeaders.length > 0 && (
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                                Unrecognized Columns ({unmatchedHeaders.length})
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                                {unmatchedHeaders.map(h => (
                                                    <span
                                                        key={h}
                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                                                    >
                                                        <AlertCircle className="h-2.5 w-2.5" />
                                                        {h}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Data Preview Table */}
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">Preview (first 5 rows)</p>
                                <div className="rounded-lg border border-border/30 overflow-hidden">
                                    <div className="overflow-x-auto max-h-[180px]">
                                        <table className="w-full text-[10px] border-collapse" style={{ minWidth: Math.max(headers.length * 90, 600) }}>
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-muted/50 border-b border-border/30">
                                                    {headers.slice(0, 15).map(h => (
                                                        <th key={h} className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">
                                                            {h}
                                                        </th>
                                                    ))}
                                                    {headers.length > 15 && (
                                                        <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground/50 whitespace-nowrap">
                                                            +{headers.length - 15} more
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedData.slice(0, 5).map((row, i) => (
                                                    <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                                                        {headers.slice(0, 15).map(h => (
                                                            <td key={h} className="px-2 py-1.5 text-foreground whitespace-nowrap max-w-[140px] truncate">
                                                                {row[h] || <span className="text-muted-foreground/30">—</span>}
                                                            </td>
                                                        ))}
                                                        {headers.length > 15 && (
                                                            <td className="px-2 py-1.5 text-muted-foreground/40">…</td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    <p className="text-xs text-red-400 font-medium">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: Importing ── */}
                    {step === "importing" && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-5">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 flex items-center justify-center ring-1 ring-orange-500/30">
                                    <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg">
                                    <Database className="h-3.5 w-3.5 text-white" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-semibold">Importing Route Data...</p>
                                <p className="text-xs text-muted-foreground">{importProgress}</p>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full max-w-xs">
                                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500 ease-out"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center mt-1.5">{progressPercent}%</p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Done ── */}
                    {step === "done" && result && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-5">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center ring-2 ring-emerald-500/30">
                                    <Check className="h-9 w-9 text-emerald-400" />
                                </div>
                                <div className="absolute -top-2 -right-2">
                                    <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-lg font-bold">Import Complete!</p>
                                <p className="text-xs text-muted-foreground">{file?.name}</p>
                            </div>

                            {/* Result stats */}
                            <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
                                <div className="flex flex-col items-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                    <span className="text-2xl font-bold text-emerald-400">{result.count}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium">Total Routes</span>
                                </div>
                                <div className="flex flex-col items-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                                    <span className="text-2xl font-bold text-blue-400">{result.inserted}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium">New</span>
                                </div>
                                <div className="flex flex-col items-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                    <span className="text-2xl font-bold text-amber-400">{result.updated}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium">Updated</span>
                                </div>
                            </div>

                            {(result.infoSynced > 0 || result.skipped > 0) && (
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                    {result.infoSynced > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Layers className="h-3 w-3 text-violet-400" />
                                            {result.infoSynced} Routes Info synced
                                        </span>
                                    )}
                                    {result.skipped > 0 && (
                                        <span className="flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3 text-amber-400" />
                                            {result.skipped} rows skipped
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border/30 bg-muted/10 flex items-center justify-between">
                    {step === "upload" && (
                        <>
                            <p className="text-[10px] text-muted-foreground">CSV format • Max 10,000 rows per import</p>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
                                Cancel
                            </Button>
                        </>
                    )}

                    {step === "preview" && (
                        <>
                            <p className="text-[10px] text-muted-foreground">
                                {parsedData.length > CHUNK_SIZE
                                    ? `Will upload in ${Math.ceil(parsedData.length / CHUNK_SIZE)} batches`
                                    : "Single batch upload"}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setStep("upload"); setFile(null); setParsedData([]); }}>
                                    Back
                                </Button>
                                <Button
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs gap-1.5 font-semibold",
                                        "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/20"
                                    )}
                                    onClick={handleImport}
                                    disabled={!hasDate || !hasTransporterId}
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                    Import {parsedData.length.toLocaleString()} Routes
                                    <ArrowRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </>
                    )}

                    {step === "importing" && (
                        <p className="text-[10px] text-muted-foreground w-full text-center">
                            Please do not close this window while importing...
                        </p>
                    )}

                    {step === "done" && (
                        <>
                            <div />
                            <Button
                                size="sm"
                                className="h-8 text-xs gap-1.5 font-semibold"
                                onClick={onClose}
                            >
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

// Helper: get the full header map (duplicated here for client-side matching)
function getHeaderMap(): Record<string, string> {
    return {
        "date": "date", "yearWeek": "yearWeek", "transporterId": "transporterId",
        "type": "type", "subType": "subType", "trainingDay": "trainingDay",
        "routeSize": "routeSize", "van": "van", "serviceType": "serviceType",
        "dashcam": "dashcam", "routeNumber": "routeNumber", "stopCount": "stopCount",
        "packageCount": "packageCount", "routeDuration": "routeDuration",
        "waveTime": "waveTime", "pad": "pad", "wst": "wst",
        "wstDuration": "wstDuration", "wstRevenue": "wstRevenue",
        "notes": "notes", "stagingLocation": "stagingLocation",
        "extraStops": "extraStops", "stopsRescued": "stopsRescued",
        "departureDelay": "departureDelay", "actualDepartureTime": "actualDepartureTime",
        "plannedOutboundStem": "plannedOutboundStem", "actualOutboundStem": "actualOutboundStem",
        "outboundDelay": "outboundDelay", "plannedFirstStop": "plannedFirstStop",
        "actualFirstStop": "actualFirstStop", "firstStopDelay": "firstStopDelay",
        "plannedLastStop": "plannedLastStop", "actualLastStop": "actualLastStop",
        "lastStopDelay": "lastStopDelay", "plannedRTSTime": "plannedRTSTime",
        "plannedInboundStem": "plannedInboundStem", "estimatedRTSTime": "estimatedRTSTime",
        "plannedDuration1stToLast": "plannedDuration1stToLast",
        "actualDuration1stToLast": "actualDuration1stToLast",
        "stopsPerHour": "stopsPerHour", "deliveryCompletionTime": "deliveryCompletionTime",
        "dctDelay": "dctDelay", "driverEfficiency": "driverEfficiency",
        "attendance": "attendance", "attendanceTime": "attendanceTime",
        "amazonOutLunch": "amazonOutLunch", "amazonInLunch": "amazonInLunch",
        "amazonAppLogout": "amazonAppLogout", "inspectionTime": "inspectionTime",
        "paycomInDay": "paycomInDay", "paycomOutLunch": "paycomOutLunch",
        "paycomInLunch": "paycomInLunch", "paycomOutDay": "paycomOutDay",
        "driversUpdatedForLunch": "driversUpdatedForLunch",
        "totalHours": "totalHours", "regHrs": "regHrs", "otHrs": "otHrs",
        "totalCost": "totalCost", "regPay": "regPay", "otPay": "otPay",
        "punchStatus": "punchStatus", "whc": "whc", "bags": "bags", "ov": "ov",
        "createdAt": "createdAt", "createdBy": "createdBy",
        // Human-friendly headers
        "Date": "date", "Year Week": "yearWeek", "Transporter ID": "transporterId",
        "Type": "type", "Sub Type": "subType", "Training Day": "trainingDay",
        "Route Size": "routeSize", "Van": "van", "Service Type": "serviceType",
        "Dashcam": "dashcam", "Route Number": "routeNumber", "Stop Count": "stopCount",
        "Package Count": "packageCount", "Route Duration": "routeDuration",
        "Wave Time": "waveTime", "PAD": "pad", "WST": "wst",
        "WST Duration": "wstDuration", "WST Revenue": "wstRevenue",
        "Notes": "notes", "Staging Location": "stagingLocation",
        "Extra Stops": "extraStops", "Stops Rescued": "stopsRescued",
        "Departure Delay": "departureDelay", "Actual Departure Time": "actualDepartureTime",
        "Planned Outbound Stem": "plannedOutboundStem", "Actual Outbound Stem": "actualOutboundStem",
        "Outbound Delay": "outboundDelay", "Planned First Stop": "plannedFirstStop",
        "Actual First Stop": "actualFirstStop", "First Stop Delay": "firstStopDelay",
        "Planned Last Stop": "plannedLastStop", "Actual Last Stop": "actualLastStop",
        "Last Stop Delay": "lastStopDelay", "Planned RTS Time": "plannedRTSTime",
        "Planned Inbound Stem": "plannedInboundStem", "Estimated RTS Time": "estimatedRTSTime",
        "Planned Duration 1st To Last": "plannedDuration1stToLast",
        "Actual Duration 1st To Last": "actualDuration1stToLast",
        "Stops Per Hour": "stopsPerHour", "Delivery Completion Time": "deliveryCompletionTime",
        "DCT Delay": "dctDelay", "Driver Efficiency": "driverEfficiency",
        "Attendance": "attendance", "Attendance Time": "attendanceTime",
        "Amazon Out Lunch": "amazonOutLunch", "Amazon In Lunch": "amazonInLunch",
        "Amazon App Logout": "amazonAppLogout", "Inspection Time": "inspectionTime",
        "Paycom In Day": "paycomInDay", "Paycom Out Lunch": "paycomOutLunch",
        "Paycom In Lunch": "paycomInLunch", "Paycom Out Day": "paycomOutDay",
        "Drivers Updated For Lunch": "driversUpdatedForLunch",
        "Total Hours": "totalHours", "Reg Hrs": "regHrs", "OT Hrs": "otHrs",
        "Total Cost": "totalCost", "Reg Pay": "regPay", "OT Pay": "otPay",
        "Punch Status": "punchStatus", "WHC": "whc", "Bags": "bags", "OV": "ov",
        "Created At": "createdAt", "Created By": "createdBy",
    };
}

