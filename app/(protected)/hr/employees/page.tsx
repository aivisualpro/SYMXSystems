
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
  const [data, setData] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(true);
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
  const PAGE_SIZE = 50;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicleNames, setVehicleNames] = useState<string[]>([]);
  const [scheduleTypes, setScheduleTypes] = useState<ScheduleTypeOption[]>([]);
  const scheduleTypeMap = useMemo(() => {
    const map = new Map<string, ScheduleTypeOption>();
    scheduleTypes.forEach(st => map.set(st.description.toLowerCase(), st));
    return map;
  }, [scheduleTypes]);

  // Fetch vehicle names for van dropdowns
  useEffect(() => {
    fetch("/api/fleet?section=vehicles")
      .then(r => r.json())
      .then((data: any) => {
        const vehicles = data?.vehicles || [];
        const names = vehicles
          .map((v: any) => v.vehicleName)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
        setVehicleNames(names);
      })
      .catch(() => {});
  }, []);

  // Fetch schedule type options from dropdowns
  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=schedule type")
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setScheduleTypes(data.filter((d: any) => d.isActive !== false));
        }
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    fetchEmployees(true);
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
    // Default Vans — dropdowns from fleet vehicles
    ...(['defaultVan1', 'defaultVan2', 'defaultVan3'] as const).map((field, idx) => ({
      accessorKey: field,
      header: ['Primary', 'Backup 1', 'Backup 2'][idx],
      cell: ({ row }: any) => {
        const val = row.original[field] || "";
        return (
          <Select
            value={val || "__none__"}
            onValueChange={(v) => updateEmployeeField(String(row.original._id), field, v === "__none__" ? "" : v)}
          >
            <SelectTrigger
              className="h-7 w-[80px] text-[10px] font-medium px-2"
              onClick={(e) => e.stopPropagation()}
              suppressHydrationWarning
            >
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">— None —</SelectItem>
              {vehicleNames.map(name => (
                <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    })),
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.original.status === 'Active' ? 'bg-green-100 text-green-800' :
          row.original.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
          {row.original.status}
        </span>
      )
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

  return (
    <div className="w-full h-full">
      <SimpleDataTable
        data={filteredData}
        columns={columns}
        title="Employees"
        onAdd={openAddDialog}
        loading={loading}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
            <DialogTitle className="text-lg font-bold">{editingItem ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingItem ? "Edit employee details" : "Create a new employee record"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
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
