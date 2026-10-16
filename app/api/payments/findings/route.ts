import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import PaymentFinding from "@/lib/models/PaymentFinding";

// GET ?status=open — possible billing issues across all invoices. Super Admin only.
export async function GET(req: NextRequest) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const status = new URL(req.url).searchParams.get("status") || "open";
        const rows = await PaymentFinding.find({ ...S, ...(status === "all" ? {} : { status }) }).sort({ amount: -1 }).limit(500).lean() as any[];
        return NextResponse.json({ rows: rows.map((f) => ({ ...f, _id: String(f._id), siteId: String(f.siteId) })) });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}

// PATCH { id, status: open|dismissed|resolved, note? }
export async function PATCH(req: NextRequest) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const b = await req.json();
        if (!["open", "dismissed", "resolved"].includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
        await PaymentFinding.updateOne({ ...S, _id: b.id }, { $set: { status: b.status, note: String(b.note || "").slice(0, 1000), resolvedBy: auth.session.email || "super-admin", resolvedAt: new Date() } });
        return NextResponse.json({ ok: true });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
