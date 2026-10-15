import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope, siteFilter, resolveWriteSiteId } from "@/lib/scoped-query";
import Site from "@/lib/models/Site";
import WavePadDefault from "@/lib/models/WavePadDefault";
import { to24h } from "@/lib/cortex-time";
import DropdownOption from "@/lib/models/DropdownOption";

async function guard(level: "view" | "edit") {
    try {
        try { await requirePermission("Admin", level); }
        catch (e1: any) {
            if (e1.name !== "ForbiddenError") throw e1;
            await requirePermission("Dispatching", level); // wave/PAD is dispatch config
        }
        return null;
    } catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

// GET — this station's wave time → default PAD list.
// Readable by anyone signed in (dispatch uses it to prefill PAD).
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await connectToDatabase();
        const scope = await getRequestScope();
        let rows = await WavePadDefault.find({ ...siteFilter(scope) }).sort({ wave: 1 }).lean();
        // First visit for a station: carry over the existing wave times + PADs.
        if (rows.length === 0 && scope.activeSiteIds.length === 1) {
            const opts = await DropdownOption.find({ type: "wave time", isActive: true }).lean() as any[];
            const ops = opts
                .map((o) => ({ wave: to24h(o.description), pad: o.defaultPad || "" }))
                .filter((o) => /^\d{2}:\d{2}$/.test(o.wave))
                .map((o) => ({ updateOne: { filter: { siteId: scope.activeSiteIds[0], wave: o.wave }, update: { $setOnInsert: { pad: o.pad, discovered: false } }, upsert: true } }));
            if (ops.length) {
                await WavePadDefault.bulkWrite(ops as any, { ordered: false });
                rows = await WavePadDefault.find({ ...siteFilter(scope) }).sort({ wave: 1 }).lean();
            }
        }
        let offset = 20;
        if (scope.activeSiteIds.length === 1) {
            const site = await Site.findById(scope.activeSiteIds[0], { waveOffsetMinutes: 1 }).lean() as any;
            if (Number.isFinite(site?.waveOffsetMinutes)) offset = site.waveOffsetMinutes;
        }
        return NextResponse.json({
            offset,
            rows: rows.map((r: any) => ({ _id: String(r._id), wave: r.wave, pad: r.pad || "", discovered: !!r.discovered, lastSeenAt: r.lastSeenAt })),
            single: scope.activeSiteIds.length === 1,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}

// POST { wave: "11:35" | "11:35 AM", pad } — create or update.
export async function POST(req: NextRequest) {
    const denied = await guard("edit");
    if (denied) return denied;
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const siteId = resolveWriteSiteId(scope);
        if (!siteId) return NextResponse.json({ error: "Select a single station first" }, { status: 400 });
        const { wave, pad } = await req.json();
        const w = to24h(String(wave || ""));
        if (!/^\d{2}:\d{2}$/.test(w)) return NextResponse.json({ error: "Enter a time like 11:35 AM" }, { status: 400 });
        const doc = await WavePadDefault.findOneAndUpdate(
            { siteId, wave: w },
            { $set: { pad: String(pad ?? "").trim(), discovered: false } },
            { upsert: true, new: true }
        ).lean() as any;
        return NextResponse.json({ ok: true, _id: String(doc._id) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
    const denied = await guard("edit");
    if (denied) return denied;
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const id = new URL(req.url).searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        await WavePadDefault.deleteOne({ _id: id, ...siteFilter(scope) });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}

// PUT { offset } — minutes subtracted from planned departure for this station.
export async function PUT(req: NextRequest) {
    const denied = await guard("edit");
    if (denied) return denied;
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const siteId = resolveWriteSiteId(scope);
        if (!siteId) return NextResponse.json({ error: "Select a single station first" }, { status: 400 });
        const { offset } = await req.json();
        const n = Math.round(Number(offset));
        if (!Number.isFinite(n) || n < 0 || n > 120) return NextResponse.json({ error: "Enter 0–120 minutes" }, { status: 400 });
        await Site.updateOne({ _id: siteId }, { $set: { waveOffsetMinutes: n } });
        return NextResponse.json({ ok: true, offset: n });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
