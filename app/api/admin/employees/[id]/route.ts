
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import SymxEmployee from "@/lib/models/SymxEmployee";

type RouteProps = {
  params: Promise<{ id: string }>;
};

// GET single employee
export async function GET(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;

    const employee = await SymxEmployee.findById(params.id);
    if (!employee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("GET /api/admin/employees/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// UPDATE employee
export async function PUT(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;
    const body = await req.json();

    // Remove _id from body if present to avoid immutable field error (though mongoose handles it usually)
    delete body._id;

    const updatedEmployee = await SymxEmployee.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error("PUT /api/admin/employees/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE employee
export async function DELETE(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    // Only Admin can delete? Assuming all authenticated users with role can delete for now, or check role === 'Admin'
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;

    const deletedEmployee = await SymxEmployee.findByIdAndDelete(params.id);

    if (!deletedEmployee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/admin/employees/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
