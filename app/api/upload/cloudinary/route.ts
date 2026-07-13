import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Which modules are allowed to use this shared upload endpoint, and what
// action + Cloudinary folder each maps to. Callers pass a `module` field in
// the FormData; anything not in this list is rejected.
// Note: the legacy "Dispatching" / coaching-writeups target was removed
// when that feature was retired in favor of the Write-Ups module.
const UPLOAD_TARGETS: Record<string, { action: "view" | "create" | "edit" | "delete" | "approve" | "download"; folder: string; useAuthorizeAction?: boolean }> = {
  Insurance: { action: "edit", folder: "symx-systems/insurance/loss-runs" },
  Incidents: { action: "create", folder: "symx-systems/incidents/attachments", useAuthorizeAction: true },
  "Write-Ups": { action: "edit", folder: "symx-systems/writeups/attachments" },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const moduleField = String(formData.get("module") || "");

    const target = UPLOAD_TARGETS[moduleField];
    if (!target) {
      return NextResponse.json({ error: `Unknown upload module: ${moduleField}` }, { status: 400 });
    }

    // Incidents uploads use the same default-open check as the rest of the
    // Incidents module (any logged-in user can attach a photo to a report
    // they're creating); everything else stays on the stricter, default-
    // closed permission check.
    if (target.useAuthorizeAction) {
      const auth = await authorizeAction("Incidents", target.action);
      if (!auth.authorized) return auth.response;
    } else {
      try {
        await requirePermission(moduleField, target.action);
      } catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const url: string = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: target.folder,
            resource_type: "auto",
            public_id: `attachment-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`,
          },
          (error, result) => {
            if (error) { reject(error); return; }
            // Direct Cloudinary CDN URL — no proxy needed
            resolve(result!.secure_url);
          }
        )
        .end(buffer);
    });

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
