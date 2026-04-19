import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isBase64(str: string): boolean {
    return str.startsWith("data:image/");
}

async function uploadBase64ToCloudinary(base64: string, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            base64,
            { folder, resource_type: "auto" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result!.secure_url);
            }
        );
    });
}

// POST — migrate base64 images in SymxUser to Cloudinary
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

        // Find users with base64 profilePicture or signature
        const users = await SymxUser.find({
            $or: [
                { profilePicture: { $regex: "^data:image/" } },
                { signature: { $regex: "^data:image/" } },
            ],
        }).lean();

        let migrated = 0;
        let errors = 0;

        for (const user of users as any[]) {
            const updates: any = {};

            try {
                if (user.profilePicture && isBase64(user.profilePicture)) {
                    const url = await uploadBase64ToCloudinary(user.profilePicture, "symx-systems/users/profile");
                    updates.profilePicture = url;
                }
                if (user.signature && isBase64(user.signature)) {
                    const url = await uploadBase64ToCloudinary(user.signature, "symx-systems/users/signature");
                    updates.signature = url;
                }

                if (Object.keys(updates).length > 0) {
                    await SymxUser.updateOne({ _id: user._id }, { $set: updates });
                    migrated++;
                }
            } catch (err) {
                console.error(`Failed to migrate user ${user._id}:`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            total: users.length,
            migrated,
            errors,
            message: `Migrated ${migrated} users from base64 to Cloudinary${errors > 0 ? `, ${errors} errors` : ""}`,
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
