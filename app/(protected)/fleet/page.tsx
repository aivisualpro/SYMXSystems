"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  IconCar, IconCheck, IconTool, IconAlertTriangle,
  IconChartDonut, IconSteeringWheel, IconClipboardCheck,
  IconFileInvoice, IconArrowUpRight, IconCalendar,
  IconClock, IconCurrencyDollar, IconChevronRight,
} from "@tabler/icons-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useFleet } from "./layout";
import { KPICard, GlassCard, StatusBadge, FleetLoading } from "./components/fleet-ui";
import FleetFormModal from "./components/fleet-form-modal";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

export default function FleetOverviewPage() {
  const { data, loading } = useFleet();
  const router = useRouter();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load fleet data</div>;

  const { kpis } = data;

  // Pre-computed rental stats from API
  const rs = data.rentalStats || { total: 0, active: 0, expired: 0, expiringSoon: 0, totalAmount: 0 };
  const expiringSoonRentals: any[] = data.expiringSoonRentals || [];

  // Recent inspections + open repairs (already limited to 6 by API)
  const recentInspections: any[] = data.recentInspections || [];
  const openRepairs: any[] = data.openRepairs || [];
  const totalOpenRepairs = data.totalOpenRepairs || openRepairs.length;
  const repairBreakdown = data.repairStatusBreakdown || [];

  return (
    <>
      <div className="space-y-5">
        {/* KPI Cards — 5 across */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard icon={IconCar} label="Total Fleet" value={kpis.totalVehicles} sub="All vehicles" color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
          <KPICard icon={IconCheck} label="Active" value={kpis.activeVehicles} sub="Operational" color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
          <KPICard icon={IconTool} label="Open Repairs" value={totalOpenRepairs} sub="Needs attention" color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
          <KPICard icon={IconClipboardCheck} label="Inspections" value={recentInspections.length} sub="Recent" color="bg-violet-500/15 text-violet-600 dark:text-violet-400" />
          <KPICard icon={IconFileInvoice} label="Rental Agreements" value={rs.total} sub={`$${rs.totalAmount.toLocaleString()} total`} color="bg-teal-500/15 text-teal-600 dark:text-teal-400" />
        </div>

        {/* Row 2 — 3 columns: Status Donut, Ownership Donut, Rental Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Fleet Status Donut */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconChartDonut size={16} className="text-blue-500" /> Fleet Status
              </h3>
              <button onClick={() => router.push("/fleet/vehicles")} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                View All <IconArrowUpRight size={10} />
              </button>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.statusBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                    {data.statusBreakdown.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 justify-center">
              {data.statusBreakdown.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}: <span className="font-semibold text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Ownership Donut */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconSteeringWheel size={16} className="text-purple-500" /> Ownership
              </h3>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.ownershipBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                    {data.ownershipBreakdown.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 justify-center">
              {data.ownershipBreakdown.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}: <span className="font-semibold text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Rental Agreements Summary */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconFileInvoice size={16} className="text-teal-500" /> Rentals
              </h3>
              <button onClick={() => router.push("/fleet/rentals")} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                View All <IconArrowUpRight size={10} />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Active", value: rs.active, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: IconCheck },
                { label: "Expiring (30d)", value: rs.expiringSoon, color: "text-amber-500", bg: "bg-amber-500/10", icon: IconClock },
                { label: "Expired", value: rs.expired, color: "text-red-500", bg: "bg-red-500/10", icon: IconAlertTriangle },
                { label: "Total Amount", value: `$${rs.totalAmount.toLocaleString()}`, color: "text-primary", bg: "bg-primary/10", icon: IconCurrencyDollar },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${item.bg}`}>
                      <item.icon size={14} className={item.color} />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Row 3 — Open Repairs + Recent Inspections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Open Repairs */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconTool size={16} className="text-amber-500" /> Open Repairs
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-500">{totalOpenRepairs}</span>
              </h3>
              <button onClick={() => router.push("/fleet/repairs")} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                View All <IconArrowUpRight size={10} />
              </button>
            </div>
            {openRepairs.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-10">No open repairs 🎉</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {openRepairs.map((r: any, i: number) => (
                  <div key={r._id || i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <IconTool size={14} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{r.description || "Unnamed repair"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {r.unitNumber ? `Unit ${r.unitNumber}` : ""}{" "}
                        {r.estimatedDate ? `• Due ${format(new Date(r.estimatedDate), "MMM dd")}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={r.currentStatus} />
                    <IconChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            )}

            {/* Mini repair breakdown */}
            {repairBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/40">
                {repairBreakdown.filter((r: any) => r.value > 0).map((r: any, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-muted/60 text-muted-foreground">
                    {r.name}: <span className="font-bold text-foreground">{r.value}</span>
                  </span>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Recent Inspections */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconClipboardCheck size={16} className="text-violet-500" /> Recent Inspections
              </h3>
              <button onClick={() => router.push("/fleet/inspections")} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                View All <IconArrowUpRight size={10} />
              </button>
            </div>
            {recentInspections.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-10">No inspections yet</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {recentInspections.map((insp: any, i: number) => {
                  const hasRepair = insp.anyRepairs && insp.anyRepairs !== "FALSE" && insp.anyRepairs !== "false";
                  return (
                    <div
                      key={insp._id || i}
                      onClick={() => router.push(`/fleet/inspections/${insp._id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasRepair ? "bg-red-500/10" : "bg-violet-500/10"}`}>
                        <IconClipboardCheck size={14} className={hasRepair ? "text-red-500" : "text-violet-500"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {insp.vin || "No VIN"}{" "}
                          {insp.unitNumber && <span className="text-muted-foreground">• #{insp.unitNumber}</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <IconCalendar size={9} />
                          {insp.routeDate ? format(new Date(insp.routeDate), "MMM dd, yyyy") : "—"}
                          {insp.driver && <span>• {insp.driver}</span>}
                        </p>
                      </div>
                      {hasRepair && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                          REPAIR
                        </span>
                      )}
                      <IconChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Row 4 — Expiring Rental Agreements */}
        {rs.expiringSoon > 0 && (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconClock size={16} className="text-amber-500" /> Upcoming Rental Expirations
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-500">{rs.expiringSoon}</span>
              </h3>
              <button onClick={() => router.push("/fleet/rentals")} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                View All <IconArrowUpRight size={10} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {expiringSoonRentals.map((r: any, i: number) => (
                <div key={r._id || i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <IconCalendar size={14} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {r.agreementNumber || r.vin || "No Agreement #"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Expires {formatDistanceToNowStrict(new Date(r.registrationEndDate), { addSuffix: true })}
                    </p>
                  </div>
                  {r.amount > 0 && (
                    <span className="text-xs font-bold text-amber-500">${r.amount.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
      <FleetFormModal />
    </>
  );
}
