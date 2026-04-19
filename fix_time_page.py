import re

with open('app/(protected)/dispatching/time/page.tsx', 'r') as f:
    c = f.read()

# Remove Type column
c = re.sub(r'\{ key: "type", label: "Type", width: "w-\[100px\]" \},\n\s*', '', c)
c = c.replace(
    'const GRID_TEMPLATE = "minmax(100px, 150px) 95px 100px 75px 70px 75px 70px 70px 110px 75px 70px 65px 80px 80px 70px 40px";',
    'const GRID_TEMPLATE = "minmax(100px, 150px) 95px 75px 70px 75px 70px 70px 110px 75px 70px 65px 80px 80px 70px 40px";'
)

# Replace parseSmartTime
old_parse = """const parseSmartTime = (val: string): string => {
    if (!val) return "";
    const d = val.replace(/\D/g, "");
    if (!d) return "";

    let hours = 0;
    let mins = 0;

    if (d.length <= 2) {
        hours = parseInt(d, 10);
    } else if (d.length === 3) {
        hours = parseInt(d.substring(0, 1), 10);
        mins = parseInt(d.substring(1, 3), 10);
    } else {
        hours = parseInt(d.substring(0, 2), 10);
        mins = parseInt(d.substring(2, 4), 10);
    }

    if (hours > 23) hours = 23;
    if (mins > 59) mins = 59;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};"""

new_parse = """const parseSmartTime = (val: string): string => {
    if (!val) return "";
    const lowerVal = val.toLowerCase().trim();
    const isPM = lowerVal.includes('p');
    const isAM = lowerVal.includes('a');
    
    const d = val.replace(/\D/g, "");
    if (!d) return "";

    let hours = 0;
    let mins = 0;

    if (d.length <= 2) {
        hours = parseInt(d, 10);
    } else if (d.length === 3) {
        hours = parseInt(d.substring(0, 1), 10);
        mins = parseInt(d.substring(1, 3), 10);
    } else {
        hours = parseInt(d.substring(0, 2), 10);
        mins = parseInt(d.substring(2, 4), 10);
    }

    if (hours > 23) hours = 23;
    if (mins > 59) mins = 59;
    
    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};"""

c = c.replace(old_parse, new_parse)

# Fix input field
old_input = """<input
                        defaultValue={value === 0 ? "" : String(value)}
                        onChange={(e) => {
                            if (isTimeField) {
                                e.target.value = e.target.value.replace(/[^\d:]/g, "");
                            }
                        }}"""
new_input = """<input
                        key={displayVal}
                        defaultValue={displayVal === "—" ? "" : displayVal}
                        onChange={(e) => {
                            if (isTimeField) {
                                e.target.value = e.target.value.replace(/[^\d:ampAMP ]/g, "");
                            }
                        }}"""
c = c.replace(old_input, new_input)

# Add collapsedGroups hook
c = re.sub(r'const \[sortDir, setSortDir\] = useState<"asc" \| "desc">.*?;\n', 
    'const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");\n    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});\n    const toggleGroup = (group: string) => { setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] })); };\n', c)

# Replace filter and sort
old_filter = """// ── Filter + sort ──
    const { rows: displayRows, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(r =>
                r.employeeName.toLowerCase().includes(q) ||
                r.transporterId.toLowerCase().includes(q) ||
                r.routeNumber.toLowerCase().includes(q) ||
                r.attendance.toLowerCase().includes(q) ||
                r.punchStatus.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            const aVal = sortKey === "employee" ? a.employeeName : (a as any)[sortKey] || "";
            const bVal = sortKey === "employee" ? b.employeeName : (b as any)[sortKey] || "";
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats ──
    useEffect(() => { setStats({ employeeCount: totalFiltered }); }, [totalFiltered, setStats]);"""

