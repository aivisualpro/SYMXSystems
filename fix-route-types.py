import os
import re

FILES = [
    'app/(protected)/dispatching/routes/page.tsx',
    'app/(protected)/dispatching/time/page.tsx',
    'app/(protected)/dispatching/efficiency/page.tsx',
    'app/(protected)/dispatching/attendance/page.tsx',
    'app/(protected)/dispatching/closing/page.tsx',
    'app/(protected)/dispatching/roster/page.tsx',
    'app/(protected)/dispatching/_components/RoutesTable.tsx'
]

def remove_block(content, prefix, terminator_regex):
    idx = content.find(prefix)
    if idx == -1: return content
    # find end
    match = re.search(terminator_regex, content[idx:])
    if not match: return content
    end_idx = idx + match.end()
    return content[:idx] + content[end_idx:]

def process_file(path):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        content = f.read()

    # Add import if not present
    if 'import { getTypeStyle' not in content:
        import_stmt = 'import { getTypeStyle, TYPE_OPTIONS } from "@/lib/route-types";\n'
        # insert after last import
        matches = list(re.finditer(r'^import .*?;$', content, re.MULTILINE))
        if matches:
            last = matches[-1]
            content = content[:last.end()] + '\n' + import_stmt + content[last.end():]

    # Remove TYPE_OPTIONS block:
    # `const TYPE_OPTIONS...];`
    content = re.sub(r'const (ROUTE_)?TYPE_OPTIONS: TypeOption\[\] = \[.*?\];', '', content, flags=re.DOTALL)
    
    # Remove TYPE_MAP
    content = re.sub(r'const (ROUTE_)?TYPE_MAP = new Map.*?;\n', '', content)
    content = re.sub(r'export const (ROUTE_)?TYPE_MAP = new Map.*?;\n', '', content)

    # Remove getTypeStyle
    content = re.sub(r'function get(Route)?TypeStyle.*?\{.*?(?=\n//|\nconst|\nexport|\n\})', '', content, flags=re.DOTALL)
    content = re.sub(r'(export )?const get(Route)?TypeStyle = .*?=> \{.*?(?=\n//|\nconst|\nexport|\n\})', '', content, flags=re.DOTALL)
    
    # Wait, simple regexes might fail to match all {}, let's just do it manually with node!
    # Or I can just write a script that regex-replaces the employee text span!
    
