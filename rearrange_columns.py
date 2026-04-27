import re

fpath = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# 1. Update COLUMNS array
columns_start_match = re.search(r'const COLUMNS: ColumnDef\[\] = \[', content)
if not columns_start_match:
    print("Could not find COLUMNS array")
    exit(1)

columns_end_match = re.search(r'\] as const;', content[columns_start_match.start():])
if not columns_end_match:
    print("Could not find COLUMNS array end")
    exit(1)

columns_block = content[columns_start_match.start():columns_start_match.start() + columns_end_match.end()]

new_columns_block = """const COLUMNS: ColumnDef[] = [
    { key: "employee", label: "Employee", minW: 140, sticky: true },
    { key: "confirmationStatus", label: "Conf Status", minW: 100, sticky: false },
    { key: "routeNumber", label: "Route #", minW: 60, sticky: false },
    { key: "van", label: "Van", minW: 58, sticky: false, align: "left" },
    { key: "bags", label: "Bags", minW: 40, sticky: false },
    { key: "ov", label: "OV", minW: 36, sticky: false },
    { key: "wst", label: "WST", minW: 50, sticky: false },
    { key: "stopCount", label: "Stops", minW: 46, sticky: false },
    { key: "packageCount", label: "Pkgs", minW: 44, sticky: false },
    { key: "routeDuration", label: "Duration", minW: 56, sticky: false },
    { key: "waveTime", label: "Wave", minW: 56, sticky: false },
    { key: "pad", label: "PAD", minW: 42, sticky: false },
    { key: "serviceType", label: "Service", minW: 64, sticky: false },
    { key: "dashcam", label: "Dashcam", minW: 64, sticky: false },
    { key: "routesCompleted", label: "Routes", minW: 50, sticky: false },
    { key: "routeSize", label: "Rt Size", minW: 56, sticky: false },
    { key: "wstDuration", label: "WST Dur", minW: 52, sticky: false },
    { key: "stagingLocation", label: "Staging", minW: 60, sticky: false },
    { key: "departureDelay", label: "Dep Delay", minW: 60, sticky: false },
    { key: "outboundDelay", label: "OB Delay", minW: 56, sticky: false },
    { key: "firstStopDelay", label: "1st Delay", minW: 56, sticky: false },
    { key: "lastStopDelay", label: "Last Delay", minW: 58, sticky: false },
    { key: "dctDelay", label: "DCT Delay", minW: 58, sticky: false },
    { key: "plannedRTSTime", label: "Plan RTS", minW: 56, sticky: false },
    { key: "plannedInboundStem", label: "Plan IB", minW: 52, sticky: false },
    { key: "estimatedRTSTime", label: "Est RTS", minW: 54, sticky: false },
    { key: "plannedDuration1stToLast", label: "Plan 1→L", minW: 56, sticky: false },
    { key: "actualDuration1stToLast", label: "Act 1→L", minW: 56, sticky: false },
    { key: "stopsPerHour", label: "Stops/Hr", minW: 52, sticky: false },
    { key: "totalHours", label: "Total Hrs", minW: 56, sticky: false },
    { key: "regHrs", label: "Reg Hrs", minW: 50, sticky: false },
    { key: "otHrs", label: "OT Hrs", minW: 48, sticky: false },
    { key: "regPay", label: "Reg Pay", minW: 56, sticky: false },
    { key: "otPay", label: "OT Pay", minW: 52, sticky: false },
    { key: "totalCost", label: "Total Cost", minW: 60, sticky: false },
    { key: "hoursWorkedLast7Days", label: "7d Hrs", minW: 48, sticky: false },
    { key: "driverEfficiency", label: "Eff %", minW: 48, sticky: false },
] as const;"""

content = content.replace(columns_block, new_columns_block)

with open(fpath, "w") as f:
    f.write(content)
print("Updated COLUMNS block")
