import re

fpath = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# We need to extract the cells. The tricky part is the dropdowns which are multi-line.
# Let's extract each cell block with regex.
# Employee and Conf Status are 1 and 2, which don't need to move.
# But WST, Route #, Van, Bags, OV, Service Type, Stops, Pkgs, Duration, Wave Time, PAD
# need to be re-ordered.

# 3. WST
wst_match = re.search(r'\{/\* 3\. WST \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 4. Route #
route_match = re.search(r'\{/\* 4\. Route # \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 5. Van
van_match = re.search(r'\{/\* 5\. Van \*/\}\s*<td.*?</DropdownMenu>\s*</td>', content, re.DOTALL)
# 6. Bags
bags_match = re.search(r'\{/\* 6\. Bags \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 7. OV
ov_match = re.search(r'\{/\* 7\. OV \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 8. Service Type
service_match = re.search(r'\{/\* 8\. Service Type.*?</td>', content, re.DOTALL)
# 9. Stops
stops_match = re.search(r'\{/\* 9\. Stops \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 10. Packages
pkgs_match = re.search(r'\{/\* 10\. Packages \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 11. Duration
dur_match = re.search(r'\{/\* 11\. Duration \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 12. Wave Time
wave_match = re.search(r'\{/\* 12\. Wave Time \*/\}\s*<td.*?</td>', content, re.DOTALL)
# 13. PAD
pad_match = re.search(r'\{/\* 13\. PAD \*/\}\s*<td.*?</td>', content, re.DOTALL)

if not all([wst_match, route_match, van_match, bags_match, ov_match, service_match, stops_match, pkgs_match, dur_match, wave_match, pad_match]):
    print("Failed to find some cells!")
    print("wst:", bool(wst_match))
    print("route:", bool(route_match))
    print("van:", bool(van_match))
    print("bags:", bool(bags_match))
    print("ov:", bool(ov_match))
    print("service:", bool(service_match))
    print("stops:", bool(stops_match))
    print("pkgs:", bool(pkgs_match))
    print("dur:", bool(dur_match))
    print("wave:", bool(wave_match))
    print("pad:", bool(pad_match))
    exit(1)

# Now remove them from their current location. Wait, we can just replace the whole block of cells 3 to 13.
# The block starts at wst_match.start() and ends at pad_match.end()
start_idx = wst_match.start()
end_idx = pad_match.end()

# The user wants bags and ov to have "column color change bg same color".
bags_content = bags_match.group(0).replace('className="px-2 py-1.5"', 'className="px-2 py-1.5 bg-sky-500/10"')
ov_content = ov_match.group(0).replace('className="px-2 py-1.5"', 'className="px-2 py-1.5 bg-sky-500/10"')

# The new order:
# Route #, Van, Bags, OV, WST, Stops, Pkgs, Duration, Wave, Pad, Service Type
new_cells = [
    route_match.group(0).replace("4.", "3."),
    van_match.group(0).replace("5.", "4."),
    bags_content.replace("6.", "5."),
    ov_content.replace("7.", "6."),
    wst_match.group(0).replace("3.", "7."),
    stops_match.group(0).replace("9.", "8."),
    pkgs_match.group(0).replace("10.", "9."),
    dur_match.group(0).replace("11.", "10."),
    wave_match.group(0).replace("12.", "11."),
    pad_match.group(0).replace("13.", "12."),
    service_match.group(0).replace("8.", "13.")
]

new_block = "\n\n                                                        ".join(new_cells)

content = content[:start_idx] + new_block + content[end_idx:]

with open(fpath, "w") as f:
    f.write(content)

print("Cells rearranged successfully!")
