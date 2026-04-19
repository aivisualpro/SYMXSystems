import re

with open('app/(protected)/dispatching/time/page.tsx', 'r') as f:
    c = f.read()

# Add import
if 'useQueryClient' not in c:
    c = c.replace('import { useDropdowns } from "@/lib/query/hooks/useShared";', 'import { useDropdowns } from "@/lib/query/hooks/useShared";\nimport { useQueryClient } from "@tanstack/react-query";')

# Add queryClient to function
if 'const queryClient = useQueryClient();' not in c:
    c = c.replace('const { selectedWeek, selectedDate', 'const queryClient = useQueryClient();\n    const { selectedWeek, selectedDate')

# Update handleSave
old_handleSave = """    // ── Save handler ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: value } : r));
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: value } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);"""

new_handleSave = """    // ── Save handler ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: value } : r));
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: value } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"] });
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, [queryClient]);"""
c = c.replace(old_handleSave, new_handleSave)

# Update handleQuickEditSave
old_quickEditSave = """        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Updated time entry for ${quickEditRow.employeeName}`);
        } catch {
            toast.error("Failed to update time entry");
        }"""
        
new_quickEditSave = """        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Updated time entry for ${quickEditRow.employeeName}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"] });
        } catch {
            toast.error("Failed to update time entry");
        }"""
c = c.replace(old_quickEditSave, new_quickEditSave)

with open('app/(protected)/dispatching/time/page.tsx', 'w') as f:
    f.write(c)

print("success")
