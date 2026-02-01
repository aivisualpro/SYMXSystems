"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  ColumnDef, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState
} from "@tanstack/react-table";
import { 
  Ship, 
  Package, 
  ShieldCheck, 
  Truck, 
  Search, 
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
  Minimize2,
  Maximize2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface TrackerRecord {
  _id: string;
  poId: string;
  cpoId: string;
  shipId: string;
  vbpoNo: string;
  orderType: string;
  poNo: string;
  customer: string;
  customerLocation: string;
  customerPONo: string;
  qtyOrdered: number;
  warehouse: string;
  spoNo: string;
  svbid: string;
  supplierLocationId: string;
  product: string;
  BOLNumber: string;
  carrier: string;
  vessellTrip: string;
  updatedETA: string;
  estimatedDuties: number;
  quickNote: string;
  portofEntryShipto: string;
  itemNo: string;
  description: string;
  lotSerial: string;
  qty: number;
  type: string;
  inventoryDate: string;
  carrierBookingRef: string;
  isManufacturerSecurityISF: boolean;
  ISF: string;
  trackingId: string;
  customsStatus: string;
  documentsRequired: string;
  container: string;
  vbid: string;
  status: string;
}

export default function AndresTrackerPage() {
  const [data, setData] = useState<TrackerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "tabs">("table");
  const router = useRouter();
  const { setLeftContent, setRightContent } = useHeaderActions();
  const [minimizedGroups, setMinimizedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setMinimizedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Andres Tracker
        </h1>
      </div>
    );
    
    setRightContent(
        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-zinc-100 dark:bg-zinc-900 px-3 py-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-primary/20 transition-all w-64 lg:w-96 h-8">
                <Search className="h-3.5 w-3.5 text-zinc-500 mr-2" />
                <Input 
                    placeholder="Search tracker..." 
                    className="border-none bg-transparent h-6 shadow-none focus-visible:ring-0 p-0 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as any)}
                className="bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border h-8"
            >
                <ToggleGroupItem value="table" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
                    <TableIcon className="h-3.5 w-3.5 mr-2" />
                    <span className="text-xs font-medium">Table</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="tabs" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
                    <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                    <span className="text-xs font-medium">Tabs</span>
                </ToggleGroupItem>
            </ToggleGroup>
        </div>
    );

    return () => {
        setLeftContent(null);
        setRightContent(null);
    };
  }, [setLeftContent, setRightContent, router, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/andres-tracker");
      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load tracker data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = data.filter((item) => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  
  const transitData = filteredData.filter(row => 
    ['on water', 'in_transit', 'in transit'].includes(row.status?.toLowerCase() || "")
  );

  // --- SECTIONED DATA ---

  const transitColumns: ColumnDef<TrackerRecord>[] = [
    { 
      accessorKey: "poNo", 
      header: "VB PO Number",
      cell: ({ row }) => (
        <Link 
          href={`/admin/purchase-orders/${row.original.poId}`}
          className="hover:underline text-inherit font-bold"
        >
          {row.original.poNo}
        </Link>
      )
    },
    { accessorKey: "customer", header: "Customer" },
    { accessorKey: "customerPONo", header: "Cust PO#" },
    { accessorKey: "qtyOrdered", header: "Qty Ordered" },
    { accessorKey: "supplierLocationId", header: "Supplier Name" },
    { accessorKey: "product", header: "Product Description" },
    { accessorKey: "BOLNumber", header: "BOL Number" },
    { accessorKey: "carrier", header: "Carrier Name" },
    { accessorKey: "vessellTrip", header: "Vessel Name / Voyage" },
    { 
      accessorKey: "updatedETA", 
      header: "Updated ETA",
      cell: ({ row }) => row.original.updatedETA ? format(new Date(row.original.updatedETA), "MM/dd/yy") : "-"
    },
    { 
      accessorKey: "estimatedDuties", 
      header: "Estimated Duties",
      cell: ({ row }) => row.original.estimatedDuties ? `$${row.original.estimatedDuties.toLocaleString()}` : "$0"
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const val = row.original.status || "Pending";
        const isTransit = ['on water', 'in_transit', 'in transit'].includes(val.toLowerCase());
        const isArrived = ['arrived', 'delivered'].includes(val.toLowerCase());
        return (
          <span className={cn(
            "font-bold uppercase tracking-tighter text-[9px]",
            isTransit ? "text-blue-600 dark:text-blue-400" : 
            isArrived ? "text-green-600 dark:text-green-400" : 
            "text-zinc-500"
          )}>
            {val.replace(/_/g, ' ')}
          </span>
        );
      }
    },
    { accessorKey: "portofEntryShipto", header: "Entry Port" },
  ];

  const inventoryColumns: ColumnDef<TrackerRecord>[] = [
    { accessorKey: "vbid", header: "VB #" },
    { accessorKey: "itemNo", header: "Item #" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "lotSerial", header: "Lot/Serial" },
    { accessorKey: "qty", header: "Qty" },
    { accessorKey: "type", header: "Type" },
    { 
      accessorKey: "inventoryDate", 
      header: "Inventory Date",
      cell: ({ row }) => row.original.inventoryDate ? format(new Date(row.original.inventoryDate), "MM/dd/yy") : "-"
    },
  ];

  const customsColumns: ColumnDef<TrackerRecord>[] = [
    { 
      accessorKey: "poNo", 
      header: "VB PO Number",
      cell: ({ row }) => (
        <Link 
          href={`/admin/purchase-orders/${row.original.poId}`}
          className="hover:underline text-inherit font-bold"
        >
          {row.original.poNo}
        </Link>
      )
    },
    { accessorKey: "carrierBookingRef", header: "Carrier Booking Ref#" },
    { accessorKey: "BOLNumber", header: "BOL Number" },
    { 
      accessorKey: "isManufacturerSecurityISF", 
      header: "ISF/CB SA Filed Y/N",
      cell: ({ row }) => <span className="font-bold">{row.original.isManufacturerSecurityISF ? "Yes" : "No"}</span>
    },
    { 
      accessorKey: "ISF", 
      header: "ISF/CB SA Confirmation",
      cell: ({ row }) => <span className="font-bold">{row.original.ISF}</span>
    },
    { accessorKey: "trackingId", header: "Customs Tracking ID" },
    { 
      accessorKey: "customsStatus", 
      header: "Customs Status",
      cell: ({ row }) => <span className="block">{row.original.customsStatus}</span>
    },
    { accessorKey: "documentsRequired", header: "Documents Required" },
  ];

  const lsbTransitColumns: ColumnDef<TrackerRecord>[] = [
    { 
      accessorKey: "poNo", 
      header: "VB PO Number",
      cell: ({ row }) => (
        <Link 
          href={`/admin/purchase-orders/${row.original.poId}`}
          className="hover:underline text-inherit font-bold"
        >
          {row.original.poNo}
        </Link>
      )
    },
    { accessorKey: "customer", header: "Customer" },
    { accessorKey: "customerPONo", header: "Cust PO#" },
    { accessorKey: "qtyOrdered", header: "Qty Ordered" },
    { accessorKey: "supplierLocationId", header: "Supplier Name" },
    { accessorKey: "product", header: "Product Description" },
    { accessorKey: "BOLNumber", header: "BOL Number" },
    { accessorKey: "container", header: "Container #" },
    { accessorKey: "carrier", header: "Carrier Name" },
    { accessorKey: "vessellTrip", header: "Vessel Name / Voyage" },
    { 
      accessorKey: "updatedETA", 
      header: "Updated ETA",
      cell: ({ row }) => row.original.updatedETA ? format(new Date(row.original.updatedETA), "MM/dd/yy") : "-"
    },
    { 
        accessorKey: "status", 
        header: "Status",
        cell: ({ row }) => {
          const val = row.original.status || "Pending";
          const isTransit = ['on water', 'in_transit', 'in transit'].includes(val.toLowerCase());
          const isArrived = ['arrived', 'delivered'].includes(val.toLowerCase());
          return (
            <span className={cn(
              "font-bold uppercase tracking-tighter text-[9px]",
              isTransit ? "text-blue-600 dark:text-blue-400" : 
              isArrived ? "text-green-600 dark:text-green-400" : 
              "text-zinc-500"
            )}>
              {val.replace(/_/g, ' ')}
            </span>
          );
        }
      },
    { accessorKey: "portofEntryShipto", header: "Entry Port" },
  ];

  // --- REUSABLE COMPONENTS ---

  const TableView = ({ columns, data, highlightColor }: { 
    columns: ColumnDef<TrackerRecord>[], 
    data: TrackerRecord[],
    highlightColor?: string
  }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      state: { sorting },
      initialState: { pagination: { pageSize: 15 } }
    });

    return (
      <div className="flex-1 min-h-0 flex flex-col border rounded-3xl bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden h-full">
        <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 h-full">
          <table className="border-separate border-spacing-0 table-fixed min-w-[1500px] w-full text-sm">
            <TableHeader className="z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id} 
                      className="p-[4px] text-[10px] font-bold tracking-tighter text-zinc-500 dark:text-white border-r border-b border-zinc-200 dark:border-zinc-800 align-middle leading-tight whitespace-normal break-words sticky top-0 z-20 bg-zinc-100 dark:bg-zinc-900"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 group transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id} 
                        className={cn(
                          "p-[4px] text-[10px] font-medium border-r border-b border-zinc-200/50 dark:border-zinc-800 transition-all duration-300 align-middle whitespace-normal break-words overflow-visible leading-tight",
                          highlightColor
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
        <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              Showing {table.getRowModel().rows.length} records.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => table.previousPage()} 
                disabled={!table.getCanPreviousPage()}
                className="h-8"
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => table.nextPage()} 
                disabled={!table.getCanNextPage()}
                className="h-8"
              >
                Next
              </Button>
            </div>
        </div>
      </div>
    );
  };

  const UnifiedTableView = () => {
    const allGroups = [
      { 
        id: 'transit',
        label: "Shipments In-Transit!", 
        columns: transitColumns, 
        className: "bg-green-100 text-green-900 dark:bg-green-900/10 dark:text-white" 
      },
      { 
        id: 'inventory',
        label: "Inventory", 
        columns: inventoryColumns, 
        className: "bg-blue-100 text-blue-900 dark:bg-blue-900/10 dark:text-white" 
      },
      { 
        id: 'customs',
        label: "Customs", 
        columns: customsColumns, 
        className: "bg-orange-100 text-orange-900 dark:bg-orange-900/10 dark:text-white" 
      },
      { 
        id: 'lsb',
        label: "LSB Shipments In-Transit", 
        columns: lsbTransitColumns, 
        className: "bg-amber-100 text-amber-900 dark:bg-amber-900/10 dark:text-white" 
      }
    ];

    const getColWidth = (header: any, groupId: string, colIdx: number) => {
      const isMin = minimizedGroups.has(groupId);
      if (isMin) return colIdx === 0 ? '70px' : '0px';
      
      const h = String(header);
      const toReduce = [
        "VB PO Number", "Cust PO#", "Qty Ordered", "BOL Number", 
        "Carrier Name", "Updated ETA", "Estimated Duties", "Status",
        "VB #", "ISF/CB SA Filed Y/N", "ISF/CB SA Confirmation", "Qty", "Item #"
      ];
      if (toReduce.includes(h) || h.includes("Status")) return '75px';
      if (h === "Customer" || h === "Supplier Name" || h === "Product Description" || h === "Description") return '160px';
      return '110px';
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col border rounded-3xl bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden h-full relative">
        <style dangerouslySetInnerHTML={{ __html: `
          .genie-transition {
            transition: all 0.8s cubic-bezier(0.25, 1, 0.32, 1);
          }
          .vertical-text {
            writing-mode: vertical-lr;
            transform: rotate(180deg);
          }
        `}} />
        <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 h-full">
          <table className="border-separate border-spacing-0 table-fixed w-max text-sm genie-transition">
            <TableHeader className="z-20">
              {/* Top Group Headers */}
              <TableRow className="bg-zinc-100 dark:bg-zinc-900 border-none hover:bg-zinc-100 dark:hover:bg-zinc-900 sticky top-0 z-30">
                {allGroups.map((group, idx) => {
                  const isMin = minimizedGroups.has(group.id);
                  return (
                    <TableHead 
                      key={group.id} 
                      colSpan={group.columns.length} 
                      className={cn(
                          "text-center font-black tracking-[0.1em] text-[12px] p-0 border-r-2 border-b-2 border-white dark:border-zinc-800 leading-[1.2] align-middle sticky top-0 z-30 genie-transition h-10",
                          group.className,
                          isMin && "w-[70px] min-w-[70px] max-w-[70px] border-r-4 border-r-zinc-300 dark:border-r-zinc-700"
                      )}
                    >
                      <div className="relative h-full flex items-center justify-center group/header overflow-visible">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-50 p-1 rounded-full bg-white/40 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-black/80 transition-all shadow-sm opacity-0 group-hover/header:opacity-100"
                        >
                          {isMin ? <Maximize2 className="h-2.5 w-2.5" /> : <Minimize2 className="h-2.5 w-2.5" />}
                        </button>
                        <span className={cn(
                          "genie-transition block truncate px-6",
                          isMin ? "vertical-text text-[8px] tracking-[0.2em] font-bold h-24 whitespace-nowrap opacity-60" : "scale-100 opacity-100"
                        )}>
                          {group.label}
                        </span>
                        {isMin && (
                          <button 
                            onClick={() => toggleGroup(group.id)}
                            className="absolute inset-0 z-40 w-full h-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          />
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
              {/* Individual Column Headers */}
              <TableRow className="bg-zinc-50 dark:bg-zinc-950 border-none hover:bg-zinc-50 dark:hover:bg-zinc-950 sticky top-[40px] z-20">
                {allGroups.map((group) => {
                  const isSectionMin = minimizedGroups.has(group.id);
                  return group.columns.map((col: any, colIdx) => (
                    <TableHead 
                      key={`${group.id}-${colIdx}`} 
                      style={{ 
                        width: getColWidth(col.header, group.id, colIdx),
                        minWidth: getColWidth(col.header, group.id, colIdx),
                        maxWidth: getColWidth(col.header, group.id, colIdx),
                        opacity: isSectionMin && colIdx > 0 ? 0 : 1,
                        padding: isSectionMin && colIdx > 0 ? 0 : '4px',
                        borderRightWidth: isSectionMin && colIdx > 0 ? 0 : (colIdx === group.columns.length - 1 ? 2 : 1),
                        transitionDelay: isSectionMin ? '0ms' : `${colIdx * 30}ms`,
                        overflow: 'hidden'
                      }}
                      className={cn(
                          "genie-transition text-[10px] font-bold tracking-tighter text-zinc-500 dark:text-white border-b border-zinc-200 dark:border-zinc-800 align-middle leading-tight whitespace-normal break-words sticky top-[40px] z-20 bg-zinc-50 dark:bg-zinc-950",
                          isSectionMin && colIdx === 0 && "bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 font-black text-[8px] px-1"
                      )}
                    >
                      {( !isSectionMin || colIdx === 0 ) && flexRender(col.header, {} as any)}
                    </TableHead>
                  ));
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitData.length > 0 ? (
                transitData.map((row, rowIdx) => (
                  <TableRow key={rowIdx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 group transition-colors">
                    {allGroups.map((group) => {
                      const isSectionMin = minimizedGroups.has(group.id);
                      return group.columns.map((col: any, colIdx) => (
                        <TableCell 
                          key={`${rowIdx}-${group.id}-${colIdx}`} 
                          style={{ 
                            width: getColWidth(col.header, group.id, colIdx),
                            minWidth: getColWidth(col.header, group.id, colIdx),
                            maxWidth: getColWidth(col.header, group.id, colIdx),
                            opacity: isSectionMin && colIdx > 0 ? 0 : 1,
                            padding: isSectionMin && colIdx > 0 ? 0 : '4px',
                            borderRightWidth: isSectionMin && colIdx > 0 ? 0 : (colIdx === group.columns.length - 1 ? 2 : 1),
                            transitionDelay: isSectionMin ? '0ms' : `${colIdx * 30}ms`,
                            overflow: 'hidden'
                          }}
                          className={cn(
                            "genie-transition text-[10px] font-medium border-b border-zinc-200/50 dark:border-zinc-800 align-middle whitespace-normal break-words leading-tight",
                            isSectionMin && colIdx === 0 && "border-r-4 border-r-zinc-300 dark:border-r-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50",
                            group.label === "Shipments In-Transit!" && !isSectionMin && "bg-green-500/[0.04] dark:bg-green-500/[0.12] text-green-950 dark:text-white",
                            group.label === "Inventory" && !isSectionMin && "bg-blue-500/[0.04] dark:bg-blue-500/[0.12] text-blue-950 dark:text-white",
                            group.label === "Customs" && !isSectionMin && "bg-orange-500/[0.04] dark:bg-orange-500/[0.12] text-orange-950 dark:text-white",
                            group.label === "LSB Shipments In-Transit" && !isSectionMin && "bg-amber-500/[0.04] dark:bg-amber-500/[0.12] text-amber-950 dark:text-white",
                            isSectionMin && colIdx === 0 && "text-center"
                          )}
                        >
                          {( !isSectionMin || colIdx === 0 ) && (col.cell 
                            ? (col.cell as any)({ row: { original: row } }) 
                            : <span className="block leading-tight truncate">{String((row as any)[col.accessorKey] || "-")}</span>)}
                        </TableCell>
                      ));
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={transitColumns.length + inventoryColumns.length + customsColumns.length + lsbTransitColumns.length} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                        <Search className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No matching entries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-0 max-w-[1800px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      
      {/* Stats Overview - Only in Tab mode */}
      {viewMode === "tabs" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0 p-4">
            <Card className="bg-zinc-950 text-white border-primary/20 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Ship className="h-12 w-12" />
                </div>
                <CardContent className="p-3.5 pt-6">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">In-Transit</p>
                    <h3 className="text-2xl font-bold mt-1 uppercase tracking-tight">{data.length}</h3>
                    <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-2/3 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-950 text-white border-primary/20 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Package className="h-12 w-12" />
                </div>
                <CardContent className="p-3.5 pt-6">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Inventory</p>
                    <h3 className="text-2xl font-bold mt-1 uppercase tracking-tight">{data.filter(d => d.qty > 0).length}</h3>
                    <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-1/2" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-950 text-white border-primary/20 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="h-12 w-12" />
                </div>
                <CardContent className="p-3.5 pt-6">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Customs</p>
                    <h3 className="text-2xl font-bold mt-1 uppercase tracking-tight">{data.filter(d => d.customsStatus === "Cleared").length}</h3>
                    <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-3/4" />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-950 text-white border-primary/20 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Truck className="h-12 w-12" />
                </div>
                <CardContent className="p-3.5 pt-6">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">LSB TRANSIT</p>
                    <h3 className="text-2xl font-bold mt-1 uppercase tracking-tight">{data.filter(d => d.vbid).length}</h3>
                    <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-1/4" />
                    </div>
                </CardContent>
            </Card>
        </div>
      )}


      {/* Main Execution View */}
      <div className="flex-1 overflow-hidden min-h-0">
          {viewMode === "table" ? (
             <UnifiedTableView />
          ) : (
             <Tabs defaultValue="transit" className="w-full h-full flex flex-col">
                <div className="bg-zinc-100/50 dark:bg-zinc-900/50 border rounded-2xl p-1 mb-4 w-fit flex-shrink-0 shadow-inner">
                    <TabsList className="bg-transparent border-none p-0 h-10">
                        <TabsTrigger value="transit" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-md px-6 transition-all duration-300">
                            <Ship className="h-4 w-4 mr-2" /> Shipments
                        </TabsTrigger>
                        <TabsTrigger value="inventory" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-md px-6 transition-all duration-300">
                            <Package className="h-4 w-4 mr-2" /> Inventory
                        </TabsTrigger>
                        <TabsTrigger value="customs" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-md px-6 transition-all duration-300">
                            <ShieldCheck className="h-4 w-4 mr-2" /> Customs
                        </TabsTrigger>
                        <TabsTrigger value="lsb" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-md px-6 transition-all duration-300">
                            <Truck className="h-4 w-4 mr-2" /> LSB Transit
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-auto min-h-0 space-y-4">
                    <TabsContent value="transit" className="mt-0 focus-visible:ring-0 h-full">
                        <TableView columns={transitColumns} data={transitData} highlightColor="bg-green-500/[0.04] dark:bg-green-500/[0.12] text-green-950 dark:text-white" />
                    </TabsContent>
                    <TabsContent value="inventory" className="mt-0 focus-visible:ring-0 h-full">
                        <TableView columns={inventoryColumns} data={filteredData} highlightColor="bg-blue-500/[0.04] dark:bg-blue-500/[0.12] text-blue-950 dark:text-white" />
                    </TabsContent>
                    <TabsContent value="customs" className="mt-0 focus-visible:ring-0 h-full">
                        <TableView columns={customsColumns} data={filteredData} highlightColor="bg-orange-500/[0.04] dark:bg-orange-500/[0.12] text-orange-950 dark:text-white" />
                    </TabsContent>
                    <TabsContent value="lsb" className="mt-0 focus-visible:ring-0 h-full">
                        <TableView columns={lsbTransitColumns} data={transitData} highlightColor="bg-purple-500/[0.04] dark:bg-purple-500/[0.12] text-purple-950 dark:text-white" />
                    </TabsContent>
                </div>
             </Tabs>
          )}
      </div>
    </div>
  );
}
