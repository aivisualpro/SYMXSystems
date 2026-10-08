"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";

type ReportType = "cdf-negative" | "daily-dsb-concessions";
type Preview = { reportType: ReportType; reportLabel: string; site: string; week: string; rows: number; matched: number; unmatched: number; impacting: number };

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
}

function detectReport(headers: string[]): ReportType | null {
  const normalized = new Set(headers.map(normalizeHeader));
  const hasTracking = normalized.has("tracking id") || normalized.has("tracking id / tba") || normalized.has("tba");
  if (hasTracking && normalized.has("concession date") && normalized.has("impacts scorecard")) return "daily-dsb-concessions";
  if (hasTracking && (normalized.has("feedback details") || normalized.has("da mishandled package") || normalized.has("delivered to wrong address"))) return "cdf-negative";
  return null;
}

async function hashFile(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export function QualityDetailImport({ enabled, week, onImported }: { enabled: boolean; week: string; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileHash, setFileHash] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  function reset() {
    setFile(null); setRows([]); setFileHash(""); setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze(selected?: File) {
    if (!selected) return;
    setBusy(true); reset();
    Papa.parse<Record<string, unknown>>(selected, {
      header: true, skipEmptyLines: true,
      complete: async result => {
        try {
          const parsedRows = result.data.filter(row => Object.values(row).some(value => String(value ?? "").trim()));
          const reportType = detectReport(result.meta.fields || []);
          if (!reportType) throw new Error("This is not a recognized CDF Negative or DSB / Delivery Concessions report.");
          const hash = await hashFile(selected);
          const response = await fetch("/api/driver-rankings/quality-detail-import", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "preview", reportType, week, fileName: selected.name, fileHash: hash, rows: parsedRows }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Could not preview this report.");
          setFile(selected); setRows(parsedRows); setFileHash(hash); setPreview(body);
        } catch (error) { notify.error(error instanceof Error ? error.message : "Could not read this report."); }
        finally { setBusy(false); }
      },
      error: error => { notify.error(error.message); setBusy(false); },
    });
  }

  async function commit() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const response = await fetch("/api/driver-rankings/quality-detail-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", reportType: preview.reportType, week: preview.week, fileName: file.name, fileHash, rows }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed.");
      notify.success(`${preview.reportLabel} imported: ${body.inserted} added, ${body.updated} updated`);
      reset(); setOpen(false); onImported();
    } catch (error) { notify.error(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }

  return <>
    <Button size="sm" variant="outline" disabled={!enabled} onClick={() => setOpen(true)}><Upload className="size-4"/>Import CDF / DSB Details</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (!value) reset(); } }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Import Quality Details</DialogTitle><DialogDescription>Upload one CDF Negative or DSB / Delivery Concessions CSV for {week || "the selected week"}.</DialogDescription></DialogHeader>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => void analyze(event.target.files?.[0])}/>
        {!preview ? <button type="button" disabled={busy || !week} onClick={() => inputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 hover:bg-muted/40 disabled:opacity-50">{busy ? <Loader2 className="size-7 animate-spin"/> : <Upload className="size-7 text-muted-foreground"/>}<span className="text-sm font-medium">Choose Amazon CSV</span></button> : <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border p-3"><FileText className="size-5 text-muted-foreground"/><div className="min-w-0"><p className="truncate text-sm font-medium">{file?.name}</p><p className="text-xs text-muted-foreground">{preview.reportLabel} · {preview.site} · {preview.week}</p></div></div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{[["Rows", preview.rows], ["Matched", preview.matched], ["Unmatched", preview.unmatched], ["Impacting", preview.impacting]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={reset}>Choose another</Button><Button disabled={busy} onClick={() => void commit()}>{busy ? "Importing..." : "Import"}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
