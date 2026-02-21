
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

    // Construct query
    const query: any = {};
    if (!fetchTerminated) {
      query.status = { $ne: 'Terminated' };
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { badgeNumber: regex },
        { transporterId: regex },
        { eeCode: regex },
      ];
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
