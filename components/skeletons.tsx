import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page-level skeleton for table/list pages
 * Shows header with search/add button and table skeleton
 */
export function TablePageSkeleton() {
  return (
    <div className="w-full h-full flex flex-col p-1">
      {/* Header with search and actions */}
      <div className="flex items-center justify-between py-4">
        <Skeleton className="h-9 w-64" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="rounded-lg border bg-card flex-1 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
        
        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={i} 
            className="flex items-center gap-4 p-4 border-b last:border-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2 ml-auto">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between py-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard page with chart and map
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        {/* Chart card skeleton */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
      
      <div className="px-4 lg:px-6">
        {/* Map card skeleton */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 border-b">
            <Skeleton className="h-6 w-56" />
          </div>
          <div className="p-6">
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for products page with sidebar
 */
export function ProductsPageSkeleton() {
  return (
    <div className="w-full h-full flex gap-4 overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="w-64 flex-none border rounded-lg bg-card flex flex-col overflow-hidden h-full">
        <div className="h-12 flex items-center px-4 border-b">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="p-2 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="flex-1 overflow-hidden flex flex-col h-full">
        <TablePageSkeleton />
      </div>
    </div>
  );
}

/**
 * Skeleton for detail pages
 */
export function DetailPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      
      {/* Content cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for settings pages with sidebar nav
 */
export function SettingsPageSkeleton() {
  return (
    <div className="flex h-full flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
      <aside className="lg:w-1/5">
        <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </nav>
      </aside>
      <div className="flex-1 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple form skeleton
 */
export function FormSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
