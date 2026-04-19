import os
import glob
import re

files = glob.glob('app/(protected)/dispatching/*/page.tsx')

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    modified = False
    
    # Check if we need to add queryClient import
    if 'useQueryClient' not in content and 'fetch("/api/dispatching/routes' in content:
        # Actually some files might not have useQueryClient, we can add it safely right after "use client";
        if 'import { useQueryClient } from "@tanstack/react-query";' not in content:
            content = content.replace('"use client";', '"use client";\nimport { useQueryClient } from "@tanstack/react-query";')
            modified = True
            
        # Also need to instantiate queryClient inside the component.
        # Find the main exported component
        match = re.search(r'export default function (\w+)\(\)\s*{', content)
        if match:
            func_name = match.group(1)
            if 'const queryClient = useQueryClient();' not in content:
                content = content.replace(
                    f'export default function {func_name}() {{',
                    f'export default function {func_name}() {{\n    const queryClient = useQueryClient();'
                )
    
    def replacement(m):
        block = m.group(0)
        if 'queryClient.invalidateQueries({ queryKey: ["dispatching"] });' in block or 'refreshRoutes();' in block:
            return block
        if 'toast.success' in block:
            # Inject invalidation right after toast.success
            return re.sub(r'(toast\.success\([^;]+\);)', r'\1\n            queryClient.invalidateQueries({ queryKey: ["dispatching"] });', block, 1)
        return block

    # We want to match the success blocks of fetch("/api/dispatching/routes"
    # A bit hard to parse safely with regex, but we can look for toast.success after res.json()
    new_content = re.sub(r'const res = await fetch\("/api/dispatching/routes"[\s\S]*?\} catch', replacement, content)
    
    if new_content != content:
        modified = True
        content = new_content
        
    if modified:
        with open(file, 'w') as f:
            f.write(content)
        print(f"Patched {file}")

print("Done")
