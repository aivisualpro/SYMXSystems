"use client";

import { useState, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Receipt,
  Truck,
  Wrench,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface ImportResult {
  success: boolean;
  count: number;
  inserted: number;
  updated: number;
  matched?: number;
}

const CHUNK_SIZE = 500; // Rows per batch to stay under Vercel's 4.5MB limit

const importTypes = [
  {
    id: "employee-schedules",
    name: "Employee Schedules",
    description: "Import weekly employee schedule data from CSV. Fields: Week Day, Year Week, Transporter ID, Date, Status, Type, Sub Type, Training Day, Start Time, Confirmations, Van, Note.",
    icon: CalendarDays,
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    iconColor: "text-blue-500",
    fields: [
      "Week Day", "Year Week", "Transporter ID", "Date", "Status",
      "Type", "Sub Type", "Training Day", "Start Time",
      "Day Before Confirmation", "Day Of Confirmation",
      "Week Confirmation", "Van", "Note",
    ],
  },
  {
    id: "reimbursement",
    name: "Reimbursement",
    description: "Import employee reimbursement records from CSV.",
    icon: Receipt,
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    iconColor: "text-emerald-500",
    fields: [
      "_id", "transporterId", "date", "amount", "reason",
      "attachment", "status", "createdBy", "createdAt",
    ],
  },
  {
    id: "fleet-records",
    name: "Fleet Records",
    description: "Import fleet vehicle records from CSV. Upserts on VIN — existing vehicles are updated, new ones are created.",
    icon: Truck,
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    iconColor: "text-orange-500",
    fields: [
      "VIN", "Year", "Vehicle Name", "License Plate", "Make", "Model",
      "Status", "Mileage", "Service Type", "Dashcam", "Vehicle Provider",
      "Ownership", "Unit #", "Start Date", "End Date",
      "Registration Expiration", "State", "Location", "Notes", "Info",
      "Image", "Location From",
    ],
  },
  {
    id: "fleet-repairs",
    name: "Fleet Repairs",
    description: "Import fleet repair records from CSV. VIN is used to link repairs to vehicles. Upserts on VIN + Description + Creation Date.",
    icon: Wrench,
    color: "from-rose-500 to-pink-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    iconColor: "text-rose-500",
    fields: [
      "VIN", "Description", "Current Status", "Estimated Date",
      "Image", "Creation Date", "LastEditOn", "Repair", "Repair Duration",
    ],
  },
  {
    id: "daily-inspections",
    name: "Daily Inspections",
    description: "Import daily vehicle inspection records from CSV. Upserts on Routes ID + VIN + Route Date. Links vehicles by VIN automatically.",
    icon: ClipboardCheck,
    color: "from-violet-500 to-purple-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    iconColor: "text-violet-500",
    fields: [
      "Routes ID", "Driver", "Route Date", "Vin",
      "Vehicle Picture 1", "Vehicle Picture 2", "Vehicle Picture 3", "Vehicle Picture 4",
      "Mileage", "Dashboard Image", "Comments", "Additional Picture",
      "Inspected By", "TimeStamp", "Any Repairs",
      "Description", "Current Status", "Estimated Date", "Image", "iSCompared?",
    ],
  },
];

export default function ImportsSettingsPage() {
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string>("");
  const [lastResult, setLastResult] = useState<Record<string, ImportResult | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeImportType, setActiveImportType] = useState<string | null>(null);

  const handleImportClick = (typeId: string) => {
    setActiveImportType(typeId);
    fileRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeImportType) return;
    e.target.value = "";

    setIsImporting(activeImportType);
    setImportProgress("Parsing CSV...");
    setLastResult((prev) => ({ ...prev, [activeImportType]: null }));

    try {
      // Parse CSV
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err),
        });
      });

      if (parsed.length === 0) {
        toast.error("CSV file is empty or has no valid rows");
        setIsImporting(null);
        setImportProgress("");
        return;
      }

      // Split into chunks to avoid Vercel 4.5MB body limit
      const chunks: any[][] = [];
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
        chunks.push(parsed.slice(i, i + CHUNK_SIZE));
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        setImportProgress(`Uploading batch ${i + 1} of ${chunks.length} (${chunks[i].length} rows)...`);

        const res = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: activeImportType,
            data: chunks[i],
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || `Import failed on batch ${i + 1}`);
        }

        totalInserted += result.inserted || 0;
        totalUpdated += result.updated || 0;
        totalCount += result.count || 0;
      }

      const finalResult: ImportResult = {
        success: true,
        count: totalCount,
        inserted: totalInserted,
        updated: totalUpdated,
      };

      setLastResult((prev) => ({ ...prev, [activeImportType]: finalResult }));
      toast.success(
        `Imported ${totalCount} records (${totalInserted} new, ${totalUpdated} updated)${chunks.length > 1 ? ` in ${chunks.length} batches` : ""}`
      );
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setLastResult((prev) => ({
        ...prev,
        [activeImportType]: { success: false, count: 0, inserted: 0, updated: 0 },
      }));
    } finally {
      setIsImporting(null);
      setImportProgress("");
      setActiveImportType(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Imports</h3>
        <p className="text-sm text-muted-foreground">
          Import data from CSV files into the system.
        </p>
      </div>
      <Separator />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileSelect}
      />

      <div className="grid gap-4">
        {importTypes.map((importType) => {
          const isActive = isImporting === importType.id;
          const result = lastResult[importType.id];

          return (
            <div
              key={importType.id}
              className={`relative overflow-hidden rounded-xl border ${importType.borderColor} bg-card p-6 transition-all hover:shadow-md`}
            >
              {/* Gradient accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${importType.color}`} />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${importType.bgColor}`}>
                    <importType.icon className={`h-6 w-6 ${importType.iconColor}`} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-semibold">{importType.name}</h4>
                    <p className="text-sm text-muted-foreground max-w-lg">
                      {importType.description}
                    </p>
                    {isActive && importProgress && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <span className="text-xs text-blue-500 font-medium">{importProgress}</span>
                      </div>
                    )}
                    {result && !isActive && (
                      <div className="flex items-center gap-2 mt-2">
                        {result.success !== false ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs text-emerald-500 font-medium">
                              {result.count} records processed ({result.inserted} new, {result.updated} updated)
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-500 font-medium">Import failed</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImportClick(importType.id)}
                  disabled={isActive}
                  className="shrink-0 gap-2"
                >
                  {isActive ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import CSV
                    </>
                  )}
                </Button>
              </div>

              {/* Expected CSV schema preview */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {importType.fields.map((field) => (
                  <Badge
                    key={field}
                    variant="secondary"
                    className="text-[10px] font-mono bg-muted/50 text-muted-foreground"
                  >
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
