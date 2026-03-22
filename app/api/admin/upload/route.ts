import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
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

    // 3. Convert file to buffer for stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine folder from query param or default
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || "symx-systems/products";

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
