import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxAppModule from "@/lib/models/SymxAppModule";
import SymxCardConfig from "@/lib/models/SymxCardConfig";

// Default modules for auto-seeding
const DEFAULT_MODULES = [
  { name: "Dashboard", url: "/dashboard", icon: "IconDashboard", order: 0, subModules: [] },
  { name: "Owner", url: "/owner", icon: "IconCrown", order: 1, subModules: [
    { name: "Efficiency Company", url: "#" }, { name: "Dropdowns", url: "#" }, { name: "General Settings", url: "#" },
    { name: "Menu", url: "#" }, { name: "App Users", url: "/owner/app-users" }, { name: "Expenses", url: "#" },
  ]},
  { name: "Dispatch", url: "/dispatch", icon: "IconTruckDelivery", order: 2, subModules: [
    { name: "Roster", url: "#" }, { name: "Performance Dashboard", url: "#" }, { name: "Opening", url: "#" },
    { name: "Attendance", url: "#" }, { name: "Repairs", url: "#" }, { name: "Loadout", url: "#" },
    { name: "Time", url: "#" }, { name: "Schedule", url: "#" }, { name: "Closing", url: "#" },
    { name: "Contacts", url: "#" }, { name: "Verbal Coaching", url: "#" }, { name: "Messaging", url: "#" },
    { name: "Efficiency", url: "#" }, { name: "Routes", url: "#" }, { name: "Incidents", url: "#" },
    { name: "Coaching", url: "#" }, { name: "Checklist", url: "#" },
  ]},
  { name: "Scheduling", url: "/scheduling", icon: "IconCalendarTime", order: 3, subModules: [
    { name: "Schedule", url: "#" }, { name: "Confirm Schedules", url: "#" },
    { name: "Work Hour Compliance", url: "#" }, { name: "Capacity Planning", url: "#" },
    { name: "Availability", url: "#" }, { name: "Schedule Check", url: "#" },
  ]},
  { name: "Everyday", url: "#", icon: "IconSun", order: 4, subModules: [] },
  { name: "Fleet", url: "#", icon: "IconCar", order: 5, subModules: [] },
  { name: "HR", url: "/hr", icon: "IconUsersGroup", order: 6, subModules: [
    { name: "Employees", url: "/hr/employees" }, { name: "Employee Performance", url: "#" },
    { name: "Reimbursement", url: "#" }, { name: "Claims Dashboard", url: "#" },
    { name: "Employee Audit", url: "#" }, { name: "HR Tickets", url: "#" },
    { name: "Timesheet", url: "#" }, { name: "Interviews", url: "#" },
    { name: "Onboarding", url: "#" }, { name: "Hired", url: "#" },
    { name: "Uniforms", url: "#" }, { name: "Terminations", url: "#" },
  ]},
  { name: "Incidents", url: "#", icon: "IconAlertTriangle", order: 7, subModules: [] },
  { name: "Insurance", url: "#", icon: "IconShield", order: 8, subModules: [] },
  { name: "Manager", url: "/manager", icon: "IconTie", order: 9, subModules: [
    { name: "Routes Manager", url: "#" }, { name: "Punch Ins Manager", url: "#" },
    { name: "Punch Ins Import", url: "#" }, { name: "RTS Manager", url: "#" },
    { name: "Rescue Manager", url: "#" }, { name: "Driver Efficiency Manager", url: "#" },
    { name: "Performance Summary", url: "#" }, { name: "Scorecard Performance", url: "#" },
    { name: "Employee Ranking", url: "#" }, { name: "HR Tickets Managers", url: "#" },
    { name: "Notices", url: "#" }, { name: "Work Hours Compliance", url: "#" },
    { name: "Paycom Schedule Export", url: "#" }, { name: "Work Summary Tool", url: "#" },
    { name: "Fleet Summary", url: "#" }, { name: "Repairs", url: "#" },
    { name: "Scorecard History", url: "#" },
    { name: "Weekly ScoreCard", url: "/scorecard" },
    { name: "Lunch Compliance", url: "#" },
  ]},
  { name: "Scorecard", url: "/scorecard", icon: "IconTarget", order: 10, subModules: [] },
];

