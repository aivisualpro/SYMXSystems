/**
 * POST /api/mobile/upload   (multipart/form-data, field "file")
 *
 * Photo upload for the driver app (inspection photos, end-of-day photos).
 * The driver app authenticates with a badge-token JWT, NOT the office web
 * session cookie — which is what /api/admin/upload requires, and why photos
 * silently failed to save from the app.
 *
 * Images only, 15 MB max. Returns Cloudinary's JSON (use `secure_url`).
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60;

const key = new TextEncoder().encode(process.env.JWT_SECRET || "symx_systems_secret_key");
const MAX_BYTES = 15 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-badge-token");
  if (!token) return NextResponse.json({ error: "Missing x-badge-token header" }, { status: 401, headers: corsHeaders });
  let payload: any;
  try {
    payload = (await jwtVerify(token, key, { algorithms: ["HS256"] })).payload;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
  }
  const transporterId = String(payload.transporterId || "").trim().toUpperCase();
  if (!transporterId) return NextResponse.json({ error: "Invalid token payload" }, { status: 401, headers: corsHeaders });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("[mobile/upload] Missing Cloudinary credentials");
    return NextResponse.json({ error: "Photo storage isn't configured on the server" }, { status: 500, headers: corsHeaders });
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400, headers: corsHeaders });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (15MB max)" }, { status: 400, headers: corsHeaders });
    const name = (file.name || "").toLowerCase();
    // Camera photos sometimes arrive with a generic type; trust the extension too.
    const looksImage = (file.type || "").startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/.test(name);
    if (!looksImage) return NextResponse.json({ error: "Only photos can be uploaded" }, { status: 400, headers: corsHeaders });

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = new URL(req.url).searchParams.get("folder") === "end-of-day" ? "symx-systems/end-of-day" : "symx-systems/inspections";
    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder, resource_type: "image" }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(buffer);
    });
    return NextResponse.json({ secure_url: result.secure_url, public_id: result.public_id }, { headers: corsHeaders });
  } catch (e: any) {
    console.error("[mobile/upload]", e);
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500, headers: corsHeaders });
  }
}
