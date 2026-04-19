with open('app/(protected)/dispatching/time/page.tsx', 'r') as f:
    lines = f.readlines()

with open('app/(protected)/dispatching/time/page.tsx', 'w') as f:
    for i, line in enumerate(lines):
        if i == 899 and line.strip() == "</div>":
            print(f"Skipped line {i}: {line.strip()}")
            continue
        f.write(line)
