import { CortexDashboard } from "@/components/cortex/dashboard";
import { requirePermission } from "@/lib/auth/require-permission";
export default async function CortexPage() {
  try {
    await requirePermission("Dispatching", "view");
  } catch {
    return (
      <p className="p-6">Dispatching access is required to view SYMX Cortex.</p>
    );
  }
  return <CortexDashboard />;
}
