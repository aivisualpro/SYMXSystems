import { redirect } from "next/navigation";

/**
 * /fleet/vehicles/[id]  →  /fleet/vehicles/[id]/overview
 *
 * Keeps old bookmarks working by redirecting bare vehicle URLs
 * to the default "overview" tab.
 */
export default async function VehicleRootPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/fleet/vehicles/${id}/overview`);
}