// GET: Fetch all modules (ordered) — auto-seeds on first request
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    let modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();

    // Auto-seed if collection is empty
    if (modules.length === 0) {
      await SymxAppModule.insertMany(DEFAULT_MODULES);
      modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();
    } else {
      // Auto-patch: sync sub-modules/URLs from DEFAULT_MODULES for modules
      // that were seeded with empty sub-modules but now have defaults
      for (const defaultMod of DEFAULT_MODULES) {
        const dbMod = modules.find((m: any) => m.name === defaultMod.name);
        if (dbMod) {
          let needsUpdate = false;
          const updates: any = {};

          // Patch URL if it was "#" and default now has a real URL
          if ((dbMod as any).url === "#" && defaultMod.url !== "#") {
            updates.url = defaultMod.url;
            needsUpdate = true;
          }

          // Patch sub-modules if DB has none but defaults have them
          if ((!((dbMod as any).subModules) || (dbMod as any).subModules.length === 0) && defaultMod.subModules.length > 0) {
            updates.subModules = defaultMod.subModules;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await SymxAppModule.updateOne({ _id: (dbMod as any)._id }, { $set: updates });
          }
        } else {
          // Module doesn't exist in DB yet — insert it
          await SymxAppModule.create(defaultMod);
        }
      }

      // Clean up removed modules (e.g. Reports)
      const validNames = DEFAULT_MODULES.map(m => m.name);
      await SymxAppModule.deleteMany({ name: { $nin: validNames } });

      // Re-fetch if any patches were applied
      modules = await SymxAppModule.find({}).sort({ order: 1 }).lean();
    }

    // Merge card-config display names into sub-modules
    // Card-config is the source of truth for display names set by Super Admin
    try {
      const cardConfigs = await SymxCardConfig.find({}).lean();
      if (cardConfigs.length > 0) {
        modules = modules.map((mod: any) => {
          const pageName = mod.name.toLowerCase(); // e.g. "Reports" → "reports"
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
      // Non-critical — continue with DB names
      console.error("Failed to merge card-config names:", mergeErr);
    }

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
          { name: "Efficiency Company", url: "#" },
          { name: "Dropdowns", url: "#" },
          { name: "General Settings", url: "#" },
          { name: "Menu", url: "#" },
          { name: "App Users", url: "/owner/app-users" },
          { name: "Expenses", url: "#" },
        ],
      },
      {
        name: "Dispatch",
        url: "/dispatch",
        icon: "IconTruckDelivery",
        order: 2,
        subModules: [
          { name: "Roster", url: "#" },
          { name: "Performance Dashboard", url: "#" },
          { name: "Opening", url: "#" },
          { name: "Attendance", url: "#" },
          { name: "Repairs", url: "#" },
          { name: "Loadout", url: "#" },
          { name: "Time", url: "#" },
          { name: "Schedule", url: "#" },
          { name: "Closing", url: "#" },
          { name: "Contacts", url: "#" },
          { name: "Verbal Coaching", url: "#" },
          { name: "Messaging", url: "#" },
          { name: "Efficiency", url: "#" },
          { name: "Routes", url: "#" },
          { name: "Incidents", url: "#" },
          { name: "Coaching", url: "#" },
          { name: "Checklist", url: "#" },
        ],
      },
      {
        name: "Scheduling",
        url: "#",
        icon: "IconCalendarTime",
        order: 3,
        subModules: [],
      },
      {
        name: "Everyday",
        url: "#",
        icon: "IconSun",
        order: 4,
        subModules: [],
      },
      {
        name: "Fleet",
        url: "#",
        icon: "IconCar",
        order: 5,
        subModules: [],
      },
      {
        name: "HR",
        url: "/hr",
        icon: "IconUsersGroup",
        order: 6,
        subModules: [
          { name: "Employees", url: "/hr/employees" },
          { name: "Employee Performance", url: "#" },
          { name: "Reimbursement", url: "#" },
          { name: "Claims Dashboard", url: "#" },
          { name: "Employee Audit", url: "#" },
          { name: "HR Tickets", url: "#" },
          { name: "Timesheet", url: "#" },
          { name: "Interviews", url: "#" },
          { name: "Onboarding", url: "#" },
          { name: "Hired", url: "#" },
          { name: "Uniforms", url: "#" },
          { name: "Terminations", url: "#" },
        ],
      },
      {
        name: "Incidents",
        url: "#",
        icon: "IconAlertTriangle",
        order: 7,
        subModules: [],
      },
      {
        name: "Insurance",
        url: "#",
        icon: "IconShield",
        order: 8,
        subModules: [],
      },
      {
        name: "Manager",
        url: "/manager",
        icon: "IconTie",
        order: 9,
        subModules: [
          { name: "Routes Manager", url: "#" },
          { name: "Punch Ins Manager", url: "#" },
          { name: "Punch Ins Import", url: "#" },
          { name: "RTS Manager", url: "#" },
          { name: "Rescue Manager", url: "#" },
          { name: "Driver Efficiency Manager", url: "#" },
          { name: "Performance Summary", url: "#" },
          { name: "Scorecard Performance", url: "#" },
          { name: "Employee Ranking", url: "#" },
          { name: "HR Tickets Managers", url: "#" },
          { name: "Notices", url: "#" },
          { name: "Work Hours Compliance", url: "#" },
          { name: "Paycom Schedule Export", url: "#" },
          { name: "Work Summary Tool", url: "#" },
          { name: "Fleet Summary", url: "#" },
          { name: "Repairs", url: "#" },
          { name: "Scorecard History", url: "#" },
          { name: "Weekly ScoreCard", url: "/scorecard" },
          { name: "Lunch Compliance", url: "#" },
        ],
      },
      {
        name: "Scorecard",
        url: "/scorecard",
        icon: "IconTarget",
        order: 10,
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
