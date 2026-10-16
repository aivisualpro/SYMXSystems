import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import PaymentInvoice from "@/lib/models/PaymentInvoice";
import PaymentFinding from "@/lib/models/PaymentFinding";
import { auditInvoice, parseVariable } from "@/lib/payments-audit";

/**
 * Chrome extension -> SYMX. Receives invoices read from the Amazon Payments portal
 * (list row + optional detail), upserts them, then re-runs the audit on any invoice
 * that has detail. Workflow fields (status, checklist, notes) are never overwritten.
 * The data is only ever READ from Amazon; nothing is accepted or disputed there.
 */
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
};
const KEY = process.env.CORTEX_SYNC_KEY || "symx-ext-route-sync-2026";

const money = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const d8 = (s: any) => { const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
const isoDay = (ms: any) => { const n = Number(ms); return n > 0 ? new Date(n).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) : ""; };

export async function POST(req: NextRequest) {
    if (req.headers.get("x-extension-key") !== KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    const body = await req.json().catch(() => null);
    const items: any[] = Array.isArray(body?.invoices) ? body.invoices : [];
    if (!items.length) return NextResponse.json({ ok: true, saved: 0 }, { headers: CORS });

    try {
        await connectToDatabase();
        const sites = await Site.find({}, { _id: 1, code: 1 }).lean() as any[];
        const siteByCode = new Map(sites.map((s) => [String(s.code).toUpperCase(), s._id]));
        let saved = 0, audited = 0, skipped = 0;

        for (const it of items) {
            const row = it.list || {};
            const batchId = String(row.batchId || it.batchId || "");
            const code = String(row.serviceArea || "").toUpperCase();
            const siteId = siteByCode.get(code);
            if (!batchId || !siteId) { skipped++; continue; }
            const p = row.batchPropertiesMap || {};
            const batch = it.batch || {};
            const bp = batch.batchPropertiesMap || p;
            const start = d8(bp.SERVICE_PERIOD_START_DATE_V2 || bp.SERVICE_PERIOD_START_DATE);
            const end = d8(bp.SERVICE_PERIOD_END_DATE_V2 || bp.SERVICE_PERIOD_END_DATE);
            const label = bp.INVOICE_WEEK && row.invoiceType !== "VEHICLE_PAYMENT_V2" ? `Week ${bp.INVOICE_WEEK}` : (bp.INVOICE_MONTH || "");
            const dueMs = batch.disputeWindowDetails?.disputeWindowEndTimeInMillis || row.disputeDueDateInEpochMillis;
            const hasDetail = Array.isArray(it.tables) && it.tables.length > 0;

            const set: any = {
                invoiceNumber: row.amzlUniqueId || batch.finalInvoiceNumber || "",
                stationCode: code,
                type: row.invoiceType || batch.batchType || "",
                flow: row.invoiceDraftingFlow || batch.batchDraftingFlow || "ORIGINAL",
                label,
                periodStart: start, periodEnd: end,
                invoiceDate: d8(bp.INVOICE_DATE) || isoDay(row.invoiceDateInEpochMillis),
                paymentDate: isoDay(batch.paymentDate),
                amount: money(row.amount),
                amazonStatus: row.status || batch.status || "",
                approvalStatus: row.approvalStatus || batch.approvalStatus || "",
                disputeWindowStatus: row.disputeWindowStatus || batch.disputeWindowDetails?.disputeWindowStatus || "",
                disputeDueAt: dueMs ? new Date(Number(dueMs)) : undefined,
                lastSyncedAt: new Date(),
            };
            if (hasDetail) {
                set.tables = it.tables;
                set.hasDetail = true;
                if (set.type === "SERVICE_PROVIDED") set.routeCount = parseVariable({ tables: it.tables, periodStart: start }).days.reduce((a: number, d: any) => a + d.count, 0);
                set.disputesFiled = (it.disputes?.disputes || []).length + (it.disputes?.oldDisputes || []).length;
                set.adjustmentAmount = money(it.adjustments?.sumOfAdjustmentAmounts);
            }

            const doc = await PaymentInvoice.findOneAndUpdate(
                { siteId, batchId },
                { $set: set, $setOnInsert: { myStatus: row.approvalStatus === "APPROVED" ? "accepted" : "to_review" } },
                { upsert: true, new: true }
            ).lean() as any;
            saved++;

            if (doc.hasDetail) {
                const { findings, coverage } = await auditInvoice(doc);
                await PaymentInvoice.updateOne({ _id: doc._id }, { $set: { coverage } });
                const existing = await PaymentFinding.find({ siteId, batchId }, { key: 1, status: 1 }).lean() as any[];
                const keep = new Set(existing.filter((e) => e.status !== "open").map((e) => e.key));
                const fresh = new Set(findings.map((f) => f.key));
                // drop open findings that no longer apply (the data was corrected)
                await PaymentFinding.deleteMany({ siteId, batchId, status: "open", key: { $nin: [...fresh] } });
                for (const f of findings) {
                    if (keep.has(f.key)) continue; // owner already decided on this one
                    await PaymentFinding.updateOne(
                        { siteId, key: f.key },
                        { $set: { ...f, batchId, invoiceNumber: doc.invoiceNumber, stationCode: code }, $setOnInsert: { status: "open" } },
                        { upsert: true }
                    );
                }
                audited++;
            }
        }
        return NextResponse.json({ ok: true, saved, audited, skipped }, { headers: CORS });
    } catch (e: any) {
        console.error("[payments-sync]", e);
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500, headers: CORS });
    }
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }); }
