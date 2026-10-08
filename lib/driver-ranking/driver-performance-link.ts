import "server-only";
import { randomBytes } from "node:crypto";
import DriverPerformanceLink from "@/lib/models/DriverPerformanceLink";
import { publicDriverPerformanceSiteEnabled } from "./driver-performance-public-config";

export const createDriverPerformanceToken = () => randomBytes(32).toString("base64url");

export async function getOrCreateDriverPerformanceLink(siteId: string, employeeId: string, createdBy: string) {
  if (!(await publicDriverPerformanceSiteEnabled(siteId))) {
    throw new Error("Public driver performance links are not enabled for this site.");
  }
  const existing = await DriverPerformanceLink.findOne({ siteId, employeeId }).select("+token").lean() as any;
  if (existing) {
    if (!existing.active) throw new Error("This driver link has been revoked.");
    return String(existing.token);
  }
  const token = createDriverPerformanceToken();
  try {
    await DriverPerformanceLink.create({ siteId, employeeId, token, active: true, createdBy });
    return token;
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const concurrent = await DriverPerformanceLink.findOne({ siteId, employeeId, active: true }).select("+token").lean() as any;
    if (!concurrent?.token) throw error;
    return String(concurrent.token);
  }
}
