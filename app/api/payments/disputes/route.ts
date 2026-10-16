import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import PaymentDispute from "@/lib/models/PaymentDispute";
import PaymentInvoice from "@/lib/models/PaymentInvoice";
import PaymentFinding from "@/lib/models/PaymentFinding";

// GET — disputes we have filed + outcomes. Super Admin only.
export async function GET() {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const rows = await PaymentDispute.find({ ...S }).sort({ filedAt: -1 }).limit(300).lean() as any[];
        return NextResponse.json({ rows: rows.map((d) => ({ ...d, _id: String(d._id), siteId: String(d.siteId) })) });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}

// POST { invoiceId, category, reason, amountClaimed, findingKeys?, notes? } — log a dispute you filed in Amazon's portal.
export async function POST(req: NextRequest) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const S = siteFilter(scope);
        const b = await req.json();
        const inv = await PaymentInvoice.findOne({ ...S, _id: b.invoiceId }).lean() as any;
        if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        const doc = await PaymentDispute.create({
            siteId: inv.siteId, batchId: inv.batchId, invoiceNumber: inv.invoiceNumber, stationCode: inv.stationCode, invoiceLabel: `${inv.label} · ${inv.type}`,
            category: b.category || "other", reason: String(b.reason || "").slice(0, 2000), amountClaimed: Number(b.amountClaimed) || 0,
            notes: String(b.notes || "").slice(0, 2000), findingKeys: Array.isArray(b.findingKeys) ? b.findingKeys : [], createdBy: auth.session.email || "super-admin",
        });
        await PaymentInvoice.updateOne({ _id: inv._id }, { $set: { myStatus: "disputed" } });
        if (Array.isArray(b.findingKeys) && b.findingKeys.length) await PaymentFinding.updateMany({ siteId: inv.siteId, key: { $in: b.findingKeys } }, { $set: { status: "disputed" } });
        return NextResponse.json({ ok: true, id: String(doc._id) });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}

// PATCH { id, status: filed|won|partial|lost, amountRecovered?, notes? }
export async function PATCH(req: NextRequest) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const b = await req.json();
        if (!["filed", "won", "partial", "lost"].includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
        await PaymentDispute.updateOne({ ...S, _id: b.id }, { $set: { status: b.status, amountRecovered: Number(b.amountRecovered) || 0, notes: String(b.notes || "").slice(0, 2000), resolvedAt: b.status === "filed" ? undefined : new Date() } });
        return NextResponse.json({ ok: true });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
