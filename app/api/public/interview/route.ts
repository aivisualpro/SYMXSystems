import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
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

    // ── Which station is this application for? ──
    // Each station shares its OWN QR code / link carrying ?station=CODE,
    // so an applicant scanning the poster at DXC8 lands in DXC8's pipeline
    // without having to be asked. A station code rather than an id keeps
    // the printed URL readable and stable.
    //
    // Validated against real, active stations — this endpoint is
    // unauthenticated, so the query string is hostile input.
    //
    // An application with no station (an old link, or someone typing the
    // bare URL) is left unassigned rather than defaulted. A candidate
    // silently dropped into the wrong station's pipeline is worse than one
    // that needs assigning: the first is invisible, the second is a
    // visible gap someone will fix.
    let interviewSiteId: any = undefined;
    const stationCode = (body.station || "").toString().trim().toUpperCase();
    if (stationCode) {
      const station: any = await Site.findOne(
        { code: stationCode, status: "active" },
        { _id: 1 }
      ).lean();
      if (station) interviewSiteId = station._id;
    }

    if (!body.phoneNumber?.trim() || !body.workStartDate?.trim()) {
      return NextResponse.json(
        { error: "Phone number and start date are required" },
        { status: 400 }
      );
    }

    const hasExp = body.hasDeliveryExperience === "Yes" ? "Yes" : body.hasDeliveryExperience === "No" ? "No" : "";
    const expDetails = (body.deliveryExperienceDetails || "").toString().trim();
    const city = (body.currentCity || "").toString().trim();
    const driverDesc = (body.driverDescription || "").toString().trim();

    // Combined summary so existing HR screens (which show "Past Experience")
    // display the new answers without further changes.
    const summary = [
      hasExp ? `Amazon/delivery driving experience: ${hasExp}${hasExp === "Yes" && expDetails ? ` — ${expDetails}` : ""}` : "",
      city ? `Lives in: ${city}` : "",
      driverDesc ? `Describes self as a driver: ${driverDesc}` : "",
    ].filter(Boolean).join("\n");

    const doc = await SymxInterview.create({
      currentCity: city,
      hasDeliveryExperience: hasExp,
      deliveryExperienceDetails: expDetails,
      driverDescription: driverDesc,
      siteId: interviewSiteId,
      fullName: body.fullName?.trim(),
      phoneNumber: body.phoneNumber?.trim(),
      workStartDate: body.workStartDate?.trim(),
      typeOfWork: body.typeOfWork?.trim(),
      workDays: body.workDays?.trim(),
      lastEmployerInfo: summary || body.lastEmployerInfo?.trim(),
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
