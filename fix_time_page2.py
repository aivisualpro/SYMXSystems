import re

with open('app/(protected)/dispatching/time/page.tsx', 'r') as f:
    c = f.read()

# Make sure imports are present
if "getContrastText" not in c:
    c = c.replace('import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP } from "@/lib/route-types";', 'import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP, getContrastText } from "@/lib/route-types";')
if "ChevronRight" not in c:
    c = c.replace('ChevronDown,\n', 'ChevronDown,\n    ChevronRight,\n')
if "import React" not in c:
    c = c.replace('import { useState', 'import React, { useState')

start_marker = "{/* Rows */}"
end_marker = "</div>\n                    </div>\n                    </div>\n\n                    {/* Footer */}"

if start_marker in c and end_marker in c:
    before = c.split(start_marker)[0]
    after = end_marker + c.split(end_marker)[1]
    
    new_rows = """{/* Rows */}
                    <div>
                        {groups.map((group) => {
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
                                            {/* Employee (sticky) */}
                                            <div className="flex items-center gap-2 min-w-0 pr-2 sticky left-0 z-10 bg-card group-hover/row:bg-muted/20 transition-colors">
                                                {row.profileImage ? (
                                                    <img src={row.profileImage} alt={row.employeeName} className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-border" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                                                        <span className="text-[9px] font-bold text-primary">{row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                                                    </div>
                                                )}
                                                {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                <span
                                                    className="text-xs font-semibold truncate hover:text-primary transition-colors cursor-pointer"
                                                    style={{ color: getTypeStyle(row.type).colorHex || "inherit" }}
                                                    onClick={() => {
                                                        setQuickEditRow(row);
                                                        setQuickEditForm({ ...row });
                                                    }}
                                                >
                                                    {row.employeeName}
                                                </span>
                                            </div>
                                            {/* Attendance */}
                                            {renderAttendance(row)}
                                            {/* Route # */}
                                            {renderCell(row, "routeNumber", row.routeNumber)}
                                            {/* Paycom In Day */}
                                            {renderCell(row, "paycomInDay", row.paycomInDay)}
                                            {/* Paycom Out Lunch */}
                                            {renderCell(row, "paycomOutLunch", row.paycomOutLunch)}
                                            {/* Paycom In Lunch */}
                                            {renderCell(row, "paycomInLunch", row.paycomInLunch)}
                                            {/* Paycom Out Day */}
                                            {renderCell(row, "paycomOutDay", row.paycomOutDay)}
                                            {/* Punch Status */}
                                            {renderCell(row, "punchStatus", row.punchStatus)}
                                            {/* Attendance Time */}
                                            {renderCell(row, "attendanceTime", row.attendanceTime)}
                                            {/* Amazon Out Lunch */}
                                            {renderCell(row, "amazonOutLunch", row.amazonOutLunch)}
                                            {/* Amazon In Lunch */}
                                            {renderCell(row, "amazonInLunch", row.amazonInLunch)}
                                            {/* Amazon App Logout */}
                                            {renderCell(row, "amazonAppLogout", row.amazonAppLogout)}
                                            {/* Inspection Time */}
                                            {renderCell(row, "inspectionTime", row.inspectionTime)}
                                            {/* Total Hours */}
                                            {renderCell(row, "totalHours", computeTotalHours(row))}
                                            {/* Actions */}
                                            <div className="flex justify-end pr-1">
                                                <button
                                                    onClick={() => {
                                                        setQuickEditRow(row);
                                                        setQuickEditForm({ ...row });
                                                    }}
                                                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            );
                        })}

                        {groups.length === 0 && (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                No employees found for this date
                            </div>
                        )}
                    </div>\n"""
                    
    c = before + new_rows + after
    
    with open('app/(protected)/dispatching/time/page.tsx', 'w') as f:
        f.write(c)
    print("success")
else:
    print("Markers not found")
