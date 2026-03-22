
"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { formatPhoneNumber, cn } from "@/lib/utils";
import { EmployeeForm } from "@/components/admin/employee-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Search, User, CheckCircle2, Minus, Coffee } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useSearchParams } from "next/navigation";
import { useDataStore } from "@/hooks/use-data-store";

// ── Schedule Type Option from dropdowns ──
interface ScheduleTypeOption {
  _id: string;
  description: string;
  type: string;
  color: string;
  icon: string;
  isActive: boolean;
}

// Determine if color is light or dark to choose text color
function isLightColor(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

export default function EmployeesPage() {
  const store = useDataStore();
  const [data, setData] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showTerminated, setShowTerminated] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [fetchedFromApi, setFetchedFromApi] = useState(false);
  const PAGE_SIZE = 50;
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Read from store (instant, no loading) ──
  const storeEmployees = store.employees as any;
  const storeVehicles = store.fleet?.vehicles as any[] ?? [];
  const storeDropdowns = store.admin?.dropdowns as any[] ?? [];

  // Vehicle names from store
  const vehicleNames = useMemo(() => {
    if (!Array.isArray(storeVehicles)) return [];
    return storeVehicles
      .map((v: any) => v.vehicleName)
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
  }, [storeVehicles]);

  // Schedule types from store
  const scheduleTypes = useMemo<ScheduleTypeOption[]>(() => {
    if (!Array.isArray(storeDropdowns)) return [];
    return storeDropdowns.filter((d: any) => 
      d.type === "schedule type" && d.isActive !== false
    );
  }, [storeDropdowns]);

  const scheduleTypeMap = useMemo(() => {
    const map = new Map<string, ScheduleTypeOption>();
    scheduleTypes.forEach(st => map.set(st.description.toLowerCase(), st));
    return map;
  }, [scheduleTypes]);

  // Check if any filters/search are active (requires API call)
  const hasUrlFilters = searchParams.get('status') || searchParams.get('type') || searchParams.get('filter') || searchParams.get('hourlyStatus');
  const needsApiCall = !!debouncedSearch || !!hasUrlFilters || showTerminated;

  // ── Sync from store when no filters are active ──
  useEffect(() => {
    if (!needsApiCall && storeEmployees?.records?.length > 0 && !fetchedFromApi) {
      setData(storeEmployees.records);
      setTotalCount(storeEmployees.totalCount || storeEmployees.records.length);
      setHasMore(storeEmployees.hasMore || false);
      setLoading(false);
    }
  }, [storeEmployees, needsApiCall, fetchedFromApi]);

  // ── Show loading only if store has no data yet AND no API call is pending ──
  const isInitialLoading = !needsApiCall && (!storeEmployees?.records || storeEmployees.records.length === 0) && !store.initialized;

  // Inline update helper
  const updateEmployeeField = async (id: string, field: string, value: string) => {
    try {
      // Optimistic update
      setData(prev => prev.map(emp =>
        String(emp._id) === id ? { ...emp, [field]: value } as any : emp
      ));
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to update");
      fetchEmployees(true);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const fetchEmployees = async (reset = true) => {
    const skip = reset ? 0 : data.length;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: PAGE_SIZE.toString(),
        terminated: showTerminated.toString()
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      // Add URL filters forwarded from the browser URL (clicked from dashboard)
      const queryStatus = searchParams.get('status');
      const queryType = searchParams.get('type');
      const queryFilter = searchParams.get('filter');
      const queryHourly = searchParams.get('hourlyStatus');
      
      if (queryStatus) params.set("status", queryStatus);
      if (queryType) params.set("type", queryType);
      if (queryFilter) params.set("filter", queryFilter);
      if (queryHourly) params.set("hourlyStatus", queryHourly);

      const response = await fetch(`/api/admin/employees?${params}`);
      if (response.ok) {
        const result = await response.json();

        let fetchedData = result.records || result;

        if (reset) {
          setData(fetchedData);
        } else {
          setData(prev => {
            // Deduplicate by ID just in case
            const existingIds = new Set(prev.map(e => String(e._id)));
            const newRecords = fetchedData.filter((e: any) => !existingIds.has(String(e._id)));
            return [...prev, ...newRecords];
          });
        }
        setTotalCount(result.totalCount || fetchedData.length);
        setHasMore(result.hasMore || false);
        setFetchedFromApi(true);
      } else {
        toast.error("Failed to fetch employees");
      }
    } catch (error) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Only fetch from API when filters/search/terminated are active
  useEffect(() => {
    if (needsApiCall) {
      fetchEmployees(true);
    } else {
      setFetchedFromApi(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, showTerminated, searchParams]);

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const url = editingItem?._id
        ? `/api/admin/employees/${editingItem._id}`
        : "/api/admin/employees";
      const method = editingItem?._id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save employee");
      }

      toast.success(editingItem?._id ? "Employee updated successfully" : "Employee created successfully");
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;

    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete employee");
      toast.success("Employee deleted successfully");
      fetchEmployees();
    } catch (error) {
      toast.error("Failed to delete employee");
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ISymxEmployee) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  // Helper for file link cells
  const FileLinkCell = ({ value }: { value?: string }) => {
    if (!value) return null;
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        View
      </a>
    );
  };

  const columns: ColumnDef<ISymxEmployee>[] = [
    {
      id: "profileImage",
      header: "Image",
      cell: ({ row }) => {
        const img = row.original.profileImage;
        return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
          {img ? (
            <>
              <img
                src={img}
                alt="User"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
                  }
                }}
              />
              <span className="h-full w-full items-center justify-center hidden">
                <User className="h-5 w-5 text-muted-foreground" />
              </span>
            </>
          ) : (
            <User className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        );
      },
    },
    {
      id: "fullName",
      header: "Name",
      accessorFn: (row) => `${row.firstName || ""} ${row.lastName || ""}`.trim(),
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {`${row.original.firstName || ""} ${row.original.lastName || ""}`.trim() || "—"}
        </span>
      ),
    },
    { accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => formatPhoneNumber(row.original.phoneNumber || "")
    },
    { accessorKey: "type", header: "Type" },
    // Availability — colored chip dropdowns from schedule type dropdown options
    ...(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).map(day => ({
      accessorKey: day,
      header: day.charAt(0).toUpperCase() + day.slice(1, 3),
      cell: ({ row }: any) => {
        const val = row.original[day] || "OFF";
        const matched = scheduleTypeMap.get(val.toLowerCase());
        const chipColor = matched?.color || "";
        const chipIconName = matched?.icon || "";
        const ChipIcon = chipIconName ? (LucideIcons as any)[chipIconName] : null;

        // OFF special styling
        const isOff = val.toLowerCase() === "off" || val.trim() === "";
        const bgStyle = isOff
          ? {}
          : chipColor
            ? { backgroundColor: chipColor }
            : { backgroundColor: "#6B7280" };
        const textStyle = isOff
          ? {}
          : chipColor && isLightColor(chipColor)
            ? { color: "#1a1a1a" }
            : { color: "#fff" };
        const borderStyle = isOff
          ? {}
          : chipColor
            ? { borderColor: chipColor }
            : { borderColor: "#6B7280" };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "relative flex items-center justify-center gap-0.5 h-7 rounded-md text-[10px] font-semibold transition-all border cursor-pointer select-none px-1.5 min-w-[80px]",
                  isOff
                    ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600"
                    : "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                )}
                style={isOff ? {} : { ...bgStyle, ...borderStyle }}
              >
                {isOff ? (
                  <Coffee className="h-3 w-3 shrink-0 mr-0.5" />
                ) : ChipIcon ? (
                  <ChipIcon className="h-3 w-3 shrink-0 mr-0.5" style={textStyle} />
                ) : null}
                <span className="truncate" style={isOff ? {} : textStyle}>{val || "OFF"}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="w-48 max-h-[320px] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Change Schedule
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* OFF option */}
              <DropdownMenuItem
                className={cn(
                  "flex items-center gap-2 cursor-pointer text-xs",
                  val.toLowerCase() === "off" && "bg-accent"
                )}
                onClick={() => updateEmployeeField(String(row.original._id), day, "OFF")}
              >
                <div className="h-5 w-5 rounded flex items-center justify-center shrink-0 bg-zinc-200 dark:bg-zinc-600">
                  <Coffee className="h-3 w-3 text-zinc-500 dark:text-zinc-300" />
                </div>
                <span className="font-medium">OFF</span>
                {val.toLowerCase() === "off" && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
              </DropdownMenuItem>
              {/* Dynamic schedule type options */}
              {scheduleTypes.map(opt => {
                const OptIcon = opt.icon ? (LucideIcons as any)[opt.icon] : null;
                const isActive = val.toLowerCase() === opt.description.toLowerCase();
                return (
                  <DropdownMenuItem
                    key={opt._id}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer text-xs",
                      isActive && "bg-accent"
                    )}
                    onClick={() => updateEmployeeField(String(row.original._id), day, opt.description)}
                  >
                    <div
                      className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: opt.color || "#6B7280" }}
                    >
                      {OptIcon ? (
                        <OptIcon className="h-3 w-3" style={{ color: opt.color && isLightColor(opt.color) ? "#1a1a1a" : "#fff" }} />
                      ) : (
                        <Minus className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="font-medium">{opt.description}</span>
                    {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    })),
    // Default Vans — chip-style dropdowns from fleet vehicles
    ...(['defaultVan1', 'defaultVan2', 'defaultVan3'] as const).map((field, idx) => {
      const vanColors = ['#2563EB', '#0D9488', '#7C3AED'] as const;
      const vanColor = vanColors[idx];
      return {
        accessorKey: field,
        header: ['Primary', 'Backup 1', 'Backup 2'][idx],
        cell: ({ row }: any) => {
          const val = row.original[field] || "";
          const hasVan = !!val;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "relative flex items-center justify-center gap-0.5 h-7 rounded-md text-[10px] font-semibold transition-all border cursor-pointer select-none px-1.5 min-w-[80px]",
                    hasVan
                      ? "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600"
                  )}
                  style={hasVan ? { backgroundColor: vanColor, borderColor: vanColor, color: '#fff' } : {}}
                >
                  <LucideIcons.Truck className="h-3 w-3 shrink-0 mr-0.5" style={hasVan ? { color: '#fff' } : {}} />
                  <span className="truncate">{val || "None"}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                className="w-48 max-h-[320px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {['Primary Van', 'Backup Van 1', 'Backup Van 2'][idx]}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-2 cursor-pointer text-xs",
                    !hasVan && "bg-accent"
                  )}
                  onClick={() => updateEmployeeField(String(row.original._id), field, "")}
                >
                  <div className="h-5 w-5 rounded flex items-center justify-center shrink-0 bg-zinc-200 dark:bg-zinc-600">
                    <Minus className="h-3 w-3 text-zinc-500 dark:text-zinc-300" />
                  </div>
                  <span className="font-medium text-muted-foreground">— None —</span>
                  {!hasVan && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                </DropdownMenuItem>
                {vehicleNames.map(name => {
                  const isActive = val === name;
                  return (
                    <DropdownMenuItem
                      key={name}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer text-xs",
                        isActive && "bg-accent"
                      )}
                      onClick={() => updateEmployeeField(String(row.original._id), field, name)}
                    >
                      <div
                        className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: vanColor }}
                      >
                        <LucideIcons.Truck className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium">{name}</span>
                      {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      };
    }),
    // Status — chip-style dropdown
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const val = row.original.status || "Active";
        const STATUS_OPTS: { label: string; color: string; icon: keyof typeof LucideIcons }[] = [
          { label: "Active", color: "#059669", icon: "CheckCircle2" },
          { label: "Inactive", color: "#D97706", icon: "PauseCircle" },
          { label: "Terminated", color: "#DC2626", icon: "XCircle" },
          { label: "Resigned", color: "#7C3AED", icon: "LogOut" },
        ];
        const matched = STATUS_OPTS.find(s => s.label === val) || STATUS_OPTS[0];
        const StatusIcon = (LucideIcons as any)[matched.icon];

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative flex items-center justify-center gap-0.5 h-7 rounded-md text-[10px] font-semibold transition-all border cursor-pointer select-none px-1.5 min-w-[80px] hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: matched.color, borderColor: matched.color, color: '#fff' }}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3 shrink-0 mr-0.5" style={{ color: '#fff' }} />}
                <span className="truncate">{val}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="w-48"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Change Status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTS.map(opt => {
                const OptIcon = (LucideIcons as any)[opt.icon];
                const isActive = val === opt.label;
                return (
                  <DropdownMenuItem
                    key={opt.label}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer text-xs",
                      isActive && "bg-accent"
                    )}
                    onClick={() => updateEmployeeField(String(row.original._id), "status", opt.label)}
                  >
                    <div
                      className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: opt.color }}
                    >
                      {OptIcon && <OptIcon className="h-3 w-3 text-white" />}
                    </div>
                    <span className="font-medium">{opt.label}</span>
                    {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    },
    // Hidden columns by default
    { accessorKey: "eeCode", header: "EE Code" },
    { accessorKey: "transporterId", header: "Transporter ID" },
    { accessorKey: "badgeNumber", header: "Badge #" },
    { accessorKey: "streetAddress", header: "Address" },
    { accessorKey: "city", header: "City" },
    { accessorKey: "state", header: "State" },
    { accessorKey: "zipCode", header: "Zip" },
    { accessorKey: "gender", header: "Gender" },
    { accessorKey: "hiredDate", header: "Hired Date", cell: ({ row }) => row.original.hiredDate ? new Date(row.original.hiredDate).toLocaleDateString() : "" },
    { accessorKey: "dob", header: "DOB", cell: ({ row }) => row.original.dob ? new Date(row.original.dob).toLocaleDateString() : "" },
    { accessorKey: "hourlyStatus", header: "Hourly Status" },
    { accessorKey: "rate", header: "Rate" },
    { accessorKey: "gasCardPin", header: "Gas Card PIN" },
    { accessorKey: "dlExpiration", header: "DL Exp", cell: ({ row }) => row.original.dlExpiration ? new Date(row.original.dlExpiration).toLocaleDateString() : "" },
    { accessorKey: "motorVehicleReportDate", header: "MVR Date", cell: ({ row }) => row.original.motorVehicleReportDate ? new Date(row.original.motorVehicleReportDate).toLocaleDateString() : "" },
    { accessorKey: "routesComp", header: "Routes Comp" },
    { accessorKey: "ScheduleNotes", header: "Schedule Notes" },

    // Files
    { accessorKey: "offerLetterFile", header: "Offer Letter", cell: ({ row }) => <FileLinkCell value={row.original.offerLetterFile} /> },
    { accessorKey: "handbookFile", header: "Handbook", cell: ({ row }) => <FileLinkCell value={row.original.handbookFile} /> },
    { accessorKey: "driversLicenseFile", header: "DL File", cell: ({ row }) => <FileLinkCell value={row.original.driversLicenseFile} /> },
    { accessorKey: "i9File", header: "I-9", cell: ({ row }) => <FileLinkCell value={row.original.i9File} /> },
    { accessorKey: "drugTestFile", header: "Drug Test", cell: ({ row }) => <FileLinkCell value={row.original.drugTestFile} /> },

    // Offboarding
    { accessorKey: "paycomOffboarded", header: "Paycom Off", cell: ({ row }) => row.original.paycomOffboarded ? "Yes" : "No" },
    { accessorKey: "amazonOffboarded", header: "Amazon Off", cell: ({ row }) => row.original.amazonOffboarded ? "Yes" : "No" },
    { accessorKey: "finalCheckIssued", header: "Final Check Issued", cell: ({ row }) => row.original.finalCheckIssued ? "Yes" : "No" },
    { accessorKey: "finalCheck", header: "Final Check Cleared", cell: ({ row }) => <FileLinkCell value={row.original.finalCheck} /> },
    { accessorKey: "terminationDate", header: "Term Date", cell: ({ row }) => row.original.terminationDate ? new Date(row.original.terminationDate).toLocaleDateString() : "" },
    { accessorKey: "terminationReason", header: "Term Reason" },
    { accessorKey: "terminationLetter", header: "Term Letter", cell: ({ row }) => <FileLinkCell value={row.original.terminationLetter} /> },
    { accessorKey: "resignationDate", header: "Resign Date", cell: ({ row }) => row.original.resignationDate ? new Date(row.original.resignationDate).toLocaleDateString() : "" },
    { accessorKey: "resignationType", header: "Resign Type" },
    { accessorKey: "resignationLetter", header: "Resign Letter", cell: ({ row }) => <FileLinkCell value={row.original.resignationLetter} /> },
    { accessorKey: "eligibility", header: "Eligibility", cell: ({ row }) => row.original.eligibility ? "Yes" : "No" },
    { accessorKey: "lastDateWorked", header: "Last Worked", cell: ({ row }) => row.original.lastDateWorked ? new Date(row.original.lastDateWorked).toLocaleDateString() : "" },
    { accessorKey: "exitInterviewNotes", header: "Exit Notes" },


  ];

  // Define initial visibility: Show key fields, hide others
  const initialVisibility = {
    eeCode: false,
    transporterId: false,
    badgeNumber: false,
    streetAddress: false,
    city: false,
    state: false,
    zipCode: false,
    gender: false,
    hiredDate: false,
    dob: false,
    hourlyStatus: false,
    rate: false,
    gasCardPin: false,
    dlExpiration: false,
    motorVehicleReportDate: false,
    routesComp: false,
    ScheduleNotes: false,
    offerLetterFile: false,
    handbookFile: false,
    driversLicenseFile: false,
    i9File: false,
    drugTestFile: false,
    paycomOffboarded: false,
    amazonOffboarded: false,
    finalCheckIssued: false,
    finalCheck: false,
    terminationDate: false,
    terminationReason: false,
    terminationLetter: false,
    resignationDate: false,
    resignationType: false,
    resignationLetter: false,
    eligibility: false,
    lastDateWorked: false,
    exitInterviewNotes: false,
  };

  const filteredData = React.useMemo(() => {
    // The server already filters by 'terminated' and 'search' now,
    // so we can just return data directly.
    return data;
  }, [data]);

  // ── Shared chip renderer for mobile cards ──
  const renderDayChip = (emp: ISymxEmployee, day: string) => {
    const val = (emp as any)[day] || "OFF";
    const matched = scheduleTypeMap.get(val.toLowerCase());
    const chipColor = matched?.color || "";
    const chipIconName = matched?.icon || "";
    const ChipIcon = chipIconName ? (LucideIcons as any)[chipIconName] : null;
    const isOff = val.toLowerCase() === "off" || val.trim() === "";

    return (
      <DropdownMenu key={day}>
        <DropdownMenuTrigger asChild>
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex flex-col items-center gap-0.5 cursor-pointer select-none group/chip",
            )}
          >
            <span className="text-[8px] font-bold uppercase text-muted-foreground/60 tracking-wider">
              {day.slice(0, 3)}
            </span>
            <div
              className={cn(
                "flex items-center justify-center gap-0.5 h-6 w-full min-w-[38px] rounded-md text-[9px] font-bold border transition-all",
                isOff
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
                  : "group-hover/chip:brightness-110 group-hover/chip:shadow-md"
              )}
              style={isOff ? {} : {
                backgroundColor: chipColor || "#6B7280",
                borderColor: chipColor || "#6B7280",
                color: chipColor && isLightColor(chipColor) ? "#1a1a1a" : "#fff"
              }}
            >
              {isOff ? (
                <Coffee className="h-2.5 w-2.5" />
              ) : ChipIcon ? (
                <ChipIcon className="h-2.5 w-2.5" />
              ) : null}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" className="w-48 max-h-[280px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {day.charAt(0).toUpperCase() + day.slice(1)}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn("flex items-center gap-2 cursor-pointer text-xs", isOff && "bg-accent")}
            onClick={() => updateEmployeeField(String(emp._id), day, "OFF")}
          >
            <div className="h-5 w-5 rounded flex items-center justify-center shrink-0 bg-zinc-200 dark:bg-zinc-600">
              <Coffee className="h-3 w-3 text-zinc-500 dark:text-zinc-300" />
            </div>
            <span className="font-medium">OFF</span>
            {isOff && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
          {scheduleTypes.map(opt => {
            const OptIcon = opt.icon ? (LucideIcons as any)[opt.icon] : null;
            const isActive = val.toLowerCase() === opt.description.toLowerCase();
            return (
              <DropdownMenuItem
                key={opt._id}
                className={cn("flex items-center gap-2 cursor-pointer text-xs", isActive && "bg-accent")}
                onClick={() => updateEmployeeField(String(emp._id), day, opt.description)}
              >
                <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: opt.color || "#6B7280" }}>
                  {OptIcon ? <OptIcon className="h-3 w-3" style={{ color: opt.color && isLightColor(opt.color) ? "#1a1a1a" : "#fff" }} /> : <Minus className="h-3 w-3 text-white" />}
                </div>
                <span className="font-medium">{opt.description}</span>
                {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Status config for cards
  const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
    Active: { color: "#059669", icon: "CheckCircle2" },
    Inactive: { color: "#D97706", icon: "PauseCircle" },
    Terminated: { color: "#DC2626", icon: "XCircle" },
    Resigned: { color: "#7C3AED", icon: "LogOut" },
  };

  return (
    <div className="w-full h-full">
      {/* ── Desktop: Table View ── */}
      <div className="hidden lg:block h-full">
        <SimpleDataTable
          data={filteredData}
          columns={columns}
          title="Employees"
          onAdd={openAddDialog}
          loading={isInitialLoading || loading}
          showColumnToggle={false}
          initialColumnVisibility={initialVisibility}
          enableGlobalFilter={false}
          onRowClick={(employee) => router.push(`/hr/${employee._id}`)}
          hasMore={hasMore}
          onLoadMore={() => fetchEmployees(false)}
          loadingMore={loadingMore}
          hideFooter={true}
          extraActions={
            <div className="flex items-center space-x-3 mr-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-[200px]"
                />
              </div>
              <Badge variant="secondary" className="h-8 px-3 text-xs shrink-0 font-normal">
                {data.length} of {totalCount > 0 ? totalCount : data.length} records
              </Badge>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-terminated"
                  checked={showTerminated}
                  onCheckedChange={setShowTerminated}
                />
                <Label htmlFor="show-terminated" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  Include Terminated
                </Label>
              </div>
            </div>
          }
        />
      </div>

      {/* ── Mobile/Tablet: Card View ── */}
      <div className="lg:hidden flex flex-col h-full">
        {/* Mobile Header */}
        <div className="shrink-0 space-y-3 pb-4">
          {/* Title + Add button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Employees
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.length} of {totalCount > 0 ? totalCount : data.length} records
              </p>
            </div>
            <Button size="sm" onClick={openAddDialog} className="gap-1.5 h-8 shadow-sm">
              <LucideIcons.Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>

          {/* Search + Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Switch
                id="show-terminated-m"
                checked={showTerminated}
                onCheckedChange={setShowTerminated}
                className="scale-90"
              />
              <Label htmlFor="show-terminated-m" className="text-[10px] text-muted-foreground cursor-pointer">
                Terminated
              </Label>
            </div>
          </div>
        </div>

        {/* Loading */}
        {(isInitialLoading || loading) ? (
          <div className="flex-1 flex items-center justify-center">
            <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="p-4 rounded-full bg-muted/50 mb-3">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No employees found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          /* Card Grid */
          <div className="flex-1 overflow-auto -mx-1 px-1 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredData.map((emp) => {
                const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "—";
                const statusConf = STATUS_CONFIG[emp.status || "Active"] || STATUS_CONFIG.Active;
                const StatusIcon = (LucideIcons as any)[statusConf.icon];

                return (
                  <div
                    key={String(emp._id)}
                    onClick={() => router.push(`/hr/${emp._id}`)}
                    className="group relative rounded-xl border border-border/60 bg-card hover:bg-card/80 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 cursor-pointer overflow-hidden"
                  >
                    {/* Top accent line */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary/40 via-purple-500/40 to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Card Header — Avatar + Name + Status */}
                    <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2">
                      <div className="h-10 w-10 rounded-full bg-muted/80 border border-border/50 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                        {emp.profileImage ? (
                          <img
                            src={emp.profileImage}
                            alt={name}
                            className="h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {emp.type && (
                            <span className="text-[10px] text-muted-foreground font-medium">{emp.type}</span>
                          )}
                          {emp.phoneNumber && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-[10px] text-muted-foreground">{formatPhoneNumber(emp.phoneNumber)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Status chip */}
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                        style={{ backgroundColor: statusConf.color + "20", color: statusConf.color }}
                      >
                        {StatusIcon && <StatusIcon className="h-3 w-3" />}
                        {emp.status || "Active"}
                      </div>
                    </div>

                    {/* Weekly Availability — 7-day chip grid */}
                    <div className="px-3.5 pb-2.5">
                      <div className="grid grid-cols-7 gap-1">
                        {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day =>
                          renderDayChip(emp, day)
                        )}
                      </div>
                    </div>

                    {/* Footer — Vans */}
                    {(emp.defaultVan1 || emp.defaultVan2 || emp.defaultVan3) && (
                      <div className="px-3.5 pb-3 flex items-center gap-1.5 flex-wrap">
                        {[
                          { field: 'defaultVan1', label: 'P', color: '#2563EB' },
                          { field: 'defaultVan2', label: 'B1', color: '#0D9488' },
                          { field: 'defaultVan3', label: 'B2', color: '#7C3AED' },
                        ].map(van => {
                          const vanVal = (emp as any)[van.field];
                          if (!vanVal) return null;
                          return (
                            <span
                              key={van.field}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                              style={{ backgroundColor: van.color + "18", color: van.color }}
                            >
                              <LucideIcons.Truck className="h-2.5 w-2.5" />
                              <span className="opacity-60">{van.label}:</span>
                              {vanVal}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchEmployees(false)}
                  disabled={loadingMore}
                  className="gap-2 min-w-[140px]"
                >
                  {loadingMore ? (
                    <LucideIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LucideIcons.ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] lg:h-[85vh] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border">
            <DialogTitle className="text-lg font-bold">{editingItem ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingItem ? "Edit employee details" : "Create a new employee record"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <EmployeeForm
              initialData={editingItem ? { ...editingItem, _id: String(editingItem._id) } : {}}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              onCancel={() => setIsDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
