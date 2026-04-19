with open('app/(protected)/dispatching/time/page.tsx', 'r') as f:
    c = f.read()
import re
print("Lines 895-908:")
lines = c.split("\n")[894:908]
for i, l in enumerate(lines):
    print(f"{895+i}: {l}")
