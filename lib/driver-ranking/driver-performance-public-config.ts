import "server-only";
import Site from "@/lib/models/Site";

const enabledValue = "true";

export function publicDriverPerformanceEnabled() {
  return process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED?.trim().toLowerCase() === enabledValue;
}

export function configuredPublicDriverPerformanceSites() {
  return [...new Set(
    (process.env.DRIVER_PERFORMANCE_PUBLIC_SITES || "")
      .split(",")
      .map(value => value.trim().toUpperCase())
      .filter(Boolean),
  )];
}

export function publicDriverPerformanceSiteCodeAllowed(siteCode: string) {
  if (!publicDriverPerformanceEnabled()) return false;
  const allowedSites = configuredPublicDriverPerformanceSites();
  return allowedSites.length === 0 || allowedSites.includes(siteCode.trim().toUpperCase());
}

export async function publicDriverPerformanceSiteEnabled(siteId: string) {
  if (!publicDriverPerformanceEnabled()) return false;
  const allowedSites = configuredPublicDriverPerformanceSites();
  if (allowedSites.length === 0) return true;
  const site = await Site.findById(siteId, { code: 1 }).lean() as { code?: string } | null;
  return Boolean(site?.code && allowedSites.includes(site.code.trim().toUpperCase()));
}
