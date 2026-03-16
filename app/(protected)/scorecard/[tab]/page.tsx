"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Download, Loader2, Upload, Search, Check, Hash,
  X, Play, ChevronRight, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

// ── Extracted Scorecard Modules ───────────────────────────────────────────
import { TAB_MAP } from "@/components/scorecard/constants";
import type { DriverData, PodRow, CdfNegativeRow, RtsRow, DspMetrics } from "@/components/scorecard/types";
import {
  DriversTab, SYMXTab, PodTab, CdfNegativeTab,
  DeliveryExcellenceTab, DcrTab, DsbTab, SafetyTab, DvicTab, RtsTab,
} from "@/components/scorecard/tabs";
import { DriverDetailDialog } from "@/components/scorecard/driver-detail-dialog";


// ── Main Component ────────────────────────────────────────────────────────
function EmployeePerformanceDashboardInner() {
  const params = useParams<{ tab: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = params.tab || 'Drivers';
  const urlWeek = searchParams.get('week') || '';
  const { setRightContent, setLeftContent } = useHeaderActions();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(urlWeek);
  const [loading, setLoading] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [podRows, setPodRows] = useState<PodRow[]>([]);
  const [cdfNegativeRows, setCdfNegativeRows] = useState<CdfNegativeRow[]>([]);
  const [rtsRows, setRtsRows] = useState<RtsRow[]>([]);
  const [deliveryExcellenceRows, setDeliveryExcellenceRows] = useState<any[]>([]);
  const [dcrRows, setDcrRows] = useState<any[]>([]);
  const [dsbRows, setDsbRows] = useState<any[]>([]);
  const [safetyRows, setSafetyRows] = useState<any[]>([]);
  const [dvicRawRows, setDvicRawRows] = useState<any[]>([]);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [avgOverallScore, setAvgOverallScore] = useState(0);
  const [dspMetrics, setDspMetrics] = useState<DspMetrics | null>(null);
  const [signatureMap, setSignatureMap] = useState<Record<string, { driverSigned: boolean; managerSigned: boolean }>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pageTitle, setPageTitle] = useState("Scorecard");
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [videoDialogUrl, setVideoDialogUrl] = useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>('nfc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const reportRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Remarks & Signatures State ──────────────────────────────────────────
  const [driverRemarks, setDriverRemarks] = useState("");
  const [managerRemarks, setManagerRemarks] = useState("");
  const [driverSignature, setDriverSignature] = useState("");
  const [managerSignature, setManagerSignature] = useState("");
  const [driverSigTimestamp, setDriverSigTimestamp] = useState<string | null>(null);
  const [managerSigTimestamp, setManagerSigTimestamp] = useState<string | null>(null);
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [loggedInUserName, setLoggedInUserName] = useState("");


  // Fetch logged-in user name
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const { user } = await res.json();
          if (user?.name) setLoggedInUserName(user.name);
        }
      } catch { /* ignore */ }
    };
    fetchUser();
  }, []);


  // Fetch remarks when driver is selected
  useEffect(() => {
    if (!selectedDriver || !selectedWeek) {
      setDriverRemarks(''); setManagerRemarks('');
      setDriverSignature(''); setManagerSignature('');
      setDriverSigTimestamp(null); setManagerSigTimestamp(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/scorecard/scorecard-remarks?transporterId=${encodeURIComponent(selectedDriver.transporterId)}&week=${encodeURIComponent(selectedWeek)}`);
        const data = await res.json();
        if (data.remarks) {
          setDriverRemarks(data.remarks.driverRemarks || '');
          setManagerRemarks(data.remarks.managerRemarks || '');
          setDriverSignature(data.remarks.driverSignature || '');
          setManagerSignature(data.remarks.managerSignature || '');
          setDriverSigTimestamp(data.remarks.driverSignatureTimestamp || null);
          setManagerSigTimestamp(data.remarks.managerSignatureTimestamp || null);
        } else {
          setDriverRemarks(''); setManagerRemarks('');
          setDriverSignature(''); setManagerSignature('');
          setDriverSigTimestamp(null); setManagerSigTimestamp(null);
        }
      } catch { /* silently fail */ }
    })();
  }, [selectedDriver, selectedWeek]);

  const saveRemarks = async () => {
    if (!selectedDriver || !selectedWeek) return;
    setSavingRemarks(true);
    try {
      const res = await fetch('/api/scorecard/scorecard-remarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transporterId: selectedDriver.transporterId,
          week: selectedWeek,
          driverRemarks,
          driverSignature,
          managerRemarks,
          managerSignature,
        }),
      });
      const data = await res.json();
      if (data.remarks) {
        setDriverSigTimestamp(data.remarks.driverSignatureTimestamp || null);
        setManagerSigTimestamp(data.remarks.managerSignatureTimestamp || null);
      }
      toast.success('Remarks saved successfully');
      // Refresh signature map for the table
      if (selectedWeek) {
        try {
          const sigRes = await fetch(`/api/scorecard/scorecard-remarks?week=${encodeURIComponent(selectedWeek)}`);
          const sigData = await sigRes.json();
          setSignatureMap(sigData.signatureMap || {});
        } catch { /* silently fail */ }
      }
    } catch {
      toast.error('Failed to save remarks');
    } finally {
      setSavingRemarks(false);
    }
  };

  // ── Import State ──────────────────────────────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [importWeek, setImportWeek] = useState<string>("");
  const [importWeekPopoverOpen, setImportWeekPopoverOpen] = useState(false);
  const [importWeekSearchInput, setImportWeekSearchInput] = useState("");
  const importWeekInputRef = useRef<HTMLInputElement>(null);

  // Batch file state — one file per import type, with per-file detected week
  const [importFiles, setImportFiles] = useState<Record<string, { file: File; detectedWeek: string | null } | null>>({
    "delivery-excellence": null,
    "import-pod": null,
    "customer-delivery-feedback": null,
    "dvic-vehicle-inspection": null,
    "safety-dashboard-dfo2": null,
    "quality-dsb-dnr": null,
    "quality-dcr": null,
    "cdf-negative": null,
  });
  const deFileRef = useRef<HTMLInputElement>(null);
  const podFileRef = useRef<HTMLInputElement>(null);
  const cdfFileRef = useRef<HTMLInputElement>(null);
  const dvicFileRef = useRef<HTMLInputElement>(null);
  const safetyDfo2FileRef = useRef<HTMLInputElement>(null);
  const dsbDnrFileRef = useRef<HTMLInputElement>(null);
  const dcrFileRef = useRef<HTMLInputElement>(null);
  const cdfNegFileRef = useRef<HTMLInputElement>(null);
  const rtsFileRef = useRef<HTMLInputElement>(null);
  const fileRefMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
    "delivery-excellence": deFileRef,
    "import-pod": podFileRef,
    "customer-delivery-feedback": cdfFileRef,
    "dvic-vehicle-inspection": dvicFileRef,
    "safety-dashboard-dfo2": safetyDfo2FileRef,
    "quality-dsb-dnr": dsbDnrFileRef,
    "quality-dcr": dcrFileRef,
    "cdf-negative": cdfNegFileRef,
    "rts": rtsFileRef,
  };

  // Detect week from CSV content (first row's Week column or Date column)
  const detectWeekFromCSV = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        preview: 5, // Only parse first 5 rows
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];
          if (rows.length === 0) { resolve(null); return; }
          // Try Week column first
          for (const row of rows) {
            const weekVal = (row["Week"] || row["week"] || "").toString().trim();
            if (weekVal) {
              const normalized = normalizeWeekInput(weekVal);
              if (normalized) { resolve(normalized); return; }
            }
          }
          // Try Date column — convert date to ISO week
          for (const row of rows) {
            const dateVal = (row["Date"] || row["date"] || row["Delivery Date"] || "").toString().trim();
            if (dateVal && dateVal.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) {
              try {
                const parsed = new Date(dateVal);
                if (!isNaN(parsed.getTime())) {
                  // Sunday-based week: Sunday is the FIRST day of the week
                  const d = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
                  const year = d.getUTCFullYear();
                  const jan1 = new Date(Date.UTC(year, 0, 1));
                  const jan1Day = jan1.getUTCDay();
                  const w01Start = new Date(jan1);
                  w01Start.setUTCDate(jan1.getUTCDate() - jan1Day);
                  const diffDays = Math.floor((d.getTime() - w01Start.getTime()) / 86400000);
                  const weekNum = Math.floor(diffDays / 7) + 1;
                  if (weekNum >= 1 && weekNum <= 53) {
                    resolve(`${year}-W${weekNum.toString().padStart(2, '0')}`);
                    return;
                  }
                }
              } catch { /* ignore */ }
            }
          }
          resolve(null);
        },
        error: () => resolve(null),
      });
    });
  };

  const handleImportFileAttach = (type: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isValidExt = file.name.endsWith(".csv") || file.name.endsWith(".xlsx");
    if (!isValidExt) { toast.error("Please select a valid CSV or XLSX file"); return; }

    // Try to detect week from filename first, then from CSV content
    let detectedWeek = extractWeekFromFilename(file.name);
    if (!detectedWeek) {
      detectedWeek = await detectWeekFromCSV(file);
    }

    setImportFiles(prev => ({ ...prev, [type]: { file, detectedWeek } }));

    if (detectedWeek && !weeks.includes(detectedWeek)) {
      setWeeks(prev => [detectedWeek!, ...prev].sort().reverse());
    }
  };

  const removeImportFile = (type: string) => {
    setImportFiles(prev => ({ ...prev, [type]: null }));
    const ref = fileRefMap[type];
    if (ref?.current) ref.current.value = "";
  };

  const attachedFileCount = Object.values(importFiles).filter(Boolean).length;

  // Process a single file type through the import API
  const processImportFile = async (type: string, file: File, week: string): Promise<{ inserted: number; updated: number; total: number }> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data;
          const totalRows = data.length;
          const batchSize = 50;
          let processedCount = 0;
          let insertedCount = 0;
          let updatedCount = 0;

          try {
            for (let i = 0; i < totalRows; i += batchSize) {
              const batch = data.slice(i, i + batchSize);
              const payload: any = { type, data: batch, week };

              const response = await fetch("/api/admin/imports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Batch failed for ${type}`);
              }

              const result = await response.json();
              insertedCount += result.inserted || 0;
              updatedCount += result.updated || 0;
              processedCount += batch.length;
            }

            resolve({ inserted: insertedCount, updated: updatedCount, total: totalRows });
          } catch (error: any) {
            reject(error);
          }
        },
        error: () => reject(new Error(`Failed to parse ${file.name}`)),
      });
    });
  };

  const handleBatchImport = async () => {
    const filesToProcess = Object.entries(importFiles).filter(([, entry]) => entry !== null) as [string, { file: File; detectedWeek: string | null }][];
    if (filesToProcess.length === 0) { toast.error("No files attached. Please select at least one CSV."); return; }

    // Validate: any file without a detected week needs the global fallback week
    const filesWithoutWeek = filesToProcess.filter(([, { detectedWeek }]) => !detectedWeek);
    if (filesWithoutWeek.length > 0 && !importWeek) {
      toast.error(`Please select a fallback week — ${filesWithoutWeek.length} file(s) couldn't auto-detect their week.`);
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setShowImportDialog(false);

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalRecords = 0;
    const typeLabels: Record<string, string> = {
      "delivery-excellence": "Delivery Excellence",
      "import-pod": "Photo On Delivery",
      "dvic-vehicle-inspection": "DVIC Inspection",
      "safety-dashboard-dfo2": "Safety Dashboard",
      "quality-dsb-dnr": "Quality DSB DNR",
      "quality-dcr": "Quality DCR",
      "cdf-negative": "CDF Negative Feedback",
      "rts": "Return to Station",
    };

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const [type, { file, detectedWeek }] = filesToProcess[i];
        const weekForFile = detectedWeek || importWeek;
        const label = typeLabels[type] || type;
        const pct = Math.round(((i) / filesToProcess.length) * 100);
        setImportProgress(pct);
        setImportStatusMessage(`Importing ${label} (${weekForFile})... (${i + 1}/${filesToProcess.length})`);

        const result = await processImportFile(type, file, weekForFile);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalRecords += result.total;
      }

      setImportProgress(100);
      setImportStatusMessage("All imports complete!");
      toast.success(`Processed ${totalRecords} total records. Added: ${totalInserted}, Updated: ${totalUpdated}`);

      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatusMessage("");
        // Reset all files
        setImportFiles({ "delivery-excellence": null, "import-pod": null, "customer-delivery-feedback": null, "dvic-vehicle-inspection": null, "safety-dashboard-dfo2": null, "quality-dsb-dnr": null, "quality-dcr": null, "cdf-negative": null });
        Object.values(fileRefMap).forEach(ref => { if (ref?.current) ref.current.value = ""; });
        // Refresh scorecard data
        if (selectedWeek) fetchData(selectedWeek);
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to import data");
      setIsImporting(false);
    }
  };


  // ── Week Selector State (header combo-box) ──────────────────────────────
  const [weekPopoverOpen, setWeekPopoverOpen] = useState(false);
  const [weekSearchInput, setWeekSearchInput] = useState("");
  const weekInputRef = useRef<HTMLInputElement>(null);

  // Normalize flexible input → standard YYYY-Wxx format
  const normalizeWeekInput = (raw: string): string | null => {
    const s = raw.trim().toUpperCase();
    // Match patterns: 2026-W05, 2026-W5, 2026W05, 2026W5
    let m = s.match(/^(\d{4})-?W(\d{1,2})$/);
    // Also match: 2026_week-5, 2026_week-05, 2026-week-5
    if (!m) m = s.match(/^(\d{4})[_-]WEEK[_-]?(\d{1,2})$/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const wk = parseInt(m[2], 10);
    if (wk < 1 || wk > 53 || year < 2020 || year > 2099) return null;
    return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
  };

  // Extract week from filename — supports various naming patterns
  const extractWeekFromFilename = (filename: string): string | null => {
    const s = filename.toUpperCase();
    // Pattern 1: 2026-W05 or 2026-W5
    let m = s.match(/(\d{4})-W(\d{1,2})/);
    if (m) {
      const wk = parseInt(m[2], 10);
      if (wk >= 1 && wk <= 53) return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
    }
    // Pattern 2: 2026_week-5, 2026_week-05, 2026_WEEK_5
    m = s.match(/(\d{4})[_-]WEEK[_-]?(\d{1,2})/);
    if (m) {
      const wk = parseInt(m[2], 10);
      if (wk >= 1 && wk <= 53) return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
    }
    return null;
  };

  const normalizedWeekInput = normalizeWeekInput(weekSearchInput);

  // Combined list: fetched weeks + user-added weeks
  const headerFilteredWeeks = useMemo(() => {
    if (!weekSearchInput) return weeks;
    const lower = weekSearchInput.toLowerCase();
    return weeks.filter(w => w.toLowerCase().includes(lower));
  }, [weeks, weekSearchInput]);

  const isCustomWeek = !!normalizedWeekInput && !weeks.includes(normalizedWeekInput);

  const handleSelectHeaderWeek = (week: string) => {
    setSelectedWeek(week);
    setWeekSearchInput("");
    setWeekPopoverOpen(false);
    // Sync week to URL
    const url = new URL(window.location.href);
    url.searchParams.set('week', week);
    window.history.replaceState({}, '', url.toString());
  };

  const handleAddCustomWeek = () => {
    if (!normalizedWeekInput) {
      toast.error("Invalid week format. Use YYYY-Wxx (e.g. 2026-W05)");
      return;
    }
    if (!weeks.includes(normalizedWeekInput)) {
      setWeeks(prev => [normalizedWeekInput, ...prev].sort().reverse());
    }
    setSelectedWeek(normalizedWeekInput);
    setWeekSearchInput("");
    setWeekPopoverOpen(false);
    // Sync week to URL
    const url = new URL(window.location.href);
    url.searchParams.set('week', normalizedWeekInput);
    window.history.replaceState({}, '', url.toString());
  };

  useEffect(() => {
    setLoadingWeeks(true);
    fetch("/api/scorecard/employee-performance")
      .then(r => r.json())
      .then(data => {
        setWeeks(data.weeks || []);
        // Only auto-select first week if no week was specified in URL
        if (!selectedWeek && data.weeks?.length > 0) {
          const initialWeek = data.weeks[0];
          setSelectedWeek(initialWeek);
          // Sync to URL
          const url = new URL(window.location.href);
          url.searchParams.set('week', initialWeek);
          window.history.replaceState({}, '', url.toString());
        }
      })
      .catch(() => toast.error("Failed to load weeks"))
      .finally(() => setLoadingWeeks(false));
  }, []);

  const fetchData = useCallback(async (week: string) => {
    if (!week) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scorecard/employee-performance?week=${encodeURIComponent(week)}`);
      const data = await res.json();
      setDrivers(data.drivers || []); setPodRows(data.podRows || []); setCdfNegativeRows(data.cdfNegativeRows || []); setRtsRows(data.rtsRows || []);
      setDeliveryExcellenceRows(data.deliveryExcellenceRows || []); setDcrRows(data.dcrRows || []);
      setDsbRows(data.dsbRows || []); setSafetyRows(data.safetyRows || []); setDvicRawRows(data.dvicRows || []);
      setTotalDrivers(data.totalDrivers || 0); setTotalDelivered(data.totalDelivered || 0);
      setAvgOverallScore(data.avgOverallScore || 0); setDspMetrics(data.dspMetrics || null);
      // Fetch signature statuses for this week
      try {
        const sigRes = await fetch(`/api/scorecard/scorecard-remarks?week=${encodeURIComponent(week)}`);
        const sigData = await sigRes.json();
        setSignatureMap(sigData.signatureMap || {});
      } catch { /* silently fail */ }
    } catch { toast.error("Failed to fetch performance data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedWeek) fetchData(selectedWeek); }, [selectedWeek, fetchData]);

  const generatePDF = () => { setGeneratingPdf(true); setTimeout(() => { window.print(); setGeneratingPdf(false); }, 300); };

  const driversWithIssues = drivers.filter(d => d.dsbCount > 0 || d.podRejects > 0).length;

  // Set dynamic header title
  useEffect(() => {
    setLeftContent(
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        {pageTitle}
      </h1>
    );
    return () => setLeftContent(null);
  }, [pageTitle, setLeftContent]);

  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search drivers..."
            className="h-8 w-[180px] pl-8 text-sm"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => { setShowImportDialog(true); }} className="gap-2">
          <Upload className="h-4 w-4" /> Import
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="w-[180px] h-8 justify-between font-normal"
            onClick={() => setWeekPopoverOpen(!weekPopoverOpen)}
            disabled={loadingWeeks}
          >
            <span>{selectedWeek || "Select Week"}</span>
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
          </Button>
          {weekPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-[260px] rounded-md border bg-popover text-popover-foreground shadow-md">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    ref={weekInputRef}
                    type="text"
                    placeholder="Type week e.g. 2026-W06"
                    className="h-8 pl-7 text-sm"
                    value={weekSearchInput}
                    onChange={(e) => setWeekSearchInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (isCustomWeek) handleAddCustomWeek();
                        else if (normalizedWeekInput && weeks.includes(normalizedWeekInput)) handleSelectHeaderWeek(normalizedWeekInput);
                      }
                    }}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 px-0.5">Format: YYYY-Wxx (e.g. 2026-W06)</p>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {isCustomWeek && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-primary/10 border-b bg-primary/5 transition-colors"
                    onClick={handleAddCustomWeek}
                  >
                    <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">
                      <Hash className="h-3 w-3" /> Add
                    </span>
                    <span className="font-semibold text-primary">{normalizedWeekInput}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">↵ Enter</span>
                  </div>
                )}
                {headerFilteredWeeks.length > 0 ? headerFilteredWeeks.map(w => (
                  <div
                    key={w}
                    className={cn("flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground", selectedWeek === w && "bg-accent/50 font-medium")}
                    onClick={() => handleSelectHeaderWeek(w)}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", selectedWeek === w ? "opacity-100" : "opacity-0")} />
                    {w}
                  </div>
                )) : (
                  <div className="py-4 px-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {weekSearchInput
                        ? normalizedWeekInput
                          ? `"${normalizedWeekInput}" not found — click + Add above`
                          : "Invalid format — use YYYY-Wxx"
                        : "No weeks available. Type a week to add it."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <Button size="sm" onClick={generatePDF} disabled={generatingPdf || drivers.length === 0} className="gap-2">
          {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [selectedWeek, weeks, loadingWeeks, generatingPdf, drivers.length, setRightContent, showImportDialog, weekPopoverOpen, weekSearchInput, headerFilteredWeeks, isCustomWeek, normalizedWeekInput, driverSearch]);

  // Tips based on focus areas
  const currentTips = useMemo(() => {
    const tips: string[] = [];
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Photo"))) tips.push("Train DAs on POD photo quality — ensure packages are clearly visible, well-lit, and at proper distance.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Customer"))) tips.push("Provide visibility of the CDF report to DAs to show them where they stand and what areas to improve.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Safety"))) tips.push("Review safety infractions weekly and identify drivers needing deeper retraining for repeat violations.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Delivery Success"))) tips.push("Check your weekly infraction report and scorecard weekly to look for DSB patterns.");
    tips.push("Have drivers check address and delivery notes in the Rabbit device.");
    return tips.slice(0, 3);
  }, [dspMetrics]);

  // ── Dialogs & hidden inputs must render even when there's no data ──
  const importDialogElements = (
    <>
      {/* Hidden file inputs for each import type */}
      <input type="file" ref={deFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("delivery-excellence")} suppressHydrationWarning />
      <input type="file" ref={podFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("import-pod")} suppressHydrationWarning />
      <input type="file" ref={cdfFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("customer-delivery-feedback")} suppressHydrationWarning />
      <input type="file" ref={dvicFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("dvic-vehicle-inspection")} suppressHydrationWarning />
      <input type="file" ref={safetyDfo2FileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("safety-dashboard-dfo2")} suppressHydrationWarning />
      <input type="file" ref={dsbDnrFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("quality-dsb-dnr")} suppressHydrationWarning />
      <input type="file" ref={dcrFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("quality-dcr")} suppressHydrationWarning />
      <input type="file" ref={cdfNegFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("cdf-negative")} suppressHydrationWarning />
      <input type="file" ref={rtsFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("rts")} suppressHydrationWarning />

      {/* Import Dialog — Multi-file batch import */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open) {
          // Reset files when closing
          setImportFiles({ "delivery-excellence": null, "import-pod": null, "customer-delivery-feedback": null, "dvic-vehicle-inspection": null, "safety-dashboard-dfo2": null, "quality-dsb-dnr": null, "quality-dcr": null, "cdf-negative": null });
          Object.values(fileRefMap).forEach(ref => { if (ref?.current) ref.current.value = ""; });
        }
        setShowImportDialog(open);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Performance Data
            </DialogTitle>
            <DialogDescription>
              Attach CSV or XLSX files for each data type. Week will be auto-detected from filenames or content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {([
              { key: "delivery-excellence", label: "Delivery Excellence", icon: "📦" },
              { key: "import-pod", label: "Photo On Delivery (POD)", icon: "📸" },
              { key: "dvic-vehicle-inspection", label: "DVIC Vehicle Inspection", icon: "🚛" },
              { key: "safety-dashboard-dfo2", label: "Safety Dashboard", icon: "🛡️" },
              { key: "quality-dsb-dnr", label: "Quality DSB / DNR", icon: "📋" },
              { key: "quality-dcr", label: "Quality DCR", icon: "✅" },
              { key: "cdf-negative", label: "CDF Negative Feedback", icon: "⚠️", href: "https://logistics.amazon.com/performance?pageId=dsp_customer_delivery_feedback_negative" },
              { key: "rts", label: "Return to Station", icon: "🔄" },
            ] as const).map(({ key, label, icon, ...rest }) => {
              const href = 'href' in rest ? (rest as any).href as string : undefined;
              const entry = importFiles[key];
              return (
                <div key={key} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all",
                  entry ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 border-border hover:bg-muted/50"
                )}>
                  <span className="text-lg shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>{label}</a>
                    ) : (
                      <p className="text-sm font-medium">{label}</p>
                    )}
                    {entry ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{entry.file.name}</span>
                        {entry.detectedWeek && (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {entry.detectedWeek}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No file attached</p>
                    )}
                  </div>
                  {entry ? (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeImportFile(key)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileRefMap[key]?.current?.click()}>
                      <Upload className="h-3 w-3" /> Attach
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{attachedFileCount}</span> file{attachedFileCount !== 1 ? "s" : ""} attached
              {selectedWeek && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Week: {selectedWeek}</span>}
            </div>
            <Button
              size="sm"
              disabled={attachedFileCount === 0}
              onClick={handleBatchImport}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Import All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importing Data</DialogTitle>
            <DialogDescription>Please wait while we process your files. Do not close this window.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-medium"><span className="text-muted-foreground">Progress</span><span>{importProgress}%</span></div>
              <Progress value={importProgress} className="h-2 w-full transition-all duration-500" />
            </div>
            <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium animate-pulse">{importStatusMessage}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <>
      {importDialogElements}

      <div className="space-y-4 print:space-y-2">
        {/* Tab Navigation + Delete Button */}
        <div className="flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
            {TAB_MAP.map(({ slug, icon: Icon, label }) => (
              <button
                key={slug}
                onClick={() => {
                  const weekParam = selectedWeek ? `?week=${encodeURIComponent(selectedWeek)}` : '';
                  router.push(`/scorecard/${slug}${weekParam}`);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  activeTab === slug
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab !== 'SYMX' && activeTab !== 'Drivers' && selectedWeek && !loading && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete {TAB_MAP.find(t => t.slug === activeTab)?.label || activeTab} Data
            </Button>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" /> Delete Week Data
              </DialogTitle>
              <DialogDescription>
                This will permanently delete all <strong>{TAB_MAP.find(t => t.slug === activeTab)?.label || activeTab}</strong> data
                for week <strong>{selectedWeek}</strong>. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                className="gap-1.5"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(
                      `/api/scorecard/delete-week?week=${encodeURIComponent(selectedWeek)}&tab=${encodeURIComponent(activeTab)}`,
                      { method: 'DELETE' }
                    );
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to delete');
                    toast.success(`Deleted ${data.deleted} record${data.deleted !== 1 ? 's' : ''} for ${activeTab} — ${selectedWeek}`);
                    setDeleteConfirmOpen(false);
                    // Refresh data
                    if (selectedWeek) fetchData(selectedWeek);
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to delete data');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (<>

          {activeTab === 'Drivers' && (
            <DriversTab
              drivers={drivers}
              driverSearch={driverSearch}
              sortKey={sortKey}
              sortDir={sortDir}
              setSortKey={setSortKey}
              setSortDir={(d) => setSortDir(d)}
              signatureMap={signatureMap}
              onSelectDriver={setSelectedDriver}
              onPlayVideo={setVideoDialogUrl}
            />
          )}

          {activeTab === 'SYMX' && (
            <SYMXTab
              dspMetrics={dspMetrics}
              selectedWeek={selectedWeek}
              totalDrivers={totalDrivers}
              totalDelivered={totalDelivered}
              driversWithIssues={drivers.filter(d => d.issueCount > 0).length}
              currentTips={currentTips}
            />
          )}

          {activeTab === 'POD' && (
            <PodTab podRows={podRows} />
          )}

          {activeTab === 'CDF-Negative' && (
            <CdfNegativeTab cdfNegativeRows={cdfNegativeRows} />
          )}

          {activeTab === 'Delivery-Excellence' && (
            <DeliveryExcellenceTab deliveryExcellenceRows={deliveryExcellenceRows} />
          )}

          {activeTab === 'DCR' && (
            <DcrTab dcrRows={dcrRows} />
          )}

          {activeTab === 'DSB' && (
            <DsbTab dsbRows={dsbRows} />
          )}

          {activeTab === 'Safety' && (
            <SafetyTab safetyRows={safetyRows} onPlayVideo={setVideoDialogUrl} />
          )}

          {activeTab === 'DVIC' && (
            <DvicTab dvicRawRows={dvicRawRows} />
          )}

          {activeTab === 'RTS' && (
            <RtsTab rtsRows={rtsRows} />
          )}

        </>)}

        {/* ══ PRINT-ONLY: Weekly Driver Coaching Report ══ */}
        <div ref={reportRef} className="hidden print:block">
          <div className="text-center mb-8 pt-8">
            <h1 className="text-2xl font-bold mb-2">Weekly Driver Coaching Report</h1>
            <p className="text-lg text-gray-600">DFO2 / SYMX — {selectedWeek}</p>
            <Separator className="my-6" />
          </div>
          {drivers.map((driver) => (
            <div key={driver.transporterId} className="mb-6 border border-gray-300 rounded-lg p-4 break-inside-avoid">
              <div className="flex justify-between items-start mb-3">
                <div><span className="font-bold text-base">{driver.name}</span><span className="text-sm text-gray-500 ml-2">({driver.transporterId})</span></div>
                <div className="text-sm text-gray-500 text-right">Coached: ☐ Yes ☐ No &nbsp;&nbsp; DA Initials: ____ &nbsp;&nbsp; Mgr: __ &nbsp;&nbsp; Date: ___/___</div>
              </div>
              <div className="font-bold text-sm mb-1">DSB: {driver.dsb} &nbsp;|&nbsp; POD Rejects: {driver.podRejects}</div>
              <div className="text-xs text-gray-600 mb-3">Overall: {driver.overallScore ?? "N/A"} ({driver.overallStanding}), FICO: {driver.ficoMetric ?? "No Data"} ({driver.ficoTier}), DCR: {driver.dcr} ({driver.dcrTier}), POD: {driver.pod} ({driver.podTier})</div>
              <div className="text-sm mb-2">
                <span className="font-semibold">Issues to Address:</span>
                {driver.podRejects === 0 && driver.dsb === 0
                  ? <span className="text-gray-500 ml-2">No issues flagged this week.</span>
                  : <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                    {driver.podRejects > 0 && <li>POD Rejects ({driver.podRejects}): {Object.entries(driver.podRejectBreakdown).sort(([, a], [, b]) => b - a).map(([r, c]) => `${r}: ${c}`).join(", ")}</li>}
                    {driver.dsb > 0 && <li>DSB: {driver.dsb} delivery success behavior event(s)</li>}
                  </ul>
                }
              </div>
            </div>
          ))}
        </div>

        <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { margin: 0.75in; size: letter; }
        }
      `}</style>
      </div>
      {/* ═══ DRIVER DETAIL DIALOG ═══ */}
      <DriverDetailDialog
        selectedDriver={selectedDriver}
        drivers={drivers}
        selectedWeek={selectedWeek}
        loggedInUserName={loggedInUserName}
        driverRemarks={driverRemarks}
        setDriverRemarks={setDriverRemarks}
        managerRemarks={managerRemarks}
        setManagerRemarks={setManagerRemarks}
        driverSignature={driverSignature}
        setDriverSignature={setDriverSignature}
        managerSignature={managerSignature}
        setManagerSignature={setManagerSignature}
        driverSigTimestamp={driverSigTimestamp}
        managerSigTimestamp={managerSigTimestamp}
        savingRemarks={savingRemarks}
        saveRemarks={saveRemarks}
        onClose={() => setSelectedDriver(null)}
      />

      <Dialog open={!!videoDialogUrl} onOpenChange={() => setVideoDialogUrl(null)}>
        <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-blue-500" />
              Safety Event Video
            </DialogTitle>
            <DialogDescription>Video from ScoreCard Safety Dashboard</DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4">
            {videoDialogUrl && (
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={videoDialogUrl!}
                  controls
                  autoPlay
                  className="w-full h-full"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}

// Wrap with Suspense for useSearchParams (required by Next.js App Router)
export default function EmployeePerformanceDashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <EmployeePerformanceDashboardInner />
    </Suspense>
  );
}
