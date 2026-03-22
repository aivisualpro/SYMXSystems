import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxInterview from "@/lib/models/SymxInterview";

/**
 * PUBLIC endpoint — no auth required.
 * Allows external users to submit interview applications.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.fullName?.trim()) {
      return NextResponse.json(
        { error: "Full Name is required" },
        { status: 400 }
      );
    }

    const doc = await SymxInterview.create({
      fullName: body.fullName?.trim(),
      phoneNumber: body.phoneNumber?.trim(),
      workStartDate: body.workStartDate?.trim(),
      typeOfWork: body.typeOfWork?.trim(),
      workDays: body.workDays?.trim(),
      lastEmployerInfo: body.lastEmployerInfo?.trim(),
      howDidYouHear: body.howDidYouHear?.trim(),
      disclaimer: body.disclaimer || "",
      status: "New",
      createdBy: "Public Form",
    });

    return NextResponse.json({ success: true, id: doc._id });
  } catch (error) {
    console.error("[PUBLIC_INTERVIEW_POST]", error);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
