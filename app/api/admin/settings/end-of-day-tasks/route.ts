import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import EndOfDayTaskTemplate from "@/lib/models/EndOfDayTaskTemplate";

// GET — list all end-of-day task templates (read-only reference data, no admin guard)
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const templates = await EndOfDayTaskTemplate.find({}).sort({ sortOrder: 1, title: 1 }).lean();
        return NextResponse.json({ templates });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update a template
export async function POST(req: NextRequest) {
    try {
        await requirePermission("Admin", "edit");
    } catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectToDatabase();
        const body = await req.json();
        const { _id, title, description, requiresPhoto, isActive, sortOrder } = body;

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const fields = {
            title: title.trim(),
            description: description ?? '',
            requiresPhoto: !!requiresPhoto,
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
        };

        if (_id) {
            const updated = await EndOfDayTaskTemplate.findByIdAndUpdate(_id, fields, { new: true }).lean();
            if (!updated) return NextResponse.json({ error: "Template not found" }, { status: 404 });
            return NextResponse.json(updated);
        } else {
            const created = await EndOfDayTaskTemplate.create(fields);
            return NextResponse.json(created.toJSON());
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a template
export async function DELETE(req: NextRequest) {
    try {
        await requirePermission("Admin", "delete");
    } catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await EndOfDayTaskTemplate.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
