import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import connectToDatabase from "@/lib/db";
import SymxPublicUploadLog from "@/lib/models/SymxPublicUploadLog";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour — matches SymxPublicUploadLog's TTL
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * PUBLIC endpoint — no auth required. The only unauthenticated upload path
 * in the app (see app/api/admin/upload/route.ts for the session-gated
 * general-purpose one). Exists solely so a driver with no login can attach
 * receipt photos to a reimbursement request from app/submit-reimbursement.
 * Deliberately narrower than the admin uploader: image/PDF only, smaller
 * size cap, and IP-based rate limiting backed by SymxPublicUploadLog (a
 * self-expiring collection — see that model for why a TTL index instead of
 * manual cleanup).
 */
export async function POST(req: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Missing Cloudinary credentials");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    await connectToDatabase();
    const ip = getClientIp(req);

    if (ip !== "unknown") {
      const recentCount = await SymxPublicUploadLog.countDocuments({
        ip,
        purpose: "reimbursement-receipt",
        createdAt: { $gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      });
      if (recentCount >= RATE_LIMIT_MAX) {
        return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only image or PDF receipts are accepted" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "symx-systems/reimbursements-public", resource_type: file.type === "application/pdf" ? "raw" : "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(buffer);
    });

    if (ip !== "unknown") {
      await SymxPublicUploadLog.create({ ip, purpose: "reimbursement-receipt" });
    }

    return NextResponse.json({ secure_url: result.secure_url });
  } catch (error: any) {
    console.error("[PUBLIC_REIMBURSEMENT_UPLOAD]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
