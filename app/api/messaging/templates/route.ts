import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import MessagingTemplate from "@/lib/models/MessagingTemplate";

// GET — fetch all templates, a specific one by ?type=, or batch by ?types=a,b,c
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const types = searchParams.get("types"); // comma-separated batch

    // Single type
    if (type) {
      const template = await MessagingTemplate.findOne({ type }).lean();
      return NextResponse.json({ template });
    }

    // Batch types (e.g. ?types=shift,future-shift,off-tomorrow)
    if (types) {
      const typeList = types.split(",").map(t => t.trim()).filter(Boolean);
      const templates = await MessagingTemplate.find({ type: { $in: typeList } }).lean();
      const templateMap: Record<string, any> = {};
      templates.forEach((t: any) => { templateMap[t.type] = t; });
      return NextResponse.json({ templates: templateMap });
    }

    // All templates
    const templates = await MessagingTemplate.find({}).lean();
    return NextResponse.json({ templates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// PUT — upsert a template for a given type
export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { type, template } = body;

    if (!type || !template) {
      return NextResponse.json(
        { error: "type and template are required" },
        { status: 400 }
      );
    }

    const result = await MessagingTemplate.findOneAndUpdate(
      { type },
      { type, template },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return NextResponse.json({ template: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save template" },
      { status: 500 }
    );
  }
}
