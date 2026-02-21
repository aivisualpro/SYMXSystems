"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  getFacetedRowModel,
  getFacetedUniqueValues,
} from "@tanstack/react-table";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

interface SimpleDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  onAdd?: () => void;
  onRowClick?: (data: TData) => void;
  showColumnToggle?: boolean;
  title?: string;
  loading?: boolean;
  initialColumnVisibility?: VisibilityState;
  extraActions?: React.ReactNode;
  enableGlobalFilter?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  totalCount?: number;
  hideFooter?: boolean;
}

export function SimpleDataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  onAdd,
  onRowClick,
  showColumnToggle = true,
  title,
  loading,
  initialColumnVisibility = {},
  extraActions,
  enableGlobalFilter = false,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  totalCount = 0,
  hideFooter = false,
}: SimpleDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const sentinelRef = React.useRef<HTMLTableRowElement | null>(null);

  React.useEffect(() => {
    if (!onLoadMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, onLoadMore]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: onLoadMore ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "auto",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const { setActions, setLeftContent } = useHeaderActions();

  React.useEffect(() => {
    setActions(
      <div className="flex items-center gap-2">
        {extraActions}
        {enableGlobalFilter && (
          <Input
            placeholder="Search all fields..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm h-8"
          />
        )}
        {searchKey && !enableGlobalFilter && (
          <Input
            placeholder={`Filter by ${searchKey}...`}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
          className="max-w-sm h-8"
          />
        )}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onAdd && (
          <Button onClick={onAdd} size="sm" className="h-8">
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
        )}
      </div>
    );

    if (title) {
      setLeftContent(
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {title}
        </h1>
      );
    }
    return () => {
      setActions(null);
      setLeftContent(null);
    };
  }, [
    setActions,
    setLeftContent,
    title,
    table,
    searchKey,
    onAdd,
    showColumnToggle,
    extraActions,
    globalFilter,
    enableGlobalFilter,
    // Add these dependencies to ensure updates when filters/visibility change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(table.getState().columnFilters), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(table.getState().columnVisibility)
  ]);

  return (
    <div className="w-full h-full flex flex-col gap-2 overflow-hidden">
      <div className="rounded-md border flex-1 overflow-auto bg-background min-h-0 relative scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
        <table className="relative w-full border-separate border-spacing-0">
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="sticky top-0 bg-background z-20 border-b backdrop-blur-sm text-[14px] font-normal">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? "cursor-pointer" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-0.5 h-8 text-[14px] font-normal">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
            {onLoadMore && hasMore && (
              <TableRow ref={sentinelRef}>
                <TableCell colSpan={columns.length} className="h-14 text-center text-muted-foreground">
                  {loadingMore ? "Loading more..." : ""}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {!hideFooter && (
        <div className="flex items-center justify-end space-x-2 py-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {onLoadMore ? (
              <span>
                Showing {data.length} of {totalCount > 0 ? totalCount : data.length} records.
              </span>
            ) : (
              <span>
                Showing {table.getFilteredRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0} to{" "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{" "}
                of {table.getFilteredRowModel().rows.length} records.
              </span>
            )}
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <span className="ml-2">
                ({table.getFilteredSelectedRowModel().rows.length} selected)
              </span>
            )}
          </div>
          {!onLoadMore && (
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
