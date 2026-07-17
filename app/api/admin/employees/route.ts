import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxEmployee from '@/lib/models/SymxEmployee';
import { getSession } from '@/lib/auth';
import { canViewCompensation, maskRateInList, maskRate } from '@/lib/compensation-visibility';

export async function GET(req: Request) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    // Check permissions if needed, for now assume admin/manager access
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    // Pay rate is only visible to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts. Everyone else gets `rate` stripped
    // from every employee record this route returns, regardless of any
    // `select` param the caller sent.
    const canViewComp = await canViewCompensation(session);

    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const limitParams = searchParams.get('limit');
    let limit = limitParams ? parseInt(limitParams, 10) : 50; // enforce pagination by default
    const isExport = searchParams.get('export') === 'true'; // allows bypassing limit for exports
    if (isExport) limit = 0; // 0 means no limit for exports, but MUST be explicitly requested
    
    const search = searchParams.get('search') || '';
    const fetchTerminated = searchParams.get('terminated') === 'true';
    const selectFields = searchParams.get('select');

    const filterStatus = searchParams.get('status');
    const filterType = searchParams.get('type');
    const filterHourly = searchParams.get('hourlyStatus');
    const filterSpecial = searchParams.get('filter'); // dlExpiring, missingDocs

    // Construct query
    const query: any = {};

    if (search) {
      // Escape special regex characters to prevent crashes
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const orConditions: any[] = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phoneNumber: regex },
        { badgeNumber: regex },
        { transporterId: regex },
        { eeCode: regex },
        { type: regex },
        { status: regex },
        { hourlyStatus: regex },
        { gender: regex },
        { city: regex },
        { state: regex },
        { zipCode: regex },
        { streetAddress: regex },
        { gasCardPin: regex },
        { routesComp: regex },
        { defaultVan1: regex },
        { defaultVan2: regex },
        { defaultVan3: regex },
        { terminationReason: regex },
        { resignationType: regex },
        { ScheduleNotes: regex },
      ];

      // Support full-name search (e.g. "Abraham Romo") by matching concatenated firstName + lastName
      if (search.includes(' ')) {
        orConditions.push({
          $expr: {
            $regexMatch: {
              input: { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] },
              regex: escaped,
              options: 'i',
            },
          },
        });
      }

      query.$or = orConditions;

    } else {
      // No search — apply basic filtering
    }

    // Apply exact filters
    if (filterStatus) {
      if (filterStatus === "Resigned") {
        query.$or = [{ status: "Resigned" }, { resignationDate: { $ne: null } }];
      } else {
        query.status = filterStatus;
      }
    } else if (!fetchTerminated) {
      // Still hide Terminated unless searching explicitly or asking for it
      query.status = { $ne: 'Terminated' };
    }

    if (filterType) query.type = filterType;
    if (filterHourly) query.hourlyStatus = filterHourly;

    // Apply special compliance filters
    if (filterSpecial === 'dlExpiring') {
      const now = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      query.dlExpiration = { $gte: now, $lte: thirtyDays };
      query.status = "Active";
    } else if (filterSpecial === 'missingDocs') {
      // If we already have $or from Resigned filtering (rare to mix, but just in case), we use $and
      const missingCondition = [
        { offerLetterFile: null }, { offerLetterFile: "" },
        { driversLicenseFile: null }, { driversLicenseFile: "" },
        { i9File: null }, { i9File: "" }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: missingCondition }];
        delete query.$or;
      } else {
        query.$or = missingCondition;
      }
      query.status = "Active";
    } else if (filterSpecial === 'audit') {
      // Employee Audit: Active + (DL expired OR missing transporterId OR missing any required doc)
      const now = new Date();
      const auditConditions = [
        { dlExpiration: { $lte: now } },
        { transporterId: { $in: ["", null] } },
        { transporterId: { $exists: false } },
        { offerLetterFile: { $in: ["", null] } },
        { offerLetterFile: { $exists: false } },
        { handbookFile: { $in: ["", null] } },
        { handbookFile: { $exists: false } },
        { driversLicenseFile: { $in: ["", null] } },
        { driversLicenseFile: { $exists: false } },
        { i9File: { $in: ["", null] } },
        { i9File: { $exists: false } },
        { drugTestFile: { $in: ["", null] } },
        { drugTestFile: { $exists: false } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: auditConditions }];
        delete query.$or;
      } else {
        query.$or = auditConditions;
      }
      query.status = "Active";
    }

    if (limit > 0 || !isExport) {
      // Return paginated object. Enforce default limit if not export.
      const actualLimit = limit > 0 ? limit : 50;
      const totalCount = await SymxEmployee.countDocuments(query);
      const queryBuilder = SymxEmployee.find(query)
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(actualLimit);
        
      if (selectFields) {
        queryBuilder.select(selectFields.split(',').join(' '));
      }
      
      const employees = await queryBuilder.lean();

      return NextResponse.json({
        records: maskRateInList(employees, canViewComp),
        totalCount,
        hasMore: skip + actualLimit < totalCount
      });
    }

    // Export path: full dataset (only if explicitly requested via export=true)
    const queryBuilder = SymxEmployee.find(query)
      .sort({ firstName: 1, lastName: 1 });

    if (selectFields) {
      queryBuilder.select(selectFields.split(',').join(' '));
    }

    const employees = await queryBuilder.lean();

    return NextResponse.json(maskRateInList(employees, canViewComp));
  } catch (error) {
    console.error('[EMPLOYEES_GET]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("HR", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    
    // Strict rbac?
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();

    // Default weekly availability to route type ObjectId if not set
    const DEFAULT_ROUTE_TYPE = '69f8d51a4e04c9a132a586cf';
    const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (const day of DAYS) {
      if (!body[day]) body[day] = DEFAULT_ROUTE_TYPE;
    }
    
    // Check for duplicate email
    const existingEmployee = await SymxEmployee.findOne({ email: body.email }).lean();
    if (existingEmployee) {
      return new NextResponse("Email already exists", { status: 409 });
    }

    const employee = await SymxEmployee.create(body);

    // Pay rate is only visible to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts.
    const canViewComp = await canViewCompensation(session);
    return NextResponse.json(maskRate(employee.toObject(), canViewComp));
  } catch (error: any) {
    console.error('[EMPLOYEES_POST]', error);
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors || {}).map((e: any) => e.message).join(", ") || "Validation failed";
      return new NextResponse(message, { status: 400 });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}
