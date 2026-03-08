import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxAppModule from "@/lib/models/SymxAppModule";
import SymxCardConfig from "@/lib/models/SymxCardConfig";

// Default modules for auto-seeding
const DEFAULT_MODULES = [
  { name: "Dashboard", url: "/dashboard", icon: "IconDashboard", order: 0, subModules: [] },
  {
    name: "Owner", url: "/owner", icon: "IconCrown", order: 1, subModules: [
      { name: "App Users", url: "/owner/app-users" },
    ]
  },
  {
    name: "Fleet", url: "/fleet", icon: "IconCar", order: 2, subModules: [
      { name: "Dashboard", url: "/fleet" },
      { name: "Vehicles", url: "/fleet/vehicles" },
      { name: "Vehicle Slots", url: "/fleet/slots" },
      { name: "Repairs", url: "/fleet/repairs" },
      { name: "Inspections", url: "/fleet/inspections" },
      { name: "Rental Agreements", url: "/fleet/rentals" },
      { name: "Activity Logs", url: "/fleet/activity" },
    ]
  },
  {
    name: "Scheduling", url: "/scheduling", icon: "IconCalendarTime", order: 3, subModules: [
      { name: "Schedule", url: "#" }, { name: "Confirm Schedules", url: "#" },
      { name: "Work Hour Compliance", url: "#" }, { name: "Capacity Planning", url: "#" },
      { name: "Availability", url: "#" }, { name: "Schedule Check", url: "#" },
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
    ]
  },
  {
    name: "HR", url: "/hr", icon: "IconUsersGroup", order: 5, subModules: [
      { name: "Employees", url: "/hr/employees" }
    ]
  },
  { name: "Scorecard", url: "/scorecard", icon: "IconTarget", order: 6, subModules: [] },
];

// In-memory cache for modules — avoids re-syncing on every sidebar render
let modulesCache: { data: any[]; timestamp: number } | null = null;
const MODULES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// GET: Fetch all modules (ordered) — auto-seeds on first request
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return cached modules if fresh
    const now = Date.now();
    if (modulesCache && (now - modulesCache.timestamp) < MODULES_CACHE_TTL) {
      return NextResponse.json({ modules: modulesCache.data });
    }

    await connectToDatabase();

    let modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();

    // Auto-seed if collection is empty
    if (modules.length === 0) {
      await SymxAppModule.insertMany(DEFAULT_MODULES);
      modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();
    } else {
      // Auto-patch: sync sub-modules/URLs from DEFAULT_MODULES
      let anyPatched = false;
      const bulkOps: any[] = [];

      for (const defaultMod of DEFAULT_MODULES) {
        const dbMod = modules.find((m: any) => m.name === defaultMod.name);
        if (dbMod) {
          const updates: any = {};
          if ((dbMod as any).url === "#" && defaultMod.url !== "#") {
            updates.url = defaultMod.url;
          }
          if ((!((dbMod as any).subModules) || (dbMod as any).subModules.length === 0) && defaultMod.subModules.length > 0) {
            updates.subModules = defaultMod.subModules;
          }
          if (Object.keys(updates).length > 0) {
            bulkOps.push({
              updateOne: { filter: { _id: (dbMod as any)._id }, update: { $set: updates } }
            });
            anyPatched = true;
          }
        } else {
          bulkOps.push({
            insertOne: { document: defaultMod }
          });
          anyPatched = true;
        }
      }

      // Clean up removed modules
      const validNames = DEFAULT_MODULES.map(m => m.name);
      const staleMods = modules.filter((m: any) => !validNames.includes(m.name));
      if (staleMods.length > 0) {
        bulkOps.push({
          deleteMany: { filter: { name: { $nin: validNames } } }
        });
        anyPatched = true;
      }

      // Execute all patches in one bulkWrite (instead of N individual calls)
      if (anyPatched && bulkOps.length > 0) {
        await SymxAppModule.bulkWrite(bulkOps);
        modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();
      }
    }

    // Merge card-config display names into sub-modules
    try {
      const cardConfigs = await SymxCardConfig.find({}).lean();
      if (cardConfigs.length > 0) {
        modules = modules.map((mod: any) => {
          const pageName = mod.name.toLowerCase();
          const config = cardConfigs.find((c: any) => c.page === pageName);
          if (config && config.cards && config.cards.length > 0 && mod.subModules?.length > 0) {
            const updatedSubs = mod.subModules.map((sm: any, idx: number) => {
              const cardOverride = config.cards.find((c: any) => c.index === idx);
              if (cardOverride?.name) {
                return { ...sm, name: cardOverride.name };
              }
              return sm;
            });
            return { ...mod, subModules: updatedSubs };
          }
          return mod;
        });
      }
    } catch (mergeErr) {
      console.error("Failed to merge card-config names:", mergeErr);
    }

    // Update cache
    modulesCache = { data: modules, timestamp: Date.now() };

    return NextResponse.json({ modules });
  } catch (error) {
    console.error("Error fetching modules:", error);
    return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}

