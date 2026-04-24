"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    X,
    Loader2,
    Save,
    TableProperties,
    Search,
    ChevronDown,
    Check,
    AlertCircle,
    FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDispatching } from "../layout";
import { Trash2, ArrowUpDown } from "lucide-react";

// ── Column definitions for the spreadsheet ──
interface ColumnDef {
    key: string;
    label: string;
    width: number;
    readOnly?: boolean;
    type: "index" | "text" | "dropdown";
    dropdownKind?: "driver" | "waveTime" | "pad" | "wst";
}

const COLUMNS: ColumnDef[] = [
    { key: "rowNum", label: "#", width: 40, readOnly: true, type: "index" },
    { key: "transporterId", label: "Driver", width: 160, type: "dropdown", dropdownKind: "driver" },
    { key: "routeNumber", label: "Route #", width: 90, type: "text" },
    { key: "stopCount", label: "Stops", width: 65, type: "text" },
    { key: "packageCount", label: "Pkgs", width: 65, type: "text" },
    { key: "routeDuration", label: "Duration", width: 80, type: "text" },
    { key: "waveTime", label: "Wave", width: 80, type: "dropdown", dropdownKind: "waveTime" },
    { key: "pad", label: "PAD", width: 70, type: "dropdown", dropdownKind: "pad" },
    { key: "wst", label: "WST", width: 80, type: "dropdown", dropdownKind: "wst" },
    { key: "wstDuration", label: "WST Dur", width: 72, type: "text" },
    { key: "bags", label: "Bags", width: 60, type: "text" },
    { key: "ov", label: "OV", width: 55, type: "text" },
    { key: "stagingLocation", label: "Staging", width: 85, type: "text" },
    { key: "actions", label: "", width: 40, readOnly: true, type: "index" }
];

const EDITABLE_COLUMNS = COLUMNS.filter(c => !c.readOnly);
const TOTAL_ROWS = 100;

interface RowData {
    _id: string | null;
    rowIndex: number;
    routeNumber: string;
    stopCount: string;
    packageCount: string;
    routeDuration: string;
    waveTime: string;
    pad: string;
    wst: string;
    wstDuration: string;
    bags: string;
    ov: string;
    stagingLocation: string;
    transporterId: string;
    rawSummary?: any;
}

interface Employee {
    transporterId: string;
    name: string;
    isScheduled?: boolean;
}

interface RoutesInfoPanelProps {
    open: boolean;
    onClose: () => void;
    date: string; // YYYY-MM-DD
}

