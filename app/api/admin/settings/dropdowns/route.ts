import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import DropdownOption from "@/lib/models/DropdownOption";

// GET — list dropdown options, optionally filter by ?type=
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Admin", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");

        const filter: any = {};
        if (type) filter.type = type;

        const options = await DropdownOption.find(filter).sort({ sortOrder: 1, description: 1 }).lean();
        return NextResponse.json(options);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update a dropdown option
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Admin", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const body = await req.json();
        const { _id, description, type, isActive, sortOrder, image, color, icon } = body;

        if (!description?.trim()) {
            return NextResponse.json({ error: "Description is required" }, { status: 400 });
        }
        if (!type?.trim()) {
            return NextResponse.json({ error: "Type is required" }, { status: 400 });
        }

        if (_id) {
            const updated = await DropdownOption.findByIdAndUpdate(
                _id,
                {
                    description: description.trim(),
                    type: type.trim().toLowerCase(),
                    isActive: isActive ?? true,
                    sortOrder: sortOrder ?? 0,
                    image: image ?? '',
                    color: color ?? '',
                    icon: icon ?? ''
                },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Option not found" }, { status: 404 });
            return NextResponse.json(updated);
        } else {
            const option = await DropdownOption.create({
                description: description.trim(),
                type: type.trim().toLowerCase(),
                isActive: isActive ?? true,
                sortOrder: sortOrder ?? 0,
                image: image ?? '',
                color: color ?? '',
                icon: icon ?? ''
            });
            return NextResponse.json(option.toJSON());
        }
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: "This option already exists for the given type" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a dropdown option
export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("Admin", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await DropdownOption.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