// POST: Seed initial modules (only if collection is empty)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const existingCount = await SymxAppModule.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json({ message: "Modules already seeded", count: existingCount });
    }

    const defaultModules = [
      {
        name: "Dashboard",
        url: "/dashboard",
        icon: "IconDashboard",
        order: 0,
        subModules: [],
      },
      {
        name: "Owner",
        url: "/owner",
        icon: "IconCrown",
        order: 1,
        subModules: [
          { name: "App Users", url: "/owner/app-users" }
        ],
      },
      {
        name: "Fleet",
        url: "/fleet",
        icon: "IconCar",
        order: 2,
        subModules: [
          { name: "Dashboard", url: "/fleet" },
          { name: "Vehicles", url: "/fleet/vehicles" },
          { name: "Vehicle Slots", url: "/fleet/slots" },
          { name: "Repairs", url: "/fleet/repairs" },
          { name: "Inspections", url: "/fleet/inspections" },
          { name: "Rental Agreements", url: "/fleet/rentals" },
          { name: "Activity Logs", url: "/fleet/activity" },
        ],
      },
      {
        name: "Scheduling",
        url: "/scheduling",
        icon: "IconCalendarTime",
        order: 3,
        subModules: [
          { name: "Schedule", url: "#" },
          { name: "Confirm Schedules", url: "#" },
          { name: "Work Hour Compliance", url: "#" },
          { name: "Capacity Planning", url: "#" },
          { name: "Availability", url: "#" },
          { name: "Schedule Check", url: "#" },
        ],
      },
      {
        name: "Dispatching",
        url: "/dispatching",
        icon: "IconRoute",
        order: 4,
        subModules: [
          { name: "Roster", url: "/dispatching/roster" },
          { name: "Opening", url: "/dispatching/opening" },
          { name: "Attendance", url: "/dispatching/attendance" },
          { name: "Repairs", url: "/dispatching/repairs" },
          { name: "Time", url: "/dispatching/time" },
          { name: "Closing", url: "/dispatching/closing" },
          { name: "Efficiency", url: "/dispatching/efficiency" },
        ],
      },
      {
        name: "HR",
        url: "/hr",
        icon: "IconUsersGroup",
        order: 5,
        subModules: [
          { name: "Employees", url: "/hr/employees" }
        ],
      },
      {
        name: "Scorecard",
        url: "/scorecard",
        icon: "IconTarget",
        order: 5,
        subModules: [],
      },
    ];

    await SymxAppModule.insertMany(defaultModules);

    return NextResponse.json({ message: "Modules seeded successfully", count: defaultModules.length });
  } catch (error) {
    console.error("Error seeding modules:", error);
    return NextResponse.json({ error: "Failed to seed modules" }, { status: 500 });
  }
}
