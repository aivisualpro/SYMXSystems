import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxAppModule from "@/lib/models/SymxAppModule";

// ── VERSION: bump this whenever DEFAULT_MODULES changes to force a DB reseed ──
const MODULES_VERSION = 3;

// Default modules — must match actual routes in /app/(protected)/
const DEFAULT_MODULES = [
  { name: "Dashboard", url: "/dashboard", icon: "IconDashboard", order: 0, subModules: [] },
  {
    name: "Owner", url: "/owner", icon: "IconCrown", order: 1, subModules: [
      { name: "App Users", url: "/owner/app-users" },
      { name: "Roles & Permissions", url: "/owner/roles" },
    ]
  },
  {
    name: "Fleet", url: "/fleet", icon: "IconCar", order: 2, subModules: [
      { name: "Overview", url: "/fleet" },
      { name: "Vehicles", url: "/fleet/vehicles" },
      { name: "Repairs", url: "/fleet/repairs" },
      { name: "Inspections", url: "/fleet/inspections" },
      { name: "Rental Agreements", url: "/fleet/rentals" },
    ]
  },
  {
    name: "Scheduling", url: "/scheduling", icon: "IconCalendarTime", order: 3, subModules: [
      { name: "Messaging", url: "/scheduling/messaging" },
    ]
  },
  {
    name: "Dispatching", url: "/dispatching", icon: "IconRoute", order: 4, subModules: [
      { name: "Roster", url: "/dispatching/roster" },
      { name: "Opening", url: "/dispatching/opening" },
      { name: "Attendance", url: "/dispatching/attendance" },
      { name: "Repairs", url: "/dispatching/repairs" },
      { name: "Time", url: "/dispatching/time" },
      { name: "Closing", url: "/dispatching/closing" },
      { name: "Efficiency", url: "/dispatching/efficiency" },
      { name: "Routes", url: "/dispatching/routes" },
    ]
  },
  {
    name: "HR", url: "/hr", icon: "IconUsersGroup", order: 5, subModules: [
      { name: "Employees", url: "/hr/employees" },
      { name: "Reimbursement", url: "/hr/reimbursement" },
      { name: "Incidents", url: "/hr/incidents" },
      { name: "Employee Audit", url: "/hr/audit" },
      { name: "HR Tickets", url: "/hr/tickets" },
      { name: "Timesheet", url: "/hr/timesheet" },
      { name: "Interviews", url: "/hr/interviews" },
      { name: "Onboarding", url: "/hr/onboarding" },
      { name: "Hired", url: "/hr/hired" },
      { name: "Uniforms", url: "/hr/uniforms" },
      { name: "Terminations", url: "/hr/terminations" },
    ]
  },
  { name: "Scorecard", url: "/scorecard", icon: "IconTarget", order: 6, subModules: [] },
];

// In-memory cache
let modulesCache: { data: any[]; timestamp: number; version: number } | null = null;
const MODULES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Mutex to prevent concurrent reseed race conditions
let _reseedInFlight: Promise<any[]> | null = null;

// GET: Fetch all modules (ordered) — auto-seeds/reseeds when version changes
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return cached modules if fresh AND same version
    const now = Date.now();
    if (modulesCache && modulesCache.version === MODULES_VERSION && (now - modulesCache.timestamp) < MODULES_CACHE_TTL) {
      return NextResponse.json({ modules: modulesCache.data });
    }

    await connectToDatabase();

    // Use a mutex so concurrent requests don't race on deleteMany+insertMany
    if (_reseedInFlight) {
      const modules = await _reseedInFlight;
      return NextResponse.json({ modules });
    }

    _reseedInFlight = (async () => {
      try {
        await SymxAppModule.deleteMany({});
        await SymxAppModule.insertMany(DEFAULT_MODULES, { ordered: false });
        const modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();
        modulesCache = { data: modules, timestamp: Date.now(), version: MODULES_VERSION };
        return modules;
      } finally {
        _reseedInFlight = null;
      }
    })();

    const modules = await _reseedInFlight;
    return NextResponse.json({ modules });
  } catch (error) {
    console.error("Error fetching modules:", error);
    return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}

// POST: Seed/reseed modules — pass { force: true } to wipe and re-seed
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json().catch(() => ({}));

    if (body.force) {
      await SymxAppModule.deleteMany({});
      await SymxAppModule.insertMany(DEFAULT_MODULES);
      modulesCache = null;
      return NextResponse.json({ message: "Modules reseeded successfully", count: DEFAULT_MODULES.length });
    }

    const existingCount = await SymxAppModule.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json({ message: "Modules already seeded", count: existingCount });
    }

    await SymxAppModule.insertMany(DEFAULT_MODULES);
    modulesCache = null;

    return NextResponse.json({ message: "Modules seeded successfully", count: DEFAULT_MODULES.length });
  } catch (error) {
    console.error("Error seeding modules:", error);
    return NextResponse.json({ error: "Failed to seed modules" }, { status: 500 });
  }
}
