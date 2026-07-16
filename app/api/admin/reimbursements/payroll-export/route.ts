import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import SymxEmployee from "@/lib/models/SymxEmployee";

function csvEscape(value: any): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// CSV export of reimbursements queued for payroll — what whoever runs
// payroll actually hands off/imports into their payroll system. Gated on
// "pay" like the rest of the payment lifecycle, since this is the same
// finance-only data as marking something paid.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("HR", "pay");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const records = await SymxReimbursement.find({ status: "queued_for_payroll" }).sort({ payrollQueuedAt: 1 }).lean();

    const employeeIds = [...new Set(records.map((r) => r.employeeId).filter(Boolean).map((id: any) => String(id)))];
    const employees = employeeIds.length
      ? await SymxEmployee.find({ _id: { $in: employeeIds } }, { eeCode: 1, transporterId: 1, firstName: 1, lastName: 1 }).lean()
      : [];
    const empMap = new Map(employees.map((e: any) => [String(e._id), e]));

    const header = ["Request #", "Employee Name", "EE Code", "Transporter ID", "Amount", "Description", "Batch Label", "Queued At"];
    const rows = records.map((r: any) => {
      const emp = r.employeeId ? empMap.get(String(r.employeeId)) : null;
      const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : r.employeeName || r.submitterName || "";
      const description = (r.items || []).map((it: any) => it.description).join("; ") || r.description || "";
      return [
        r.requestNumber || "",
        employeeName,
        emp?.eeCode || "",
        emp?.transporterId || r.transporterId || "",
        typeof r.amount === "number" ? r.amount.toFixed(2) : "0.00",
        description,
        r.payrollBatchLabel || "",
        r.payrollQueuedAt ? new Date(r.payrollQueuedAt).toISOString().slice(0, 10) : "",
      ];
    });

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const filename = `reimbursements-payroll-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("[REIMBURSEMENT_PAYROLL_EXPORT]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
