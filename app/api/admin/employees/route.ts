
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

    const employees = await SymxEmployee.find({})
      .sort({ createdAt: -1 });

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
