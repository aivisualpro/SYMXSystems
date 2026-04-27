import re

fpath = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# 1. Replace Van render logic
van_search = r'\{renderCell\(row, "van", row\.van\)\}'
van_replace = """{(() => {
                                                                            const v = vehicles.find(v => v.vehicleName === row.van);
                                                                            const isInactive = v && v.status && v.status.toLowerCase() !== "active";
                                                                            return (
                                                                                <span className={cn(
                                                                                    "text-[13px] whitespace-nowrap font-semibold",
                                                                                    !row.van ? "text-muted-foreground/30" : isInactive ? "text-red-500" : "text-foreground"
                                                                                )}>
                                                                                    {row.van || "—"}
                                                                                </span>
                                                                            );
                                                                        })()}"""
content = re.sub(van_search, van_replace, content)

# 2. Remove RT Size from COLUMNS
columns_search = r'\s*\{\s*key:\s*"routeSize".*?\},'
content = re.sub(columns_search, "", content)

# 3. Remove RT Size td block
# The block looks like:
# {/* 15. Rt Size */}
# <td className="px-2 py-1.5">
#     <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
#         {row.routeSize || "—"}
#     </span>
# </td>
rt_size_td_search = r'\{/\*\s*\d+\.\s*Rt Size\s*\*/\}\s*<td.*?</td>'
content = re.sub(rt_size_td_search, "", content, flags=re.DOTALL)

with open(fpath, "w") as f:
    f.write(content)

print("Fixed Van color and removed RT Size")
