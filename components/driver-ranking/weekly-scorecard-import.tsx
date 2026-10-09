"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSiteContext } from "@/components/providers/site-context-provider";
import { notify } from "@/lib/notify";

type Preview = {
  reportLabel: string; periodType: string; site: string; selectedSite: string; targetSiteId: string; week: string;
  rows: number; matchedDrivers: number; unmatchedDrivers: number; newCount: number; updateCount: number;
  wrongStation: boolean; exactDuplicate: boolean; sameWeekDifferentFile: boolean;
};

async function fingerprint(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export function WeeklyScorecardImport({ enabled, onImported }: { enabled: boolean; onImported: (week: string) => void }) {
  const { setContext } = useSiteContext();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [hash, setHash] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stationConfirmed, setStationConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() { setFile(null); setRows([]); setHash(""); setPreview(null); setStationConfirmed(false); if (input.current) input.current.value = ""; }
  async function choose(chosen?: File) {
    if (!chosen) return;
    setBusy(true); reset();
    try {
      const parsed = await new Promise<Record<string, unknown>[]>((resolve, reject) => Papa.parse<Record<string, unknown>>(chosen, {
        header: true, skipEmptyLines: "greedy", transformHeader: header => header.replace(/^\uFEFF/, "").trim(),
        complete: result => result.errors.length ? reject(new Error(result.errors[0].message)) : resolve(result.data), error: reject,
      }));
      const fileHash = await fingerprint(chosen);
      const response = await fetch("/api/driver-rankings/weekly-scorecard-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", reportType: "delivery-excellence", periodType: "Weekly", rows: parsed, fileName: chosen.name, fileHash }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.errors?.join(" ") || body.error || "Preview failed.");
      setFile(chosen); setRows(parsed); setHash(fileHash); setPreview(body);
    } catch (error) { notify.error(error instanceof Error ? error.message : "Could not read Weekly Scorecard."); }
    finally { setBusy(false); }
  }
  async function commit(confirmWeekUpdate = false) {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const response = await fetch("/api/driver-rankings/weekly-scorecard-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", reportType: "delivery-excellence", periodType: "Weekly", week: preview.week, rows, fileName: file.name, fileHash: hash, targetSiteId: preview.targetSiteId, confirmWeekUpdate }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed.");
      const importedWeek = body.week || preview.week;
      const importedToDifferentStation = preview.wrongStation;
      const importedSiteId = preview.targetSiteId;
      notify.success("Weekly Scorecard imported");
      setOpen(false); reset();
      if (importedToDifferentStation) await setContext("single", [importedSiteId]);
      else onImported(importedWeek);
    } catch (error) { notify.error(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }

  if (!enabled) return null;
  const showWrongStation = !!preview?.wrongStation && !stationConfirmed;
  const showDuplicate = !!preview?.exactDuplicate;
  const showWeekUpdate = !!preview?.sameWeekDifferentFile && (!preview.wrongStation || stationConfirmed);
  const title = showWrongStation ? "Wrong Station Detected" : showDuplicate ? "Duplicate File" : showWeekUpdate ? "Updated Scorecard Detected" : "Import Weekly Scorecard";
  const description = showWrongStation
    ? `This file belongs to ${preview?.site}, but you're currently viewing ${preview?.selectedSite}.`
    : showDuplicate
      ? `This scorecard has already been uploaded for ${preview?.site}, Week ${preview?.week.split("-W")[1]}.`
      : showWeekUpdate
        ? `A different scorecard has already been uploaded for ${preview?.site}, Week ${preview?.week.split("-W")[1]}. Do you want to replace/update it?`
        : "Validate the complete Amazon Weekly Driver Scorecard before importing.";
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Upload className="size-4" />Import Weekly Scorecard</Button>
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={event => void choose(event.target.files?.[0])} />
    <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (!value) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        {showWrongStation && !showDuplicate && <p className="text-sm">Would you like to upload it to {preview?.site} instead?</p>}
        {showWrongStation && showDuplicate && <p className="text-sm">This scorecard has already been uploaded to {preview?.site} for Week {preview?.week.split("-W")[1]}.</p>}
        {!file ? <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}><Upload className="size-4" />{busy ? "Validating..." : "Choose CSV"}</Button> : <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="truncate">{file.name}</span><Button size="icon" variant="ghost" onClick={reset} disabled={busy} aria-label="Remove file"><X className="size-4" /></Button></div>}
        {preview && <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
          {[['Report', preview.reportLabel], ['Period', preview.periodType], ['Site', preview.site], ['Week', preview.week], ['Rows', preview.rows], ['Matched Drivers', preview.matchedDrivers], ['Unmatched Drivers', preview.unmatchedDrivers], ['New', preview.newCount], ['Updates', preview.updateCount]].map(([label, value]) => <div key={String(label)}><span className="text-xs text-muted-foreground">{label}</span><p className="font-medium">{value}</p></div>)}
        </div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          {showWrongStation && !showDuplicate ? <Button onClick={() => setStationConfirmed(true)} disabled={busy}>Upload to {preview?.site}</Button>
            : showWeekUpdate ? <Button onClick={() => void commit(true)} disabled={busy}>{busy ? "Importing..." : `Update ${preview?.week.replace(/^\d{4}-W/, "Week ")}`}</Button>
              : !showDuplicate && <Button onClick={() => void commit()} disabled={!preview || busy}>{busy ? "Importing..." : "Import Weekly Scorecard"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
