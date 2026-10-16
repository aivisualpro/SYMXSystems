import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import PaymentInvoice from "@/lib/models/PaymentInvoice";
import PaymentFinding from "@/lib/models/PaymentFinding";

// GET ?type=&status=&days= — invoice list. Super Admin only.
export async function GET(req: NextRequest) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const sp = new URL(req.url).searchParams;
        const days = Math.min(400, Math.max(7, parseInt(sp.get("days") || "120", 10) || 120));
        const since = new Date(Date.now() - days * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
        const q: any = { ...S, invoiceDate: { $gte: since } };
        if (sp.get("type")) q.type = sp.get("type");
        if (sp.get("status") === "pending") { q.approvalStatus = "PENDING_DSP_ACTION"; q.disputeWindowStatus = "OPEN"; }
        else if (sp.get("status")) q.myStatus = sp.get("status");
        const rows = await PaymentInvoice.find(q, { tables: 0 }).sort({ invoiceDate: -1, stationCode: 1 }).limit(500).lean() as any[];
        const finds = await PaymentFinding.find({ ...S, status: "open", batchId: { $in: rows.map((r) => r.batchId) } }, { batchId: 1, amount: 1, direction: 1 }).lean() as any[];
        const fb = new Map<string, { n: number; amt: number }>();
        finds.forEach((f) => { const c = fb.get(f.batchId) || { n: 0, amt: 0 }; c.n++; if (f.direction === "under") c.amt += f.amount || 0; fb.set(f.batchId, c); });
        const now = Date.now();
        return NextResponse.json({
            rows: rows.map((r) => ({
                id: String(r._id), batchId: r.batchId, number: r.invoiceNumber, station: r.stationCode, type: r.type, flow: r.flow, label: r.label,
                periodStart: r.periodStart, periodEnd: r.periodEnd, invoiceDate: r.invoiceDate, paymentDate: r.paymentDate, amount: r.amount,
                amazonStatus: r.amazonStatus, approvalStatus: r.approvalStatus, windowOpen: r.disputeWindowStatus === "OPEN",
                hoursLeft: r.disputeDueAt && r.disputeWindowStatus === "OPEN" ? Math.round((new Date(r.disputeDueAt).getTime() - now) / 36e5) : null,
                myStatus: r.myStatus, hasDetail: r.hasDetail, disputesFiled: r.disputesFiled || 0,
                findings: fb.get(r.batchId)?.n || 0, atStake: Math.round((fb.get(r.batchId)?.amt || 0) * 100) / 100,
            })),
        });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
