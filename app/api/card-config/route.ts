import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxCardConfig from "@/lib/models/SymxCardConfig";
import SymxAppModule from "@/lib/models/SymxAppModule";

// GET - Fetch card configs for a page
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page");

    if (!page) {
      return NextResponse.json({ error: "Missing 'page' parameter" }, { status: 400 });
    }

    await connectToDatabase();

    const config = await SymxCardConfig.findOne({ page });
    return NextResponse.json({ cards: config?.cards || [] });

  } catch (error) {
    console.error("Error fetching card config:", error);
    return NextResponse.json({ error: "Failed to fetch card config" }, { status: 500 });
  }
}

// PUT - Update card configs (Super Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Super Admin can update card names
    if (session.id !== "super-admin" && session.role !== "Super Admin") {
      return NextResponse.json({ error: "Forbidden: Only Super Admin can update card settings" }, { status: 403 });
    }

    const body = await req.json();
    const { page, cards } = body;

    if (!page || !cards) {
      return NextResponse.json({ error: "Missing 'page' or 'cards' in body" }, { status: 400 });
    }

    await connectToDatabase();

    // Merge strategy: fetch existing config, then merge incoming data
    // This way we don't lose image URLs when only name changes, or vice versa
    const existing = await SymxCardConfig.findOne({ page });
    const existingCards = existing?.cards || [];

    const mergedCards = cards.map((incoming: any) => {
      const prev = existingCards.find((c: any) => c.index === incoming.index);
      return {
        index: incoming.index,
        name: incoming.name ?? prev?.name ?? "",
        bgDark: incoming.bgDark !== undefined ? incoming.bgDark : (prev?.bgDark || undefined),
        bgLight: incoming.bgLight !== undefined ? incoming.bgLight : (prev?.bgLight || undefined),
      };
    });

    const config = await SymxCardConfig.findOneAndUpdate(
      { page },
      { 
        page,
        cards: mergedCards,
        updatedBy: session.name || session.id,
      },
      { upsert: true, new: true }
    );

    // ── Sync sub-module names in SymxAppModule ──────────────────────
    // When a card name changes, update the matching sub-module in the
    // parent module so that the sidebar, header title, and roles page
    // all reflect the new display name automatically.
    try {
      // Capitalise the page name to match module names (e.g. "reports" → "Reports")
      const moduleName = page.charAt(0).toUpperCase() + page.slice(1);
      const parentModule = await SymxAppModule.findOne({ name: moduleName });

      if (parentModule && parentModule.subModules?.length > 0) {
        let changed = false;

        for (const incoming of mergedCards) {
          const idx = incoming.index;
          const newName = incoming.name;

          // Match sub-module by position (card index → sub-module index)
          if (newName && idx < parentModule.subModules.length) {
            const currentSubName = (parentModule.subModules[idx] as any).name;
            if (currentSubName !== newName) {
              (parentModule.subModules[idx] as any).name = newName;
              changed = true;
            }
          }
        }

        if (changed) {
          await parentModule.save();
        }
      }
    } catch (syncErr) {
      // Non-critical — log but don't fail the card save
      console.error("Failed to sync sub-module name:", syncErr);
    }

    return NextResponse.json({ success: true, config });

  } catch (error) {
    console.error("Error updating card config:", error);
    return NextResponse.json({ error: "Failed to update card config" }, { status: 500 });
  }
}
