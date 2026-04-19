import { NextRequest, NextResponse } from "next/server";
import { GET as dashboardGet } from "./dashboard/route";
import { GET as vehiclesGet, POST as vehiclesPost, PUT as vehiclesPut, DELETE as vehiclesDelete } from "./vehicles/route";
import { GET as repairsGet, POST as repairsPost, PUT as repairsPut, DELETE as repairsDelete } from "./repairs/route";
import { GET as inspectionsGet, POST as inspectionsPost, PUT as inspectionsPut, DELETE as inspectionsDelete, PATCH as inspectionsPatch } from "./inspections/route";
import { GET as rentalsGet, POST as rentalsPost, PUT as rentalsPut, DELETE as rentalsDelete } from "./rentals/route";
import { POST as activityPost, PUT as activityPut, DELETE as activityDelete } from "./activity/route";

function logDeprecation(method: string, req: NextRequest) {
  console.warn(`[DEPRECATED] API god-route /api/fleet was called via ${method}. URL: ${req.url}. Please migrate frontend calls to specific endpoints (/api/fleet/vehicles, etc.)`);
}

export async function GET(req: NextRequest) {
  logDeprecation("GET", req);
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  if (!section || section === "dashboard" || section === "efficiency" || section === "efficiency-history") {
    return dashboardGet(req);
  } else if (section === "vehicles") {
    return vehiclesGet(req);
  } else if (section === "repairs") {
    return repairsGet(req);
  } else if (section === "inspections" || section.startsWith("inspection-")) {
    return inspectionsGet(req);
  } else if (section === "rentals") {
    return rentalsGet(req);
  }

  return NextResponse.json({ error: "Invalid section" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  logDeprecation("POST", req);
  
  let type;
  let rawBody;
  try {
    rawBody = await req.text();
    const body = JSON.parse(rawBody);
    type = body.type;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwardedReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: rawBody,
  });

  switch (type) {
    case "vehicle": return vehiclesPost(forwardedReq);
    case "repair": return repairsPost(forwardedReq);
    case "activity": return activityPost(forwardedReq);
    case "inspection": return inspectionsPost(forwardedReq);
    case "rental": return rentalsPost(forwardedReq);
    default: return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  logDeprecation("PUT", req);
  
  let type;
  let rawBody;
  try {
    rawBody = await req.text();
    const body = JSON.parse(rawBody);
    type = body.type;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwardedReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: rawBody,
  });

  switch (type) {
    case "vehicle": return vehiclesPut(forwardedReq);
    case "repair": return repairsPut(forwardedReq);
    case "activity": return activityPut(forwardedReq);
    case "inspection": return inspectionsPut(forwardedReq);
    case "rental": return rentalsPut(forwardedReq);
    default: return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  logDeprecation("DELETE", req);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  switch (type) {
    case "vehicle": return vehiclesDelete(req);
    case "repair": return repairsDelete(req);
    case "activity": return activityDelete(req);
    case "inspection": return inspectionsDelete(req);
    case "rental": return rentalsDelete(req);
    default: return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  logDeprecation("PATCH", req);
  // The only PATCH in original route was toggle-standard-photo
  return inspectionsPatch(req);
}
