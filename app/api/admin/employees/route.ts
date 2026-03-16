
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxEmployee from '@/lib/models/SymxEmployee';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    // Check permissions if needed, for now assume admin/manager access
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const limitParams = searchParams.get('limit');
    let limit = limitParams ? parseInt(limitParams, 10) : 0;
    const search = searchParams.get('search') || '';
    const fetchTerminated = searchParams.get('terminated') === 'true';

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
    }

    if (limit > 0) {
      // Return paginated object
      const totalCount = await SymxEmployee.countDocuments(query);
      const employees = await SymxEmployee.find(query)
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return NextResponse.json({
        records: employees,
        totalCount,
        hasMore: skip + limit < totalCount
      });
    }

    // Backwards compatibility: fetch all
    const employees = await SymxEmployee.find(query)
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return NextResponse.json(employees);
  } catch (error) {
    console.error('[EMPLOYEES_GET]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    
    // Strict rbac?
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    
    // Check for duplicate email
    const existingEmployee = await SymxEmployee.findOne({ email: body.email });
    if (existingEmployee) {
      return new NextResponse("Email already exists", { status: 409 });
    }

    const employee = await SymxEmployee.create(body);

    return NextResponse.json(employee);
  } catch (error) {
    console.error('[EMPLOYEES_POST]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
