import re

fpath = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# I need to find the place where {renderCell(row, "van", row.van)} is and put the button back.
# It currently looks like:
# <DropdownMenuTrigger asChild>
# {renderCell(row, "van", row.van)}
# {(() => {

search_str = r'<DropdownMenuTrigger asChild>\s*\{renderCell\(row, "van", row\.van\)\}'
replacement = """<DropdownMenuTrigger asChild>
                                                                    <button className="cursor-pointer hover:bg-muted/50 rounded py-0.5 px-1 -ml-1 transition-colors focus:outline-none flex items-center gap-1 w-full text-left group">
                                                                        {renderCell(row, "van", row.van)}"""

content = re.sub(search_str, replacement, content)

with open(fpath, "w") as f:
    f.write(content)

print("Fixed button syntax")
