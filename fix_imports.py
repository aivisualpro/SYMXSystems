import re

fpath = "app/(protected)/everyday/page.tsx"
with open(fpath, "r") as f:
    content = f.read()

# Fix useRef import
if "useRef" not in content[:1000]:
    content = content.replace('useState,', 'useState, useRef,', 1)

# Fix lucide-react imports
if "Paperclip" not in content[:1000]:
    content = re.sub(r'import\s+\{\s*([^\}]+)\s*\}\s*from\s+["\']lucide-react["\'];',
                     r'import { \1, Paperclip, ImagePlus, Plus } from "lucide-react";', content)

with open(fpath, "w") as f:
    f.write(content)

print("Fixed imports")
