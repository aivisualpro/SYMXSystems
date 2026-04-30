import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEveryday from "@/lib/models/SymxEveryday";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/dispatching/routes-info/import-pdf
 *
 * Accepts:
 *   - FormData with "file" (PDF) and "date" and "pages" (JSON string of parsed page data)
 *
 * 1. Uploads the PDF to Cloudinary
 * 2. Saves the Cloudinary URL to SYMXEveryday.SYMXRouteSheet
 * 3. Bulk-updates SYMXRoutesInfo records matching routeNumber + date
 */
export async function POST(req: NextRequest) {
    try {
        await requirePermission("Dispatching", "edit");
    } catch (e: any) {
        if (e.name === "ForbiddenError") {
            return NextResponse.json({ error: e.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const date = formData.get("date") as string | null;
        const pagesJson = formData.get("pages") as string | null;

        if (!date || !pagesJson) {
            return NextResponse.json({ error: "date and pages are required" }, { status: 400 });
        }

        const pages = JSON.parse(pagesJson);
        if (!Array.isArray(pages) || pages.length === 0) {
            return NextResponse.json({ error: "pages[] must be a non-empty array" }, { status: 400 });
        }

        await connectToDatabase();
        const dateObj = new Date(date);

        // ── 1. Upload PDF to Cloudinary ──
        let cloudinaryUrl = "";
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const uploadResult: any = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: "symx-systems/route-sheets",
                        resource_type: "raw",
                        public_id: `route-sheet-${date}`,
                        overwrite: true,
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(buffer);
            });

            cloudinaryUrl = uploadResult.secure_url || uploadResult.url || "";

            // ── 2. Save URL + parsed data to SYMXEveryday ──
            if (cloudinaryUrl) {
                await SymxEveryday.findOneAndUpdate(
                    { date },
                    { $set: { SYMXRouteSheet: cloudinaryUrl, SYMXRouteSheetData: pages } },
                    { upsert: true, new: true }
                );
            }
        } else {
            // No file (refetch scenario) — still save the pages data
            await SymxEveryday.findOneAndUpdate(
                { date },
                { $set: { SYMXRouteSheetData: pages } },
                { upsert: true, new: true }
            );
        }

        // ── 3. Bulk-update RoutesInfo records ──
        const existingRows = await SYMXRoutesInfo.find({ date: dateObj }).lean() as any[];

        const routeMap = new Map<string, any>();
        existingRows.forEach(row => {
            const rn = (row.routeNumber || "").trim().toUpperCase();
            if (rn) routeMap.set(rn, row);
        });

        let matched = 0;
        let skipped = 0;
        const matchedRoutes: string[] = [];
        const skippedRoutes: string[] = [];

        const infoOps: any[] = [];
        const routeOps: any[] = [];

        for (const page of pages) {
            const routeNumber = (page.routeNumber || "").trim().toUpperCase();
            if (!routeNumber) { skipped++; continue; }

            const existingRow = routeMap.get(routeNumber);
            if (!existingRow) {
                skipped++;
                skippedRoutes.push(routeNumber);
                continue;
            }

            const setFields: Record<string, any> = {};
            if (page.stagingLocation !== undefined) setFields.stagingLocation = page.stagingLocation;
            if (page.bags !== undefined) setFields.bags = String(page.bags);
            if (page.ov !== undefined) setFields.ov = String(page.ov);
            if (page.commercialPackages !== undefined) setFields.commercialPackages = String(page.commercialPackages);

            if (Object.keys(setFields).length === 0) { skipped++; continue; }

            infoOps.push({
                updateOne: {
                    filter: { _id: existingRow._id },
                    update: { $set: setFields },
                },
            });

            if (existingRow.transporterId && existingRow.transporterId.trim() !== "") {
                const routeSetFields: Record<string, any> = {};
                if (setFields.stagingLocation !== undefined) routeSetFields.stagingLocation = setFields.stagingLocation;
                if (setFields.bags !== undefined) routeSetFields.bags = setFields.bags;
                if (setFields.ov !== undefined) routeSetFields.ov = setFields.ov;

                if (Object.keys(routeSetFields).length > 0) {
                    routeOps.push({
                        updateOne: {
                            filter: { transporterId: existingRow.transporterId, date: dateObj },
                            update: { $set: routeSetFields },
                        },
                    });
                }
            }

            matched++;
            matchedRoutes.push(routeNumber);
        }

        if (infoOps.length > 0) {
            await SYMXRoutesInfo.bulkWrite(infoOps, { ordered: false });
        }
        if (routeOps.length > 0) {
            try {
                await SYMXRoute.bulkWrite(routeOps, { ordered: false });
            } catch (e) {
                console.error("[import-pdf] Error syncing to SYMXRoutes:", e);
            }
        }

        console.log(`[import-pdf] Processed ${pages.length} pages: ${matched} matched, ${skipped} skipped. PDF URL: ${cloudinaryUrl || "none"}`);

        return NextResponse.json({
            ok: true,
            totalPages: pages.length,
            matched,
            skipped,
            matchedRoutes,
            skippedRoutes,
            cloudinaryUrl,
        });
    } catch (error: any) {
        console.error("Error importing PDF data:", error);
        return NextResponse.json({ error: error.message || "Failed to import PDF" }, { status: 500 });
    }
}