export default function RoutesInfoPanel({ open, onClose, date }: RoutesInfoPanelProps) {
    const { refreshRoutes } = useDispatching();
    const [rows, setRows] = useState<RowData[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [waveTimeOptions, setWaveTimeOptions] = useState<string[]>([]);
    const [padOptions, setPadOptions] = useState<string[]>([]);
    const [wstOptions, setWstOptions] = useState<{ wst: string; revenue: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());

    // Raw modal state
    const [rawSummaryOpen, setRawSummaryOpen] = useState<{ open: boolean; data: any; routeNumber: string }>({
        open: false,
        data: null,
        routeNumber: ""
    });
    const [rawJsonSearch, setRawJsonSearch] = useState("");

    // Active cell state
    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "routeNumber", direction: "asc" });

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownSearch, setDropdownSearch] = useState("");
    const [dropdownHighlightedIndex, setDropdownHighlightedIndex] = useState(0);

    // Header search state
    const [driverSearch, setDriverSearch] = useState("");

    // Refs
    const gridRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownSearchRef = useRef<HTMLInputElement>(null);
    const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const activeCellRef = useRef(activeCell);
    activeCellRef.current = activeCell;

    // Employee lookup map
    const employeeMap = useMemo(() => {
        const m = new Map<string, Employee>();
        employees.forEach(e => m.set(e.transporterId, e));
        return m;
    }, [employees]);

    // Filtered employees for driver dropdown — exclude drivers already assigned to other rows
    const filteredEmployees = useMemo(() => {
        // Build a set of transporterIds already assigned to OTHER rows
        const currentRowIdx = activeCell?.row ?? -1;
        const usedIds = new Set<string>();
        rows.forEach((r, idx) => {
            if (idx !== currentRowIdx && r.transporterId) {
                usedIds.add(r.transporterId);
            }
        });

        // Filter: exclude already-assigned drivers, then apply search
        let available = employees.filter(e => !usedIds.has(e.transporterId));

        if (dropdownSearch) {
            const q = dropdownSearch.toLowerCase();
            available = available.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.transporterId.toLowerCase().includes(q)
            );
        }

        return available;
    }, [employees, dropdownSearch, rows, activeCell]);

    // Filtered wave time options for wave dropdown
    const filteredWaveOptions = useMemo(() => {
        if (!dropdownSearch) return waveTimeOptions;
        const q = dropdownSearch.toLowerCase();
        return waveTimeOptions.filter(o => o.toLowerCase().includes(q));
    }, [waveTimeOptions, dropdownSearch]);

    // Filtered PAD options
    const filteredPadOptions = useMemo(() => {
        if (!dropdownSearch) return padOptions;
        const q = dropdownSearch.toLowerCase();
        return padOptions.filter(o => o.toLowerCase().includes(q));
    }, [padOptions, dropdownSearch]);

    // Filtered WST options
    const filteredWstOptions = useMemo(() => {
        if (!dropdownSearch) return wstOptions;
        const q = dropdownSearch.toLowerCase();
        return wstOptions.filter(o => o.wst.toLowerCase().includes(q));
    }, [wstOptions, dropdownSearch]);

    // ── Prevent tab switch from losing active cell ──
    useEffect(() => {
        if (!open) return;
        const handleVisibilityChange = () => {
            // When returning to this tab, refocus the grid to restore keyboard nav
            if (document.visibilityState === "visible" && gridRef.current) {
                // Small delay to let browser finish tab switch
                setTimeout(() => {
                    gridRef.current?.focus({ preventScroll: true });
                }, 50);
            }
        };

        // Also prevent blur on window blur (alt-tab, etc.)
        const handleWindowBlur = () => {
            // Do nothing — we don't want to clear active cell
        };

        const handleWindowFocus = () => {
            if (gridRef.current) {
                setTimeout(() => {
                    gridRef.current?.focus({ preventScroll: true });
                }, 50);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("focus", handleWindowFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("focus", handleWindowFocus);
        };
    }, [open]);

    // ── Fetch data ──
    useEffect(() => {
        if (!open || !date) return;
        let cancelled = false;
        setLoading(true);

        fetch(`/api/dispatching/routes-info?date=${encodeURIComponent(date)}`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                let fetchedRows = data.rows || [];
                // Sort initial rows
                fetchedRows.sort((a: any, b: any) => {
                    const aVal = String(a["routeNumber"] || "");
                    const bVal = String(b["routeNumber"] || "");
                    if (!aVal && bVal) return 1;
                    if (aVal && !bVal) return -1;
                    return aVal.localeCompare(bVal, undefined, { numeric: true });
                });
                
                setRows(fetchedRows);
                setEmployees(data.employees || []);
                setWaveTimeOptions(data.waveTimeOptions || []);
                setPadOptions(data.padOptions || []);
                setWstOptions(data.wstOptions || []);
                setSortConfig({ key: "routeNumber", direction: "asc" });
                setDirtyRows(new Set());
                setActiveCell(null);
                setEditingCell(null);
            })
            .catch(() => toast.error("Failed to load routes info"))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [open, date]);

    // ── Sort function ──
    const handleSort = (key: string) => {
        if (key === "rowNum" || key === "actions") return;
        setSortConfig(prev => {
            const direction = prev.key === key && prev.direction === "asc" ? "desc" : "asc";
            setRows(currentRows => {
                return [...currentRows].sort((a: any, b: any) => {
                    const aVal = String(a[key] || "");
                    const bVal = String(b[key] || "");
                    if (!aVal && bVal) return 1;
                    if (aVal && !bVal) return -1;
                    
                    if (direction === "asc") {
                        return aVal.localeCompare(bVal, undefined, { numeric: true });
                    } else {
                        return bVal.localeCompare(aVal, undefined, { numeric: true });
                    }
                });
            });
            return { key, direction };
        });
        setActiveCell(null);
    };

    // ── Save a single cell via PUT ──
    const saveCell = useCallback(async (rowIndex: number, field: string, value: string) => {
        try {
            await fetch("/api/dispatching/routes-info", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, rowIndex, field, value }),
            });
            refreshRoutes();
        } catch {
            // Silent fail for individual cell saves
        }
    }, [date, refreshRoutes]);

    // ── Save all rows (to refresh SYMXRoutes) ──
    const saveAll = useCallback(async () => {
        setSaving(true);
        try {
            // Send all rows that actually have some identifying data
            const activeRows = rows.filter(r => r.routeNumber || r.transporterId || dirtyRows.has(r.rowIndex));
            if (activeRows.length === 0) {
                toast.info("No active rows to save");
                return;
            }
            const res = await fetch("/api/dispatching/routes-info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, rows: activeRows }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`Saved ${data.saved} rows${data.synced > 0 ? `, synced ${data.synced} to Routes` : ""}`);
            setDirtyRows(new Set());
            refreshRoutes();
        } catch (err: any) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }, [rows, dirtyRows, date, refreshRoutes]);

    // ── Delete a row ──
    const deleteRow = useCallback(async (visualRowIndex: number) => {
        const row = rows[visualRowIndex];
        if (!row || row.rowIndex === undefined) return;
        
        try {
            const res = await fetch(`/api/dispatching/routes-info?date=${encodeURIComponent(date)}&rowIndex=${row.rowIndex}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to clear row");
            
            setRows(prev => {
                const updated = [...prev];
                updated[visualRowIndex] = {
                    ...updated[visualRowIndex],
                    routeNumber: "",
                    stopCount: "",
                    packageCount: "",
                    routeDuration: "",
                    waveTime: "",
                    pad: "",
                    wst: "",
                    wstDuration: "",
                    bags: "",
                    ov: "",
                    stagingLocation: "",
                    transporterId: "",
                    rawSummary: null,
                };
                
                if (sortConfig) {
                    updated.sort((a: any, b: any) => {
                        const aVal = String(a[sortConfig.key] || "");
                        const bVal = String(b[sortConfig.key] || "");
                        if (!aVal && bVal) return 1;
                        if (aVal && !bVal) return -1;
                        if (sortConfig.direction === "asc") {
                            return aVal.localeCompare(bVal, undefined, { numeric: true });
                        } else {
                            return bVal.localeCompare(aVal, undefined, { numeric: true });
                        }
                    });
                }
                
                return updated;
            });
            setDirtyRows(prev => {
                const n = new Set(prev);
                n.delete(row.rowIndex);
                return n;
            });
            toast.success("Row cleared");
            refreshRoutes();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete");
        }
    }, [rows, date, refreshRoutes, sortConfig]);

    // ── Cell update ──
    const updateCell = useCallback((visualIndex: number, field: string, value: string) => {
        const actualRowIndex = rows[visualIndex]?.rowIndex;
        if (actualRowIndex === undefined) return;

        setRows(prev => {
            const updated = [...prev];
            (updated[visualIndex] as any)[field] = value;
            return updated;
        });
        setDirtyRows(prev => new Set(prev).add(actualRowIndex));
        // Auto-save individual cell
        saveCell(actualRowIndex, field, value);
    }, [rows, saveCell]);

    // Ref to break circular dep between moveForward <-> startEditing
    const startEditingRef = useRef<(row: number, col: number) => void>(() => { });

    // ── Start editing a cell ──
    const startEditing = useCallback((row: number, col: number) => {
        const column = EDITABLE_COLUMNS[col];
        if (!column) return;

        if (column.type === "dropdown") {
            setEditingCell({ row, col });
            setDropdownOpen(true);
            setDropdownSearch("");
            setDropdownHighlightedIndex(0);
            setTimeout(() => dropdownSearchRef.current?.focus(), 50);
            return;
        }

        const currentValue = (rows[row] as any)?.[column.key] || "";
        setEditingCell({ row, col });
        setEditValue(currentValue);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [rows]);

    // Keep the ref in sync
    startEditingRef.current = startEditing;

    // ── Move to next cell (forward) ──
    const moveForward = useCallback((fromRow: number, fromCol: number) => {
        let nextCol = fromCol + 1;
        let nextRow = fromRow;
        if (nextCol >= EDITABLE_COLUMNS.length) {
            nextCol = 0;
            nextRow = fromRow + 1;
        }
        if (nextRow < TOTAL_ROWS && nextCol < EDITABLE_COLUMNS.length) {
            setActiveCell({ row: nextRow, col: nextCol });
            setTimeout(() => startEditingRef.current(nextRow, nextCol), 10);
        }
    }, []);

    // ── Select a dropdown value (generic for both driver and wave time) ──
    const selectDropdownValue = useCallback(async (value: string) => {
        if (editingCell) {
            const column = EDITABLE_COLUMNS[editingCell.col];
            if (column) {
                updateCell(editingCell.row, column.key, value);
                
                // Auto-populate PAD logic if waveTime is selected
                if (column.key === "waveTime" && value) {
                    try {
                        const res = await fetch(`/api/admin/settings/dropdowns?type=wave time`);
                        const json = await res.json();
                        const waveOpt = json.find((o: any) => o.description === value);
                        if (waveOpt && waveOpt.defaultPad) {
                            updateCell(editingCell.row, "pad", waveOpt.defaultPad);
                        }
                    } catch (e) {
                        console.error("Failed to auto-populate default PAD");
                    }
                }
            }
            // Auto-advance to next cell after selection
            const fromRow = editingCell.row;
            const fromCol = editingCell.col;
            setDropdownOpen(false);
            setDropdownSearch("");
            setEditingCell(null);
            setTimeout(() => moveForward(fromRow, fromCol), 20);
        } else {
            setDropdownOpen(false);
            setDropdownSearch("");
            setEditingCell(null);
        }
    }, [editingCell, updateCell, moveForward]);

    // ── Commit editing ──
    const commitEdit = useCallback(() => {
        if (!editingCell) return;
        const column = EDITABLE_COLUMNS[editingCell.col];
        if (column && column.type !== "dropdown") {
            updateCell(editingCell.row, column.key, editValue);
        }
        setEditingCell(null);
        setEditValue("");
    }, [editingCell, editValue, updateCell]);

    // ── Cancel editing ──
    const cancelEdit = useCallback(() => {
        setEditingCell(null);
        setEditValue("");
        setDropdownOpen(false);
        setDropdownSearch("");
    }, []);

    // ── Global keyboard handler for dropdowns ──
    useEffect(() => {
        if (!dropdownOpen || !editingCell) return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const column = EDITABLE_COLUMNS[editingCell.col];
            if (!column) return;

            if (e.key === "Escape") {
                cancelEdit();
                e.stopPropagation();
                return;
            }

            let maxIndex = 0;
            if (column.dropdownKind === "driver") maxIndex = filteredEmployees.length - 1;
            else if (column.dropdownKind === "waveTime") maxIndex = filteredWaveOptions.length - 1;
            else if (column.dropdownKind === "pad") maxIndex = filteredPadOptions.length - 1;
            else if (column.dropdownKind === "wst") maxIndex = filteredWstOptions.length - 1;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setDropdownHighlightedIndex(prev => Math.min(prev + 1, maxIndex));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setDropdownHighlightedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (column.dropdownKind === "driver" && filteredEmployees[dropdownHighlightedIndex]) {
                    selectDropdownValue(filteredEmployees[dropdownHighlightedIndex].transporterId);
                } else if (column.dropdownKind === "waveTime" && filteredWaveOptions[dropdownHighlightedIndex]) {
                    selectDropdownValue(filteredWaveOptions[dropdownHighlightedIndex]);
                } else if (column.dropdownKind === "pad" && filteredPadOptions[dropdownHighlightedIndex]) {
                    selectDropdownValue(filteredPadOptions[dropdownHighlightedIndex]);
                } else if (column.dropdownKind === "wst" && filteredWstOptions[dropdownHighlightedIndex]) {
                    selectDropdownValue(filteredWstOptions[dropdownHighlightedIndex].wst);
                }
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown, true);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
    }, [dropdownOpen, editingCell, filteredEmployees, filteredWaveOptions, filteredPadOptions, filteredWstOptions, dropdownHighlightedIndex, cancelEdit, selectDropdownValue]);


    // ── Keyboard navigation ──
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Dropdown keyboard navigation is handled by a global useEffect
        // This handler only deals with grid navigation and text editing
        if (editingCell) {
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                commitEdit();
                // Both Enter and Tab move forward
                moveForward(editingCell.row, editingCell.col);
            } else if (e.key === "Escape") {
                cancelEdit();
                e.preventDefault();
            }
            return;
        }

        if (!activeCell) return;

        const { row, col } = activeCell;

        switch (e.key) {
            case "ArrowUp":
                e.preventDefault();
                if (row > 0) setActiveCell({ row: row - 1, col });
                break;
            case "ArrowDown":
                e.preventDefault();
                if (row < TOTAL_ROWS - 1) setActiveCell({ row: row + 1, col });
                break;
            case "ArrowLeft":
                e.preventDefault();
                if (col > 0) setActiveCell({ row, col: col - 1 });
                break;
            case "ArrowRight":
                e.preventDefault();
                if (col < EDITABLE_COLUMNS.length - 1) setActiveCell({ row, col: col + 1 });
                break;
            case "Enter":
                e.preventDefault();
                startEditing(row, col);
                break;
            case "Tab":
                e.preventDefault();
                const nextTab = e.shiftKey ? col - 1 : col + 1;
                if (nextTab >= 0 && nextTab < EDITABLE_COLUMNS.length) {
                    setActiveCell({ row, col: nextTab });
                } else if (!e.shiftKey && row < TOTAL_ROWS - 1) {
                    setActiveCell({ row: row + 1, col: 0 });
                } else if (e.shiftKey && row > 0) {
                    setActiveCell({ row: row - 1, col: EDITABLE_COLUMNS.length - 1 });
                }
                break;
            case "F2":
                e.preventDefault();
                startEditing(row, col);
                break;
            case "Delete":
            case "Backspace":
                e.preventDefault();
                const column = EDITABLE_COLUMNS[col];
                if (column) {
                    updateCell(row, column.key, "");
                }
                break;
            default:
                // Start editing on any printable character (but not for dropdowns)
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    const col2 = EDITABLE_COLUMNS[col];
                    if (col2 && col2.type !== "dropdown") {
                        e.preventDefault();
                        startEditing(row, col);
                        setEditValue(e.key);
                    }
                }
        }
    }, [activeCell, editingCell, startEditing, commitEdit, cancelEdit, updateCell]);

    // ── Paste support ──
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        if (!activeCell) return;
        if (editingCell) return; // Let the input handle paste natively when editing

        e.preventDefault();
        const pasteData = e.clipboardData.getData("text");
        if (!pasteData) return;

        // Split by newlines for rows, and by tabs for columns
        const pasteRows = pasteData.split(/\r?\n/).filter(line => line.length > 0);
        const newDirty = new Set(dirtyRows);

        setRows(prev => {
            const updated = [...prev];
            for (let ri = 0; ri < pasteRows.length; ri++) {
                const targetRow = activeCell.row + ri;
                if (targetRow >= TOTAL_ROWS) break;
                
                const actualRowIndex = updated[targetRow]?.rowIndex;
                if (actualRowIndex === undefined) continue;

                const pasteCols = pasteRows[ri].split("\t");
                for (let ci = 0; ci < pasteCols.length; ci++) {
                    const targetCol = activeCell.col + ci;
                    if (targetCol >= EDITABLE_COLUMNS.length) break;

                    const column = EDITABLE_COLUMNS[targetCol];
                    if (column && column.type === "text") {
                        (updated[targetRow] as any)[column.key] = pasteCols[ci].trim();
                        newDirty.add(actualRowIndex);
                        // Auto-save each pasted cell
                        saveCell(actualRowIndex, column.key, pasteCols[ci].trim());
                    }
                }
            }
            return updated;
        });

        setDirtyRows(newDirty);
        const pastedCells = pasteRows.reduce((sum, line) => sum + line.split("\t").length, 0);
        toast.success(`Pasted ${pastedCells} value${pastedCells !== 1 ? "s" : ""}`);
    }, [activeCell, editingCell, dirtyRows, saveCell]);

    // ── Scroll active cell into view ──
    useEffect(() => {
        if (!activeCell) return;
        const key = `${activeCell.row}-${activeCell.col}`;
        const cellEl = cellRefs.current.get(key);
        if (cellEl) {
            cellEl.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }, [activeCell]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        const handle = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                cancelEdit();
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [dropdownOpen, cancelEdit]);

    // ── Scroll to search result in Raw JSON ──
    useEffect(() => {
        if (rawSummaryOpen.open && rawJsonSearch) {
            const timer = setTimeout(() => {
                const mark = document.querySelector(".raw-json-modal-content mark");
                if (mark) {
                    mark.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [rawJsonSearch, rawSummaryOpen.open, rawSummaryOpen.data]);


    const formattedDate = useMemo(() => {
        if (!date) return "";
        const d = new Date(date + "T00:00:00Z");
        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    }, [date]);

    // ── Render a dropdown popup (shared between driver and wave time) ──
    const renderDropdown = useCallback((col: ColumnDef, cellValue: string) => {
        if (!dropdownOpen) return null;

        if (col.dropdownKind === "driver") {
            return (
                <div className="absolute top-full left-0 mt-1 w-64 max-h-[240px] bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150">
                    {/* Search */}
                    <div className="p-1.5 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <input
                                ref={dropdownSearchRef}
                                type="text"
                                value={dropdownSearch}
                                onChange={e => setDropdownSearch(e.target.value)}
                                placeholder="Search driver..."
                                className="w-full h-7 pl-7 pr-2 text-[11px] bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    {/* Clear */}
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors border-b border-border"
                        onClick={() => selectDropdownValue("")}
                    >
                        <X className="h-3 w-3" />
                        <span>Clear selection</span>
                    </button>
                    {/* Options */}
                    <div className="overflow-auto flex-1 p-1">
                        {filteredEmployees.map((emp, i) => {
                            const isSelected = cellValue === emp.transporterId;
                            const isHighlighted = i === dropdownHighlightedIndex;
                            return (
                                <button
                                    key={emp.transporterId}
                                    className={cn(
                                        "flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] transition-colors rounded-sm",
                                        isSelected || isHighlighted
                                            ? "bg-accent text-primary"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                    onClick={() => selectDropdownValue(emp.transporterId)}
                                    onMouseEnter={() => setDropdownHighlightedIndex(i)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{emp.name}</div>
                                        <div className="text-[9px] text-muted-foreground">{emp.transporterId}</div>
                                    </div>
                                    {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                                </button>
                            );
                        })}
                        {filteredEmployees.length === 0 && (
                            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                                No drivers found
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Simple string list dropdown (waveTime, pad)
        if (col.dropdownKind === "waveTime" || col.dropdownKind === "pad") {
            const options = col.dropdownKind === "waveTime" ? filteredWaveOptions : filteredPadOptions;
            const totalCount = col.dropdownKind === "waveTime" ? waveTimeOptions.length : padOptions.length;
            const label = col.dropdownKind === "waveTime" ? "wave time" : "PAD";

            return (
                <div className="absolute top-full left-0 mt-1 w-48 max-h-[240px] bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150">
                    {totalCount > 5 && (
                        <div className="p-1.5 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <input
                                    ref={dropdownSearchRef}
                                    type="text"
                                    value={dropdownSearch}
                                    onChange={e => {
                                        setDropdownSearch(e.target.value);
                                        setDropdownHighlightedIndex(0);
                                    }}
                                    placeholder={`Search ${label}...`}
                                    className="w-full h-7 pl-7 pr-2 text-[11px] bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors border-b border-border"
                        onClick={() => selectDropdownValue("")}
                    >
                        <X className="h-3 w-3" />
                        <span>Clear</span>
                    </button>
                    <div className="overflow-auto flex-1 p-1">
                        {options.map((opt, i) => {
                            const isSelected = cellValue === opt;
                            const isHighlighted = i === dropdownHighlightedIndex;
                            return (
                                <button
                                    key={opt}
                                    className={cn(
                                        "flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] transition-colors rounded-sm",
                                        isSelected || isHighlighted
                                            ? "bg-accent text-primary"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                    onClick={() => selectDropdownValue(opt)}
                                    onMouseEnter={() => setDropdownHighlightedIndex(i)}
                                >
                                    <span className="font-medium">{opt}</span>
                                    {isSelected && <Check className="h-3 w-3 text-primary shrink-0 ml-auto" />}
                                </button>
                            );
                        })}
                        {options.length === 0 && (
                            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                                No {label} options found
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // WST dropdown (shows wst name + revenue)
        return (
            <div className="absolute top-full left-0 mt-1 w-52 max-h-[240px] bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150">
                {wstOptions.length > 5 && (
                    <div className="p-1.5 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <input
                                ref={dropdownSearchRef}
                                type="text"
                                value={dropdownSearch}
                                onChange={e => {
                                    setDropdownSearch(e.target.value);
                                    setDropdownHighlightedIndex(0);
                                }}
                                placeholder="Search WST..."
                                className="w-full h-7 pl-7 pr-2 text-[11px] bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                )}
                <button
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors border-b border-border"
                    onClick={() => selectDropdownValue("")}
                >
                    <X className="h-3 w-3" />
                    <span>Clear</span>
                </button>
                <div className="overflow-auto flex-1 p-1">
                    {filteredWstOptions.map((opt, i) => {
                        const isSelected = cellValue === opt.wst;
                        const isHighlighted = i === dropdownHighlightedIndex;
                        return (
                            <button
                                key={opt.wst}
                                className={cn(
                                    "flex items-center justify-between w-full px-3 py-1.5 text-left text-[11px] transition-colors rounded-sm",
                                    isSelected || isHighlighted
                                        ? "bg-accent text-primary"
                                        : "text-foreground hover:bg-muted"
                                )}
                                onClick={() => selectDropdownValue(opt.wst)}
                                onMouseEnter={() => setDropdownHighlightedIndex(i)}
                            >
                                <span className="font-medium">{opt.wst}</span>
                                {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                            </button>
                        );
                    })}
                    {filteredWstOptions.length === 0 && (
                        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                            No WST options found
                        </div>
                    )}
                </div>
            </div>
        );
    }, [dropdownOpen, dropdownSearch, filteredEmployees, filteredWaveOptions, filteredPadOptions, filteredWstOptions, waveTimeOptions.length, padOptions.length, wstOptions.length, cancelEdit, selectDropdownValue]);

    // ── Get display value for a dropdown cell ──
    const getDropdownDisplayValue = useCallback((col: ColumnDef, value: string) => {
        if (!value) return "";
        if (col.dropdownKind === "driver") {
            const emp = employeeMap.get(value);
            return emp ? emp.name : value;
        }
        return value; // waveTime, pad, wst are stored as display strings
    }, [employeeMap]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-[100vw] lg:max-w-[92vw] xl:max-w-[88vw] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
                {/* ── Header ── */}
                <div className="shrink-0 border-b border-border bg-secondary">
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                                <TableProperties className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                                    Routes Info
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                                        {formattedDate}
                                    </span>
                                </h2>
                                <span className="text-[10px] text-muted-foreground">
                                    {TOTAL_ROWS} rows
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search driver..."
                                    value={driverSearch}
                                    onChange={(e) => setDriverSearch(e.target.value)}
                                    className="h-8 w-40 sm:w-56 rounded-md border border-input bg-background pl-8 pr-3 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {driverSearch && (
                                    <button
                                        onClick={() => setDriverSearch("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            {dirtyRows.size > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-primary mr-2">
                                    <AlertCircle className="h-3 w-3" />
                                    {dirtyRows.size} unsaved
                                </span>
                            )}
                            <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                                onClick={saveAll}
                                disabled={saving}
                            >
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {saving ? "Saving..." : "Save All"}
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-semibold" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Spreadsheet Grid ── */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading routes info...</span>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={gridRef}
                        className="flex-1 min-h-0 overflow-auto focus:outline-none"
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onBlur={(e) => {
                            // Prevent losing focus when clicking inside panel elements
                            // Only allow blur to elements OUTSIDE the panel
                            if (e.relatedTarget && (e.currentTarget.contains(e.relatedTarget as Node))) {
                                return;
                            }
                            // Don't clear active cell on blur — keep it persistent
                        }}
                    >
                        <table className="w-full border-collapse min-w-[900px]">
                            {/* Column headers */}
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-muted/80 border-b border-border">
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            className={cn(
                                                "text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold px-1.5 py-2 text-left border-r border-border last:border-r-0 whitespace-nowrap select-none",
                                                col.key !== "rowNum" && col.key !== "actions" ? "cursor-pointer hover:bg-muted/60" : "",
                                                sortConfig?.key === col.key ? "text-foreground" : "text-muted-foreground"
                                            )}
                                            style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            <div className="flex items-center justify-between">
                                                {col.label}
                                                {col.key !== "rowNum" && col.key !== "actions" && (
                                                    <ArrowUpDown className={cn(
                                                        "h-2.5 w-2.5 ml-1 transition-opacity",
                                                        sortConfig?.key === col.key ? "opacity-100" : "opacity-30"
                                                    )} />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Data rows */}
                            <tbody>
                                {rows.map((row, rowIdx) => {
                                    const isDirty = dirtyRows.has(row.rowIndex);
                                    const hasData = row.routeNumber || row.stopCount || row.packageCount || row.transporterId;
                                    
                                    const driverName = (row.transporterId && employeeMap.get(row.transporterId)?.name) || row.transporterId || "";
                                    const isHidden = driverSearch && !driverName.toLowerCase().includes(driverSearch.toLowerCase());

                                    return (
                                        <tr
                                            key={row.rowIndex}
                                            className={cn(
                                                "group transition-colors border-b border-border",
                                                hasData
                                                    ? "bg-card hover:bg-muted/40"
                                                    : "bg-muted/20 hover:bg-muted/40",
                                                isDirty && "bg-primary/10",
                                                isHidden && "hidden"
                                            )}
                                        >
                                            {/* Row number */}
                                            <td
                                                className="text-[10px] text-muted-foreground text-center px-1 py-0 border-r border-border select-none font-mono"
                                                style={{ width: 40, minWidth: 40 }}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className={cn(
                                                        isDirty && "text-primary font-bold"
                                                    )}>
                                                        {rowIdx + 1}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Editable cells */}
                                            {EDITABLE_COLUMNS.map((col, colIdx) => {
                                                const isActive = activeCell?.row === rowIdx && activeCell?.col === colIdx;
                                                const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                                                const cellValue = (row as any)[col.key] || "";
                                                const cellKey = `${rowIdx}-${colIdx}`;

                                                return (
                                                    <td
                                                        key={col.key}
                                                        ref={(el) => {
                                                            if (el) cellRefs.current.set(cellKey, el as unknown as HTMLDivElement);
                                                        }}
                                                        className={cn(
                                                            "relative px-1 py-0 border-r border-border last:border-r-0 cursor-cell transition-all",
                                                            isActive && !isEditing && "ring-2 ring-inset ring-primary bg-primary/10",
                                                            isEditing && "ring-2 ring-inset ring-primary/80 bg-primary/15"
                                                        )}
                                                        style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                                                        onClick={() => {
                                                            setActiveCell({ row: rowIdx, col: colIdx });
                                                            if (col.type === "dropdown") {
                                                                startEditing(rowIdx, colIdx);
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            if (col.type !== "dropdown") {
                                                                startEditing(rowIdx, colIdx);
                                                            }
                                                        }}
                                                    >
                                                        {isEditing && col.type === "dropdown" ? (
                                                            // Dropdown cell
                                                            <div ref={dropdownRef} className="relative">
                                                                <div className="flex items-center gap-1 h-[26px]">
                                                                    <span className="text-[11px] truncate flex-1">
                                                                        {getDropdownDisplayValue(col, cellValue)}
                                                                    </span>
                                                                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                </div>
                                                                {renderDropdown(col, cellValue)}
                                                            </div>
                                                        ) : isEditing ? (
                                                            // Text editing
                                                            <input
                                                                ref={inputRef}
                                                                type="text"
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onBlur={() => commitEdit()}
                                                                className="w-full h-[26px] px-1 text-[11px] bg-transparent border-0 focus:outline-none"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            // Display value
                                                            <div className="h-[26px] flex items-center px-0.5 min-w-0">
                                                                {col.type === "dropdown" && cellValue ? (
                                                                    <span className={cn(
                                                                        "text-[11px] truncate font-medium rounded-sm px-1 py-0.5 w-full",
                                                                        col.dropdownKind === "driver" && employeeMap.has(cellValue) && !employeeMap.get(cellValue)?.isScheduled
                                                                            ? "bg-red-500 text-white" 
                                                                            : "text-primary"
                                                                    )}>
                                                                        {getDropdownDisplayValue(col, cellValue)}
                                                                    </span>
                                                                ) : (
                                                                    <span className={cn(
                                                                        "text-[11px] truncate",
                                                                        cellValue ? "text-foreground" : "text-transparent"
                                                                    )}>
                                                                        {col.key === "routeDuration" && typeof cellValue === "string" && /^\d{1,2}:\d{2}:\d{2}$/.test(cellValue) 
                                                                            ? cellValue.substring(0, cellValue.lastIndexOf(":")) 
                                                                            : (cellValue || "—")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Actions Button */}
                                            <td className="px-1 py-0 border-border border-r last:border-r-0 select-none text-center" style={{ width: 40, minWidth: 40 }}>
                                                <div className="flex items-center justify-center gap-0.5">
                                                    {row.rawSummary && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                            onClick={() => setRawSummaryOpen({ open: true, data: row.rawSummary, routeNumber: row.routeNumber || `Row ${row.rowIndex + 1}` })}
                                                            title="View Raw Summary"
                                                        >
                                                            <FileJson className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {hasData && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                            onClick={() => deleteRow(rowIdx)}
                                                            title="Clear Row"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Raw JSON Modal ── */}
            {rawSummaryOpen.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setRawSummaryOpen({ open: false, data: null, routeNumber: "" }); setRawJsonSearch(""); }} />
                    <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                            <h3 className="font-semibold flex items-center gap-2">
                                <FileJson className="h-4 w-4 text-primary" />
                                Raw JSON <span className="text-muted-foreground font-normal">({rawSummaryOpen.routeNumber})</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={rawJsonSearch}
                                        onChange={e => setRawJsonSearch(e.target.value)}
                                        placeholder="Search JSON..."
                                        className="h-8 pl-8 pr-3 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-48"
                                    />
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setRawSummaryOpen({ open: false, data: null, routeNumber: "" }); setRawJsonSearch(""); }}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-muted/10 text-[11px] sm:text-[12px] raw-json-modal-content">
                            <pre className="font-mono text-foreground whitespace-pre-wrap word-break-all">
                                {(() => {
                                    if (!rawSummaryOpen.data) return "";
                                    const str = JSON.stringify(rawSummaryOpen.data, null, 2);
                                    if (!rawJsonSearch) return str;
                                    try {
                                        const regex = new RegExp(`(${rawJsonSearch.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
                                        const parts = str.split(regex);
                                        return parts.map((part, i) =>
                                            regex.test(part) ? <mark key={i} className="bg-yellow-400 text-black rounded-sm px-0.5">{part}</mark> : part
                                        );
                                    } catch {
                                        return str;
                                    }
                                })()}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
