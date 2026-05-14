/**
 * /fleet/vehicles/[id]/inspections/[inspectionId]
 *
 * Renders the existing inspection detail UI at the nested vehicle URL
 * (no redirect — URL stays as-is). The shared InspectionDetailPage
 * component reads `params.inspectionId` first, then falls back to
 * `params.id`, so it works at both route patterns.
 */
export { default } from "@/app/(protected)/fleet/inspections/[id]/page";
