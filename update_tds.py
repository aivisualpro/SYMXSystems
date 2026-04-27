import re

fpath = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# Cells to move:
# WST needs to be extracted from its current position (after OV) and placed after PAD.
wst_match = re.search(r'\{/\* 7\. WST \*/\}\s*<td.*?</td>', content, re.DOTALL)
pad_match = re.search(r'\{/\* 12\. PAD \*/\}\s*<td.*?</td>', content, re.DOTALL)
dashcam_match = re.search(r'\{/\* 14\. Dashcam.*?</td>', content, re.DOTALL)

if not wst_match or not pad_match or not dashcam_match:
    print("Could not find WST, PAD, or Dashcam match")
    exit(1)

# Extract WST, remove Dashcam, place WST after PAD.
wst_str = wst_match.group(0).replace("7. WST", "11. WST") # We will renumber them later if we want, but it doesn't really matter. Let's just do it.

# Update Stops and Packages colors
content = content.replace(
    'className="px-2 py-1.5">{renderCell(row, "stopCount", row.stopCount)}',
    'className="px-2 py-1.5 bg-orange-500/10">{renderCell(row, "stopCount", row.stopCount)}'
)
content = content.replace(
    'className="px-2 py-1.5">{renderCell(row, "packageCount", row.packageCount)}',
    'className="px-2 py-1.5 bg-orange-500/10">{renderCell(row, "packageCount", row.packageCount)}'
)

# Merge Dashcam into Van
van_trigger_search = r'<button className="cursor-pointer hover:bg-muted/50 rounded py-0\.5 px-1 -ml-1 transition-colors focus:outline-none flex items-center gap-1 w-full text-left group">\s*\{renderCell\(row, "van", row\.van\)\}\s*<ChevronDown'
dashcam_injection = """{renderCell(row, "van", row.van)}
                                                                        {(() => {
                                                                            if (!row.dashcam || row.dashcam.toLowerCase() === "none") return null;
                                                                            const camOpt = dropdowns.find((d: any) => d.type === "dashcam" && d.description.toLowerCase() === row.dashcam.toLowerCase());
                                                                            const CamIcon = camOpt?.icon ? (LucideIcons as any)[camOpt.icon] : Video;
                                                                            const camColor = camOpt?.color || undefined;
                                                                            return (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                                            <CamIcon className={cn("h-3 w-3 ml-0.5", !camColor && "text-muted-foreground")} style={{ color: camColor }} />
                                                                                        </div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>{row.dashcam}</TooltipContent>
                                                                                </Tooltip>
                                                                            );
                                                                        })()}
                                                                        <ChevronDown"""

content = re.sub(van_trigger_search, dashcam_injection, content)

# Remove WST from its old place
content = content.replace(wst_match.group(0), "")
# Remove Dashcam
content = content.replace(dashcam_match.group(0), "")

# Insert WST after PAD
# Re-find PAD because indices changed
pad_match_new = re.search(r'\{/\* 12\. PAD \*/\}\s*<td.*?</td>', content, re.DOTALL)
content = content[:pad_match_new.end()] + "\n\n                                                        " + wst_str + content[pad_match_new.end():]

with open(fpath, "w") as f:
    f.write(content)

print("Updated table cells")
