import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import PaymentInvoice from "@/lib/models/PaymentInvoice";
import PaymentFinding from "@/lib/models/PaymentFinding";
import PaymentDispute from "@/lib/models/PaymentDispute";
import Vehicle from "@/lib/models/Vehicle";
import { parseVariable } from "@/lib/payments-audit";

// GET — one invoice with parsed lines, findings and disputes. Super Admin only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        const { id } = await params;
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const inv = await PaymentInvoice.findOne({ ...S, _id: id }).lean() as any;
        if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const findings = await PaymentFinding.find({ ...S, batchId: inv.batchId }).sort({ date: 1 }).lean() as any[];
        const disputes = await PaymentDispute.find({ ...S, batchId: inv.batchId }).sort({ filedAt: -1 }).lean() as any[];
        const vehicles = inv.type === "VEHICLE_PAYMENT_V2" ? await Vehicle.countDocuments({ currentSiteId: inv.siteId, status: "Active" }) : null;
        return NextResponse.json({
            invoice: { ...inv, _id: String(inv._id), siteId: String(inv.siteId), hoursLeft: inv.disputeDueAt && inv.disputeWindowStatus === "OPEN" ? Math.round((new Date(inv.disputeDueAt).getTime() - Date.now()) / 36e5) : null },
            parsed: inv.type === "SERVICE_PROVIDED" && inv.hasDetail ? parseVariable(inv) : null,
            findings: findings.map((f) => ({ ...f, _id: String(f._id) })),
            disputes: disputes.map((d) => ({ ...d, _id: String(d._id) })),
            activeVehicles: vehicles,
        });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}

// PATCH { myStatus?, checklist?, notes? } — the owner's review workflow (does NOT touch Amazon).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireSuperAdminApi();
    if ("response" in auth) return auth.response;
    try {
        const { id } = await params;
        await connectToDatabase();
        const S = siteFilter(await getRequestScope());
        const b = await req.json();
        const set: any = {};
        if (["to_review", "reviewing", "ready_to_accept", "disputed", "accepted"].includes(b.myStatus)) { set.myStatus = b.myStatus; set.reviewedBy = auth.session.email || auth.session.name || "super-admin"; set.reviewedAt = new Date(); }
        if (b.checklist && typeof b.checklist === "object") for (const k of ["wst", "routes", "upd", "rescues", "packages", "passThrough"]) if (k in b.checklist) set[`checklist.${k}`] = !!b.checklist[k];
        if (typeof b.notes === "string") set.notes = b.notes.slice(0, 4000);
        const r = await PaymentInvoice.updateOne({ ...S, _id: id }, { $set: set });
        return NextResponse.json({ ok: r.matchedCount > 0 });
    } catch (e: any) { return NextResponse.json({ error: e.message || "Failed" }, { status: 500 }); }
}
