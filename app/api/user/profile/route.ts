import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

// GET: Fetch logged-in user's full profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Super Admin bypass — try to find a real user by email first,
    // otherwise return session-based profile data
    if (session.id === "super-admin") {
      if (session.email) {
        const realUser = await SymxUser.findOne({ email: session.email }).select("-password").lean();
        if (realUser) {
          return NextResponse.json({ ...realUser, AppRole: "Super Admin" });
        }
      }

      return NextResponse.json({
        _id: "super-admin",
        name: session.name || "Super Admin",
        email: session.email || "",
        AppRole: "Super Admin",
        designation: "System Administrator",
        bioDescription: "",
        phone: "",
        address: "",
        location: "",
        profilePicture: "",
        isActive: true,
        serialNo: "",
        signature: "",
        isOnWebsite: false,
        createdAt: new Date().toISOString(),
      });
    }

    const user = await SymxUser.findById(session.id).select("-password").lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT: Update logged-in user's profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const body = await req.json();

    // Only allow updating specific fields (prevent role/status escalation)
    const allowedFields = ["name", "phone", "address", "designation", "bioDescription", "location", "profilePicture", "signature"];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // For super-admin, try to find user by email
    let userId = session.id;
    if (session.id === "super-admin" && session.email) {
      const realUser = await SymxUser.findOne({ email: session.email }).select("_id").lean();
      if (realUser) {
        userId = (realUser as any)._id;
      } else {
        return NextResponse.json({ error: "Super Admin profile cannot be updated via this endpoint" }, { status: 403 });
      }
    }

    const updatedUser = await SymxUser.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password").lean();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
