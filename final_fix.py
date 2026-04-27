import re
import os

files = [
    "app/(protected)/dispatching/routes/page.tsx",
    "app/(protected)/everyday/page.tsx",
    "app/(protected)/load-out/page.tsx"
]

for fpath in files:
    if not os.path.exists(fpath): continue
    with open(fpath, "r") as f: content = f.read()

    # Remove file-scope TYPE_MAP that depends on dynamicTypeOptions
    content = re.sub(r'const TYPE_MAP = new Map.*?;\n', '', content, flags=re.DOTALL)
    
    # Remove file-scope getTypeStyle if it references TYPE_MAP
    content = re.sub(r'const getTypeStyle = \(value: string\).*?return \{ bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" \};\n\};\n', '', content, flags=re.DOTALL)
    
    # ensure formatRouteTypes is imported in load-out
    if fpath.endswith("load-out/page.tsx") and "formatRouteTypes" not in content:
        content = content.replace('import { getContrastText } from "@/lib/route-types";', 'import { getContrastText, formatRouteTypes, getDynamicTypeStyle } from "@/lib/route-types";')

    with open(fpath, "w") as f: f.write(content)

