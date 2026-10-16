import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import PaymentInvoice from "@/lib/models/PaymentInvoice";
import PaymentFinding from "@/lib/models/PaymentFinding";
import PaymentDispute from "@/lib/models/PaymentDispute";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// GET — owner / CFO dashboard numbers. Super Admin only.
export async function GET() {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const t = today();
        const month = t.slice(0, 7);
        const invoices = await PaymentInvoice.find({ ...S }, { tables: 0 }).sort({ invoiceDate: -1 }).limit(600).lean() as any[];
        const findings = await PaymentFinding.find({ ...S, status: "open" }).lean() as any[];
        const disputes = await PaymentDispute.find({ ...S }).lean() as any[];

        const findByBatch = new Map<string, { n: number; amt: number }>();
        findings.forEach((f) => { const c = findByBatch.get(f.batchId) || { n: 0, amt: 0 }; c.n++; if (f.direction === "under") c.amt += f.amount || 0; findByBatch.set(f.batchId, c); });

        const now = Date.now();
        const pending = invoices
            .filter((i) => i.approvalStatus === "PENDING_DSP_ACTION" && i.disputeWindowStatus === "OPEN" && !["accepted"].includes(i.myStatus))
            .map((i) => ({
                id: String(i._id), batchId: i.batchId, number: i.invoiceNumber, station: i.stationCode, type: i.type, label: i.label, amount: i.amount,
                dueAt: i.disputeDueAt, hoursLeft: i.disputeDueAt ? Math.round((new Date(i.disputeDueAt).getTime() - now) / 36e5) : null,
                myStatus: i.myStatus, hasDetail: i.hasDetail, findings: findByBatch.get(i.batchId)?.n || 0, atStake: findByBatch.get(i.batchId)?.amt || 0,
            }))
            .sort((a, b) => (a.hoursLeft ?? 9e9) - (b.hoursLeft ?? 9e9));

        const mtd = invoices.filter((i) => (i.invoiceDate || "").startsWith(month));
        const sum = (arr: any[]) => Math.round(arr.reduce((a, i) => a + (i.amount || 0), 0) * 100) / 100;
        const byType: Record<string, number> = {}; mtd.forEach((i) => { byType[i.type] = (byType[i.type] || 0) + (i.amount || 0); });
        const byStation: Record<string, number> = {}; mtd.forEach((i) => { byStation[i.stationCode] = (byStation[i.stationCode] || 0) + (i.amount || 0); });

        // weekly variable revenue trend (last 10 weeks) per station, with $ per route
        const weeks = new Map<string, { label: string; end: string; stations: Record<string, { amount: number; routes: number }> }>();
        invoices.filter((i) => i.type === "SERVICE_PROVIDED" && i.periodEnd).forEach((i) => {
            const w = weeks.get(i.periodEnd) || weeks.set(i.periodEnd, { label: i.label, end: i.periodEnd, stations: {} }).get(i.periodEnd)!;
            const s = w.stations[i.stationCode] || (w.stations[i.stationCode] = { amount: 0, routes: 0 });
            s.amount += i.amount || 0; s.routes += i.routeCount || 0;
        });
        const trend = [...weeks.values()].sort((a, b) => (a.end < b.end ? 1 : -1)).slice(0, 10).reverse();

        // cash: what's coming in, what just landed
        const upcoming = invoices.filter((i) => i.paymentDate && i.paymentDate >= t && i.amazonStatus !== "PAID_V2");
        const cashByDate: Record<string, number> = {}; upcoming.forEach((i) => { cashByDate[i.paymentDate] = (cashByDate[i.paymentDate] || 0) + (i.amount || 0); });
        const in14 = upcoming.filter((i) => i.paymentDate <= new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
        const paidRecent = invoices.filter((i) => i.amazonStatus === "PAID_V2" && i.paymentDate && i.paymentDate >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10));

        const filed = disputes.filter((d) => d.status === "filed");
        const closed = disputes.filter((d) => d.status !== "filed");
        const recovered = disputes.reduce((a, d) => a + (d.amountRecovered || 0), 0);

        const lastSync = invoices.reduce((m: any, i) => (!m || (i.lastSyncedAt && new Date(i.lastSyncedAt) > m) ? i.lastSyncedAt : m), null);
        return NextResponse.json({
            today: t, lastSync, hasData: invoices.length > 0,
            kpi: {
                pendingCount: pending.length, pendingAmount: sum(pending as any),
                soonestHours: pending.length ? pending[0].hoursLeft : null,
                billedMtd: sum(mtd), mtdCount: mtd.length,
                atStake: Math.round(findings.filter((f) => f.direction === "under").reduce((a, f) => a + (f.amount || 0), 0) * 100) / 100,
                openFindings: findings.length,
                cash14: sum(in14), cash14Count: in14.length,
                disputedOutstanding: Math.round(filed.reduce((a, d) => a + (d.amountClaimed || 0), 0) * 100) / 100, disputesOpen: filed.length,
                recovered: Math.round(recovered * 100) / 100,
                winRate: closed.length ? Math.round((closed.filter((d) => d.status === "won" || d.status === "partial").length / closed.length) * 100) : null,
            },
            pending, byType, byStation, trend,
            cash: { byDate: Object.entries(cashByDate).sort().map(([date, amount]) => ({ date, amount })), paidRecent: sum(paidRecent), paidRecentCount: paidRecent.length },
            topFindings: findings.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 6).map((f) => ({ id: String(f._id), title: f.title, station: f.stationCode, date: f.date, amount: f.amount, direction: f.direction, severity: f.severity, batchId: f.batchId, invoiceNumber: f.invoiceNumber })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
