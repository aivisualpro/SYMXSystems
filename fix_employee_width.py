import re

# 1. Update /dispatching/routes/page.tsx
fpath1 = "app/(protected)/dispatching/routes/page.tsx"
with open(fpath1, "r") as f:
    content1 = f.read()

# Replace minW: 140 -> minW: 110
content1 = re.sub(r'\{ key: "employee", label: "Employee", minW: 140, sticky: true \}',
                  r'{ key: "employee", label: "Employee", minW: 110, sticky: true }', content1)

# Replace w-[200px] in Employee td -> w-[160px]
content1 = re.sub(r'<td className=\{cn\("px-2 py-1\.5", "sticky left-0 z-\[5\] bg-card w-\[200px\]"\)\}>',
                  r'<td className={cn("px-2 py-1.5", "sticky left-0 z-[5] bg-card w-[160px]")}>', content1)

with open(fpath1, "w") as f:
    f.write(content1)

# 2. Update /everyday/page.tsx
fpath2 = "app/(protected)/everyday/page.tsx"
with open(fpath2, "r") as f:
    content2 = f.read()

content2 = re.sub(r'\{ key: "employee", label: "Employee", minW: 100, className: "w-\[220px\] max-w-\[220px\]", sticky: true \}',
                  r'{ key: "employee", label: "Employee", minW: 100, className: "w-[160px] max-w-[160px]", sticky: true }', content2)

with open(fpath2, "w") as f:
    f.write(content2)

print("Updated employee widths")
