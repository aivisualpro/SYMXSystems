"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar as CalendarIcon,
  Copy,
  Download,
  RefreshCw,
  ExternalLink,
  FileJson,
  Search,
  Plus,
  X,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { notify } from "@/lib/notify";

interface BackupListItem {
  publicId: string;
  url: string;
  date: string;
  bytes: number;
  createdAt: string;
}

interface InspectResponse {
  ok: true;
  metadata: {
    database: string;
    createdAt: string;
    collectionCount: number;
    collections: string[];
  };
  collections: { name: string; documentCount: number }[];
}

interface CollectionResponse {
  ok: true;
  collection: string;
  totalDocs: number;
  page: number;
  pageSize: number;
  totalPages: number;
  documents: unknown[];
}

interface FieldFilter {
  id: string;
  field: string;
  operator: "contains" | "equals" | "starts" | "ends" | "gt" | "lt" | "exists" | "not_exists";
  value: string;
}

const PAGE_SIZE = 50;

const OPERATOR_LABELS: Record<FieldFilter["operator"], string> = {
  contains: "Contains",
  equals: "Equals",
  starts: "Starts with",
  ends: "Ends with",
  gt: "Greater than",
  lt: "Less than",
  exists: "Exists",
  not_exists: "Does not exist",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Deeply extract a nested field value using dot-notation (e.g. "address.city") */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/** Extract all unique field paths from an array of documents (1 level + common nested) */
function extractFieldPaths(docs: unknown[]): string[] {
  const paths = new Set<string>();
  for (const doc of docs) {
    if (typeof doc !== "object" || doc === null) continue;
    collectPaths(doc as Record<string, any>, "", paths, 0);
  }
  // Sort: _id first, then alphabetical
  const sorted = Array.from(paths).sort((a, b) => {
    if (a === "_id") return -1;
    if (b === "_id") return 1;
    return a.localeCompare(b);
  });
  return sorted;
}

function collectPaths(obj: Record<string, any>, prefix: string, paths: Set<string>, depth: number) {
  if (depth > 2) return; // limit nesting depth
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.add(fullPath);
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      collectPaths(val, fullPath, paths, depth + 1);
    }
  }
}

/** Check if a single document matches a filter */
function docMatchesFilter(doc: any, filter: FieldFilter): boolean {
  const raw = getNestedValue(doc, filter.field);

  if (filter.operator === "exists") return raw !== undefined && raw !== null;
  if (filter.operator === "not_exists") return raw === undefined || raw === null;

  const val = (raw == null ? "" : String(raw)).toLowerCase();
  const search = filter.value.toLowerCase();

  switch (filter.operator) {
    case "contains": return val.includes(search);
    case "equals": return val === search;
    case "starts": return val.startsWith(search);
    case "ends": return val.endsWith(search);
    case "gt": return !isNaN(Number(raw)) && !isNaN(Number(filter.value)) && Number(raw) > Number(filter.value);
    case "lt": return !isNaN(Number(raw)) && !isNaN(Number(filter.value)) && Number(raw) < Number(filter.value);
    default: return true;
  }
}