new_filter = """// ── Filter + sort ──
    const { groups, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(r =>
                r.employeeName.toLowerCase().includes(q) ||
                r.transporterId.toLowerCase().includes(q) ||
                r.routeNumber.toLowerCase().includes(q) ||
                r.attendance.toLowerCase().includes(q) ||
                r.punchStatus.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            const aVal = sortKey === "employee" ? a.employeeName : (a as any)[sortKey] || "";
            const bVal = sortKey === "employee" ? b.employeeName : (b as any)[sortKey] || "";
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        const typeGroups: Record<string, RouteRow[]> = {};
        sorted.forEach(r => {
            const typeKey = r.type || "Unassigned";
            if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
            typeGroups[typeKey].push(r);
        });

        if (sortKey === "employee") {
            Object.values(typeGroups).forEach(group => {
                group.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
            });
        }

        const groupKeys = Object.keys(typeGroups).sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            if (aLower === "route") return -1;
            if (bLower === "route") return 1;
            if (aLower === "off" || aLower === "unassigned" || aLower === "") return 1;
            if (bLower === "off" || bLower === "unassigned" || bLower === "") return -1;
            return a.localeCompare(b);
        });

        const groups = groupKeys.map(key => ({
            type: key,
            rows: typeGroups[key],
            count: typeGroups[key].length,
        }));

        return { groups, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats ──
    useEffect(() => { setStats({ employeeCount: totalFiltered, groupCount: groups.length }); }, [totalFiltered, groups.length, setStats]);"""

c = c.replace(old_filter, new_filter)

# Use regex to replace the displayRows.map loop with groups.map
rows_match = re.search(r'\{displayRows\.map\(\(.*?\).*?\{\/\* Employee \(sticky\) \*\/\)', c, re.DOTALL)
if rows_match:
    original_start_block = rows_match.group(0)
    
    # We also need to remove renderType(row) inside the row rendering block
    c = c.replace('{/* Type */}\n                                {/* renderType(row) */}', '') # If it was commented
    c = c.replace('{/* Type */}\n                                {renderType(row)}', '')
    
    # And replace no employees message if displayRows length === 0. Wait, it's at the end
    
    import textwrap
    new_start_block = """{groups.map((group) => {
                            const isCollapsed = collapsedGroups[group.type] ?? false;
                            const typeOpt = TYPE_MAP.get(group.type.toLowerCase());
                            const GroupIcon = typeOpt?.icon;
                            const groupStyle = getTypeStyle(group.type);
                            
                            return (
                                <React.Fragment key={group.type}>
                                    {/* Group Header Row */}
                                    <div
                                        onClick={() => toggleGroup(group.type)}
                                        className="cursor-pointer hover:bg-muted/60 transition-colors bg-muted/30 border-b border-border/30 px-3 py-1.5 flex items-center"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronRight className={cn(
                                                "h-3 w-3 text-muted-foreground transition-transform",
                                                !isCollapsed && "rotate-90"
                                            )} />
                                            <div className={cn(
                                                "flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-semibold border shadow-sm",
                                                !groupStyle.colorHex && groupStyle.bg,
                                                !groupStyle.colorHex && groupStyle.text,
                                                !groupStyle.colorHex && groupStyle.border
                                            )} style={{
                                                backgroundColor: groupStyle.colorHex || undefined,
                                                color: groupStyle.colorHex ? getContrastText(groupStyle.colorHex) : undefined,
                                                borderColor: groupStyle.colorHex ? 'transparent' : undefined
                                            }}>
                                                {GroupIcon && <GroupIcon className="h-3 w-3" />}
                                                {group.type || "Unassigned"}
                                            </div>
                                            <span className="text-[12px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                                {group.count}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Group Data Rows */}
                                    {!isCollapsed && group.rows.map((row) => (
                                        <div key={row._id} className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors group/row"
                                            style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                            {/* Employee (sticky) */}"""
    
    c = c.replace(original_start_block, new_start_block)
    
    # Close both mappings
    c = c.replace("""                                        </div>
                                    ))}
                        {displayRows.length === 0 && (
                            <div className="text-center py-12 text-sm text-muted-foreground border-b border-border/20">
                                No employees found for this date
                            </div>
                        )}""", """                                        </div>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                        
                        {groups.length === 0 && (
                            <div className="text-center py-12 text-sm text-muted-foreground border-b border-border/20">
                                No employees found for this date
                            </div>
                        )}""")
else:
    print("Failed to find rows map")

# Ensure getContrastText and ChevronRight are imported if they aren't
if "getContrastText" not in c:
    c = c.replace('import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP } from "@/lib/route-types";', 'import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP, getContrastText } from "@/lib/route-types";')
if "ChevronRight" not in c:
    c = c.replace('ChevronDown,\n', 'ChevronDown,\n    ChevronRight,\n')

with open('app/(protected)/dispatching/time/page.tsx', 'w') as f:
    f.write(c)

print("success")
