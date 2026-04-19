import re

with open('app/(protected)/dispatching/routes/page.tsx', 'r') as f:
    c = f.read()

# Replace handleVanChange
old_van = """            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update van");
            toast.success(newVan ? `Van updated to ${newVan}` : "Van cleared");
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
        } catch (err: any) {
            toast.error(err.message || "Failed to update van");
            refreshRoutes();
        }"""
new_van = """            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update van");
            toast.success(newVan ? `Van updated to ${newVan}` : "Van cleared");
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
            refreshRoutes();
        } catch (err: any) {
            toast.error(err.message || "Failed to update van");
            refreshRoutes();
        }"""
c = c.replace(old_van, new_van)

# Replace handleTypeChange
old_type = """            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Type updated to ${newType}`);
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
        } catch (err: any) {
            toast.error(err.message || "Failed to update type");
            refreshRoutes();
        }"""
new_type = """            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Type updated to ${newType}`);
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
            refreshRoutes();
        } catch (err: any) {
            toast.error(err.message || "Failed to update type");
            refreshRoutes();
        }"""
c = c.replace(old_type, new_type)

with open('app/(protected)/dispatching/routes/page.tsx', 'w') as f:
    f.write(c)
print("success")
