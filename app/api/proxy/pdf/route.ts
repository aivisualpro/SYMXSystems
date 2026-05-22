import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid");
  const resourceType = req.nextUrl.searchParams.get("rt") || "image";
  if (!pid) return new NextResponse("Missing public_id", { status: 400 });

  try {
    // generate_archive is the ONLY Cloudinary API that bypasses strict CDN access control
    const archiveUrl = (cloudinary.utils as any).download_zip_url({
      public_ids: [pid],
      resource_type: resourceType,
      flatten_folders: true,
    });

    const res = await fetch(archiveUrl);
    if (!res.ok) {
      return new NextResponse(`Cloudinary error: ${res.status}`, { status: res.status });
    }

    const zipBuffer = Buffer.from(await res.arrayBuffer());

    // Extract the single file from the zip using macOS unzip
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cld-proxy-"));
    const zipPath = path.join(tmpDir, "archive.zip");
    fs.writeFileSync(zipPath, zipBuffer);

    try {
      execSync(`unzip -o "${zipPath}" -d "${tmpDir}/out"`, { stdio: "pipe" });
    } catch {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return new NextResponse("Failed to extract", { status: 500 });
    }

    const outDir = path.join(tmpDir, "out");
    const files = fs.readdirSync(outDir).filter(f => !f.startsWith(".") && !f.startsWith("__"));
    if (files.length === 0) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return new NextResponse("No file in archive", { status: 500 });
    }

    const fileBuffer = fs.readFileSync(path.join(outDir, files[0]));
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Determine content type from the original filename
    const ext = pid.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
    };

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeMap[ext] || "application/octet-stream",
        "Content-Disposition": `inline; filename="${pid.split("/").pop()}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("Proxy error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
