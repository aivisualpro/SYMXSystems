import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { canViewCompensation, maskRate } from "@/lib/compensation-visibility";

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

    // Pay rate is only visible to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts.
    const canViewComp = await canViewCompensation(session);
    return NextResponse.json(maskRate(employee.toObject(), canViewComp));
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

    // Pay rate is only visible/editable to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts. The edit form's Rate field is masked/blank
    // for anyone without that access, so a submitted `rate` from them isn't a real
    // intentional edit — drop it rather than let it overwrite the real value with
    // whatever the (masked) field happened to contain.
    const canViewComp = await canViewCompensation(session);
    if (!canViewComp) {
      delete body.rate;
    }

    const updatedEmployee = await SymxEmployee.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return NextResponse.json(maskRate(updatedEmployee.toObject(), canViewComp));
  } catch (error: any) {
    console.error("PUT /api/admin/employees/[id] error:", error);
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors || {}).map((e: any) => e.message).join(", ") || "Validation failed";
      return new NextResponse(message, { status: 400 });
    }
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