let filterId = 0;

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [inspect, setInspect] = useState<InspectResponse | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);

  const [collectionFilter, setCollectionFilter] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");

  const [collectionData, setCollectionData] = useState<CollectionResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [page, setPage] = useState(1);

  // ── Search / Filter state ──
  const [filters, setFilters] = useState<FieldFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");

  const selectedBackup = useMemo(
    () => backups.find((b) => b.date === selectedDate) || null,
    [backups, selectedDate],
  );

  // ---- Load list of available backups
  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/backups", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load backups");
      setBackups(json.backups);
      if (json.backups.length && !selectedDate) {
        setSelectedDate(json.backups[0].date);
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoadingBackups(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load inspect (collection list + counts) when date changes
  useEffect(() => {
    if (!selectedBackup) {
      setInspect(null);
      setSelectedCollection("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingInspect(true);
      setInspect(null);
      setSelectedCollection("");
      setCollectionData(null);
      try {
        const res = await fetch(
          `/api/admin/backups/inspect?url=${encodeURIComponent(selectedBackup.url)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to inspect backup");
        if (!cancelled) setInspect(json);
      } catch (err) {
        if (!cancelled) notify.error(err instanceof Error ? err.message : "Failed to inspect backup");
      } finally {
        if (!cancelled) setLoadingInspect(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBackup]);

  // ---- Load collection data when a collection is chosen / page changes
  useEffect(() => {
    if (!selectedBackup || !selectedCollection) {
      setCollectionData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDocs(true);
      try {
        const res = await fetch(
          `/api/admin/backups/collection?url=${encodeURIComponent(
            selectedBackup.url,
          )}&name=${encodeURIComponent(selectedCollection)}&page=${page}&pageSize=${PAGE_SIZE}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to fetch collection");
        if (!cancelled) setCollectionData(json);
      } catch (err) {
        if (!cancelled) notify.error(err instanceof Error ? err.message : "Failed to fetch collection");
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBackup, selectedCollection, page]);

  // Reset filters when collection changes
  useEffect(() => {
    setFilters([]);
    setQuickSearch("");
    setShowFilters(false);
  }, [selectedCollection]);

  const filteredCollections = useMemo(() => {
    if (!inspect) return [];
    const q = collectionFilter.trim().toLowerCase();
    if (!q) return inspect.collections;
    return inspect.collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [inspect, collectionFilter]);

  // ── Extract field names from loaded documents ──
  const fieldPaths = useMemo(() => {
    if (!collectionData?.documents?.length) return [];
    return extractFieldPaths(collectionData.documents);
  }, [collectionData]);

  // ── Apply filters + quick search to documents ──
  const filteredDocuments = useMemo(() => {
    if (!collectionData?.documents) return [];
    let docs = collectionData.documents;

    // Apply field filters
    const activeFilters = filters.filter(f => f.field);
    if (activeFilters.length > 0) {
      docs = docs.filter((doc) =>
        activeFilters.every((f) => docMatchesFilter(doc, f))
      );
    }

    // Apply quick search (searches all string values)
    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase();
      docs = docs.filter((doc) => {
        const str = JSON.stringify(doc).toLowerCase();
        return str.includes(q);
      });
    }

    return docs;
  }, [collectionData, filters, quickSearch]);

  // ---- Actions
  const copyJson = async () => {
    if (!filteredDocuments.length) return;
    await navigator.clipboard.writeText(JSON.stringify(filteredDocuments, null, 2));
    notify.success(`Copied ${filteredDocuments.length} doc(s) to clipboard`);
  };

  const downloadFullCollection = async () => {
    if (!selectedBackup || !selectedCollection) return;
    notify.info("Preparing full collection download…");
    try {
      const res = await fetch(
        `/api/admin/backups/collection?url=${encodeURIComponent(
          selectedBackup.url,
        )}&name=${encodeURIComponent(selectedCollection)}&full=true`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Download failed");

      const blob = new Blob([JSON.stringify(json.documents, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${selectedDate}_${selectedCollection}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { id: `f-${++filterId}`, field: "", operator: "contains", value: "" },
    ]);
    setShowFilters(true);
  };

  const updateFilter = (id: string, updates: Partial<FieldFilter>) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAllFilters = () => {
    setFilters([]);
    setQuickSearch("");
  };

  const activeFilterCount = filters.filter(f => f.field).length + (quickSearch.trim() ? 1 : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar: date + collection + refresh */}
      <div className="flex items-center gap-3 flex-wrap shrink-0 py-2 px-1 border-b bg-background z-10">
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {loadingBackups ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : backups.length === 0 ? (
            <div className="text-sm text-muted-foreground">No backups found.</div>
          ) : (
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="h-8 w-auto min-w-[180px]">
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent>
                {backups.map((b) => (
                  <SelectItem key={b.publicId} value={b.date}>
                    {b.date} <span className="ml-2 text-xs text-muted-foreground">({formatBytes(b.bytes)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedBackup && (
            <a
              href={selectedBackup.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Collection filter + select */}
        {inspect && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <FileJson className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge variant="secondary" className="font-normal text-[10px]">
                {inspect.collections.length}
              </Badge>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  className="pl-6 h-8 w-[180px]"
                  placeholder="Filter collections…"
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                />
              </div>
              <Select
                value={selectedCollection}
                onValueChange={(v) => {
                  setSelectedCollection(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[220px]">
                  <SelectValue placeholder="Select collection" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCollections.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches</div>
                  ) : (
                    filteredCollections.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">({c.documentCount})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {loadingInspect && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading backup…
          </div>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-8" onClick={loadBackups} disabled={loadingBackups}>
            {loadingBackups ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Document viewer */}
      {selectedCollection && (
        <div className="flex flex-col flex-1 min-h-0 border-t">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b bg-background shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-medium text-sm">{selectedCollection}</div>
              {collectionData && (
                <Badge variant="secondary" className="text-[10px]">
                  {collectionData.totalDocs.toLocaleString()} docs
                </Badge>
              )}
              {collectionData && collectionData.totalPages > 1 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loadingDocs}
                  >
                    Prev
                  </Button>
                  <span>
                    {collectionData.page} / {collectionData.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPage((p) => Math.min(collectionData.totalPages, p + 1))}
                    disabled={page >= collectionData.totalPages || loadingDocs}
                  >
                    Next
                  </Button>
                </div>
              )}

              {/* Separator */}
              {collectionData && <div className="h-4 w-px bg-border" />}

              {/* Quick search */}
              {collectionData && collectionData.documents.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    className="pl-6 h-7 w-[200px] text-xs"
                    placeholder="Quick search all fields…"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                  />
                </div>
              )}

              {/* Add field filter */}
              {collectionData && fieldPaths.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={addFilter}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Add Filter
                </Button>
              )}

              {/* Active filter count */}
              {activeFilterCount > 0 && (
                <>
                  <Badge variant="default" className="text-[10px] gap-1">
                    <Filter className="h-2.5 w-2.5" />
                    {activeFilterCount} active
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Showing {filteredDocuments.length} of {collectionData?.documents.length || 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyJson} disabled={!filteredDocuments.length}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={downloadFullCollection}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
            </div>
          </div>

          {/* Field Filters */}
          {filters.length > 0 && (
            <div className="px-2 py-1.5 border-b bg-muted/20 space-y-1.5">
              {filters.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5 flex-wrap">
                  {/* Field select */}
                  <Select
                    value={f.field}
                    onValueChange={(v) => updateFilter(f.id, { field: v })}
                  >
                    <SelectTrigger className="h-7 w-[200px] text-xs">
                      <SelectValue placeholder="Select field…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {fieldPaths.map((fp) => (
                        <SelectItem key={fp} value={fp} className="text-xs">
                          {fp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator select */}
                  <Select
                    value={f.operator}
                    onValueChange={(v) => updateFilter(f.id, { operator: v as FieldFilter["operator"] })}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value input (hidden for exists/not_exists) */}
                  {f.operator !== "exists" && f.operator !== "not_exists" && (
                    <Input
                      className="h-7 w-[200px] text-xs"
                      placeholder="Value…"
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFilter(f.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Document JSON viewer — this is the only scrollable area */}
          <div className="flex-1 min-h-0 overflow-auto p-2">
            {loadingDocs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : !collectionData ? null : filteredDocuments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {activeFilterCount > 0 ? "No documents match the current filters." : "Empty collection."}
              </div>
            ) : (
              <pre className="text-xs leading-relaxed bg-muted/40 rounded-md p-2 font-mono">
                {JSON.stringify(filteredDocuments, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
