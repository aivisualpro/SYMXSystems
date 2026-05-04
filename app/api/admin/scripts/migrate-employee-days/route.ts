import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/scripts/migrate-employee-days
 * Resets ALL employee day fields (sunday–saturday) to null (Assign Schedule).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const db = mongoose.connection.db!;
    const employeesCol = db.collection("SYMXEmployees");

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    // Set all day fields to null for ALL employees
    const updateFields: Record<string, null> = {};
    for (const day of days) {
      updateFields[day] = null;
    }

    const result = await employeesCol.updateMany(
      {},
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      message: `Reset all 7 day fields to null (Assign Schedule) for ${result.modifiedCount} employees`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
