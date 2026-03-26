"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  CalendarDays,
  Receipt,
  Truck,
  Wrench,
  ClipboardCheck,
  FileText,
  Users,
  ListFilter,
  MapPin,
  Shield,
  Ticket,
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
    id: "employees",
    name: "Employees",
    description: "Import employee records from CSV. Upserts on Email — existing employees are updated, new ones are created.",
    icon: Users,
    color: "from-indigo-500 to-blue-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
    iconColor: "text-indigo-500",
    fields: [
      "firstName", "lastName", "email", "transporterId", "eeCode",
      "badgeNumber", "gender", "type", "phoneNumber",
      "streetAddress", "city", "state", "zipCode",
      "hiredDate", "dob", "hourlyStatus", "rate",
      "gasCardPin", "dlExpiration", "motorVehicleReportDate",
      "status", "sunday", "monday", "tuesday", "wednesday",
      "thursday", "friday", "saturday",
      "defaultVan1", "defaultVan2", "defaultVan3",
      "routesComp", "ScheduleNotes",
    ],
  },
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
      "transporterId", "date", "amount", "reason",
      "attachment", "status", "createdBy", "createdAt",
    ],
  },
  {
    id: "claims",
    name: "Incidents",
    description: "Import employee incident records from CSV.",
    icon: Shield,
    color: "from-rose-500 to-pink-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    iconColor: "text-rose-500",
    fields: [
      "ReportedDate", "IncidentDate", "Transporter ID", "ClaimType", "Van",
      "ClaimantName", "ShortDescription", "ClaimNumber", "ClaimantLawyer",
      "ClaimStatus", "StatusDetail", "CoverageDescription", "ClaimIncurred",
      "Employee Notes", "Supervisor Notes", "Third Party Name", "Third Party Phone",
      "Third Party Email", "With Insurance", "Insurance Policy", "Paid", "Reserved",
      "createdBy", "createdAt", "IncidentUploadFile",
    ],
  },
  {
    id: "hr-tickets",
    name: "HR Tickets",
    description: "Import HR ticket records from CSV. No fields are required — all are optional.",
    icon: Ticket,
    color: "from-purple-500 to-violet-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    iconColor: "text-purple-500",
    fields: [
      "createdAt", "Ticket #", "Transporter ID", "Category", "Issue",
      "Attachment", "Managers Email", "Notes", "Approve / Deny",
      "Resolution", "Hold Reason", "Closed DateTime", "Closed By",
      "Closed Ticket Sent",
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
  {
    id: "rental-agreements",
    name: "Rental Agreements",
    description: "Import fleet rental agreement records from CSV. Upserts on Agreement # + VIN. Links vehicles by VIN automatically.",
    icon: FileText,
    color: "from-teal-500 to-cyan-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/20",
    iconColor: "text-teal-500",
    fields: [
      "Unit #", "Vin", "Invoice #", "Agreement #",
      "R. Start Date", "R. End Date", "Due Date",
      "Amount", "File", "Image",
    ],
  },
  {
    id: "fleet-communications",
    name: "Fleet Communications",
    description: "Import fleet communications from CSV. Requires vin to link to vehicles.",
    icon: FileText,
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    iconColor: "text-blue-500",
    fields: [
      "vin", "date", "status", "comments", "createdBy", "createdAt"
    ],
  },
  {
    id: "dropdowns",
    name: "Dropdowns",
    description: "Import dropdown options from CSV. Upserts on Description + Type. Fields: description, type.",
    icon: ListFilter,
    color: "from-sky-500 to-blue-500",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
    iconColor: "text-sky-500",
    fields: ["description", "type"],
  },
  {
    id: "dispatching-routes",
    name: "Dispatching Routes",
    description: "Import dispatching route records from CSV. Upserts on Transporter ID + Date. Auto-syncs route info fields to Routes Info.",
    icon: MapPin,
    color: "from-orange-500 to-rose-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    iconColor: "text-orange-500",
    endpoint: "/api/dispatching/routes/import",
    fields: [
      "date", "yearWeek", "transporterId", "type", "subType", "trainingDay",
      "routeSize", "van", "serviceType", "dashcam", "routeNumber",
      "stopCount", "packageCount", "routeDuration", "waveTime", "pad",
      "wst", "wstDuration", "wstRevenue", "notes", "stagingLocation",
      "extraStops", "stopsRescued", "departureDelay", "actualDepartureTime",
      "plannedOutboundStem", "actualOutboundStem", "outboundDelay",
      "plannedFirstStop", "actualFirstStop", "firstStopDelay",
      "plannedLastStop", "actualLastStop", "lastStopDelay",
      "plannedRTSTime", "plannedInboundStem", "estimatedRTSTime",
      "plannedDuration1stToLast", "actualDuration1stToLast", "stopsPerHour",
      "deliveryCompletionTime", "dctDelay", "driverEfficiency",
      "attendance", "attendanceTime",
      "amazonOutLunch", "amazonInLunch", "amazonAppLogout", "inspectionTime",
      "paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay",
      "driversUpdatedForLunch", "totalHours", "regHrs", "otHrs",
      "totalCost", "regPay", "otPay", "punchStatus", "whc",
      "createdAt", "createdBy", "bags", "ov",
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

        const importTypeDef = importTypes.find((t) => t.id === activeImportType);
        const apiEndpoint = importTypeDef?.endpoint || "/api/admin/imports";

        for (let i = 0; i < chunks.length; i++) {
          setImportProgress(`Uploading batch ${i + 1} of ${chunks.length} (${chunks[i].length} rows)...`);

          const res = await fetch(apiEndpoint, {
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
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileSelect}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {importTypes.map((importType) => {
          const isActive = isImporting === importType.id;
          const result = lastResult[importType.id];

          return (
            <button
              key={importType.id}
              onClick={() => handleImportClick(importType.id)}
              disabled={isActive}
              className={`relative overflow-hidden rounded-xl border ${importType.borderColor} bg-card p-4 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left disabled:opacity-60 disabled:cursor-wait`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${importType.color}`} />

              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${importType.bgColor}`}>
                  {isActive ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${importType.iconColor}`} />
                  ) : (
                    <importType.icon className={`h-4 w-4 ${importType.iconColor}`} />
                  )}
                </div>
                <span className="text-sm font-semibold truncate">{importType.name}</span>
              </div>

              {isActive && importProgress && (
                <p className="text-[10px] text-blue-500 font-medium mt-2 truncate">{importProgress}</p>
              )}
              {result && !isActive && (
                <p className={`text-[10px] font-medium mt-2 truncate ${result.success !== false ? "text-emerald-500" : "text-red-500"}`}>
                  {result.success !== false
                    ? `✓ ${result.count} (${result.inserted} new, ${result.updated} updated)`
                    : "✗ Import failed"}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
