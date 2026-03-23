"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { formatPhoneNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Search, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import { useDataStore } from "@/hooks/use-data-store";

export default function TerminationsPage() {
  const store = useDataStore();
  const [data, setData] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const PAGE_SIZE = 50;
  const router = useRouter();

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // ── Seed from store for instant load ──
  const storeTerminations = store.hrTerminations as any;
  useEffect(() => {
    if (!debouncedSearch && storeTerminations?.records?.length > 0 && data.length === 0) {
      setData(storeTerminations.records);
      setTotalCount(storeTerminations.totalCount || storeTerminations.records.length);
      setHasMore(storeTerminations.hasMore || false);
    }
  }, [storeTerminations]);

  const fetchTerminated = async (reset = true) => {
    const skip = reset ? 0 : data.length;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: PAGE_SIZE.toString(),
        terminated: "true",
        status: "Terminated",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`/api/admin/employees?${params}`);
      if (response.ok) {
        const result = await response.json();
        let fetchedData = result.records || result;

        if (reset) {
          setData(fetchedData);
        } else {
          setData((prev) => {
            const existingIds = new Set(prev.map((e) => String(e._id)));
            const newRecords = fetchedData.filter(
              (e: any) => !existingIds.has(String(e._id))
            );
            return [...prev, ...newRecords];
          });
        }
        setTotalCount(result.totalCount || fetchedData.length);
        setHasMore(result.hasMore || false);
      } else {
        toast.error("Failed to fetch terminated employees");
      }
    } catch {
      toast.error("Failed to fetch terminated employees");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (data.length === 0) fetchTerminated(true);
    else fetchTerminated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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
                      (
                        e.currentTarget.nextElementSibling as HTMLElement
                      ).style.display = "flex";
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
      accessorKey: "firstName",
      header: "First Name",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {row.original.firstName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "lastName",
      header: "Last Name",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {row.original.lastName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.gender || "—"}
        </span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-semibold">
          {row.original.type || "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs truncate max-w-[180px] block">
          {row.original.email || "—"}
        </span>
      ),
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone Number",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {row.original.phoneNumber
            ? formatPhoneNumber(row.original.phoneNumber)
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "eeCode",
      header: "EECode",
      cell: ({ row }) => (
        <span className="text-xs font-mono">
          {row.original.eeCode || "—"}
        </span>
      ),
    },
    {
      accessorKey: "transporterId",
      header: "Transporter ID",
      cell: ({ row }) => (
        <span className="text-xs font-mono">
          {row.original.transporterId || "—"}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.city || "—"}
        </span>
      ),
    },
    {
      accessorKey: "dob",
      header: "DOB",
      cell: ({ row }) => {
        const dob = row.original.dob;
        if (!dob) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <span className="text-xs whitespace-nowrap">
            {new Date(dob).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        );
      },
    },
  ];

  // Loading skeleton
  if (loading && data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-muted/30 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Desktop Table ── */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0">
        <SimpleDataTable
          columns={columns}
          data={data}
          onRowClick={(row) =>
            router.push(`/hr/${row._id}`)
          }
          hasMore={hasMore}
          onLoadMore={hasMore ? () => fetchTerminated(false) : undefined}
          loadingMore={loadingMore}
          totalCount={totalCount}
          hideFooter={true}
          title="Terminations"
          extraActions={
            <div className="flex items-center gap-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search terminated employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8"
                />
              </div>
              <Badge
                variant="secondary"
                className="h-8 px-3 text-xs shrink-0 font-normal"
              >
                {data.length} of{" "}
                {totalCount > 0 ? totalCount : data.length} records
              </Badge>
            </div>
          }
        />
      </div>

      {/* ── Mobile/Tablet: Card View ── */}
      <div className="lg:hidden flex flex-col h-full">
        <div className="shrink-0 space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                Terminations
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.length} of{" "}
                {totalCount > 0 ? totalCount : data.length} records
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <User className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              No terminated employees found
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {data.map((emp) => (
              <div
                key={String(emp._id)}
                onClick={() =>
                  router.push(`/hr/${emp._id}`)
                }
                className="rounded-xl border border-border/50 bg-card p-3 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {emp.profileImage ? (
                      <img
                        src={emp.profileImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {emp.firstName || ""} {emp.lastName || ""}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {emp.type && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5"
                        >
                          {emp.type}
                        </Badge>
                      )}
                      {emp.city && (
                        <span className="text-[10px] text-muted-foreground">
                          {emp.city}
                        </span>
                      )}
                    </div>
                  </div>
                  {emp.eeCode && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {emp.eeCode}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchTerminated(false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
