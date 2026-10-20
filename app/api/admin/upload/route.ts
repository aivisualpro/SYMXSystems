import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { jwtVerify } from "jose";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const badgeKey = new TextEncoder().encode(process.env.JWT_SECRET || "symx_systems_secret_key");

/** Driver app (badge-token) callers: older app builds upload photos here. */
async function isDriverToken(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-badge-token");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, badgeKey, { algorithms: ["HS256"] });
    return !!String((payload as any).transporterId || "").trim();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let driverOnly = false;
  try {
    const session = await getSession();
    if (!session) {
      // Not an office user — allow a signed-in driver app, restricted to photos below.
      if (await isDriverToken(req)) driverOnly = true;
      else return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (e: any) {
    if (await isDriverToken(req)) driverOnly = true;
    else return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Verify credentials present
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.error("Missing Cloudinary credentials");
    return NextResponse.json(
      { error: "Server configuration error: Missing Cloudinary credentials" },
      { status: 500 }
    );
  }

  try {
    // 2. Parse Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (20MB max)" }, { status: 400 });
    }

    // 3. Convert file to buffer for stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine folder from query param or default
    const { searchParams } = new URL(req.url);
    let folder = searchParams.get("folder") || "symx-systems/products";
    if (driverOnly) {
      // Driver tokens may only upload photos, always into the inspections folder.
      if (!/\.(jpe?g|png|heic|heif|webp)$/.test(file.name.toLowerCase()) && !(file.type || "").startsWith("image/")) {
        return NextResponse.json({ error: "Only photos can be uploaded" }, { status: 400 });
      }
      folder = "symx-systems/inspections";
    }

    // Determine resource_type based on file extension
    // PDFs, docs, etc. must use "raw" to be accessible via direct URL
    const fileName = file.name.toLowerCase();
    const isRawFile = /\.(pdf|doc|docx|xls|xlsx|csv|txt|rtf|ppt|pptx)$/.test(fileName);
    const resourceType = isRawFile ? "raw" : "auto";

    // 4. Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType as any,
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary Stream Error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed due to server error" },
      { status: 500 }
    );
  }
}
