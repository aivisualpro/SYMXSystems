import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, findScopedById, resolveWriteSiteId } from "@/lib/scoped-query";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import Site from "@/lib/models/Site";
import * as XLSX from "xlsx";

// POST /api/dispatching/time/punch-import
// Accepts a Paycom "Punch Audit Report" (.xlsx) as multipart form-data (field: "file").
// Parses the raw punch-level rows, groups them by EE Code + Punch Date, matches each
// EE Code to a SYMX employee (via employee.eeCode), then to that employee's route
// (via employee.transporterId + date). Returns a PREVIEW only — nothing is written here.
//
// Punches are assigned by CHRONOLOGICAL ORDER, not by the "Punch Type" label Paycom
// recorded — Paycom itself treats punches as sequential regardless of which button the
// employee pressed (an employee who fat-fingers "In Lunch" instead of "In Day" still
// just has one punch that morning), so SYMX matches that behavior: 1st punch of the day
// -> In Day, 2nd -> Out Lunch, 3rd -> In Lunch, 4th -> Out Day, in time order. A day with
// 1-4 recognized-type, non-deleted punches is staged for import (partial days are fine —
// this report gets uploaded multiple times a day as punches accumulate). Only genuinely
// broken data — more than 4 active punches, an unrecognized punch type, no employee
// match, or no route for that date — is returned as an exception for a human to resolve.

const POSITION_TYPES = ["ID", "OL", "IL", "OD"];
const POSITION_FIELDS = ["paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay"];
const KNOWN_TYPES = new Set(POSITION_TYPES);

function parsePunchDate(raw: string): Date | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1]);
  const day = parseInt(m[2]);
  const year = parseInt(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

// "10:30 AM" -> { minutes: 630, hhmm: "10:30" }. Returns null if unparseable.
// SYMXRoute stores paycom times as 24-hour "HH:MM" (no AM/PM) — the Time page's own
// display layer adds AM/PM formatting on render — so Paycom's "10:30 AM" text has to be
// converted here, not written through as-is (writing it as-is doubles up the AM/PM suffix
// once the page renders it).
function parsePaycomTime(raw: string): { minutes: number; hhmm: string } | null {
  const m = String(raw || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM") h += 12;
  return { minutes: h * 60 + min, hhmm: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows found in the uploaded file" }, { status: 400 });
    }

    await connectToDatabase();

        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        if (!writeSiteId) {
            return NextResponse.json(
                { error: "Select a single station first." },
                { status: 400 }
            );
        }

    // The Paycom report covers every station. Only rows worked at the station
    // currently selected belong here; others are counted, not flagged as errors.
    const siteDoc: any = await Site.findById(writeSiteId, { code: 1 }).lean();
    const siteCode = String(siteDoc?.code || "").trim().toUpperCase();
    const skippedOtherStations: Record<string, number> = {};

    // ── Group non-deleted punches by EE Code + Punch Date ──
    type PunchRow = { type: string; time: string; deleted: boolean; lastModified: string; modifiedBy: string };
    const groups = new Map<string, { eeCode: string; lastName: string; firstName: string; dateRaw: string; punches: PunchRow[] }>();

    for (const row of rows) {
      const eeCode = String(row["EE Code"] || "").trim();
      const dateRaw = String(row["Punch Date"] || "").trim();
      const type = String(row["Punch Type"] || "").trim().toUpperCase();
      if (!eeCode || !dateRaw || !type) continue;
      const rowStation = String(row["Dist Delivery Station Code Code"] || row["Delivery Station Code Code"] || "").trim().toUpperCase();
      if (siteCode && rowStation && rowStation !== siteCode) {
        skippedOtherStations[rowStation] = (skippedOtherStations[rowStation] || 0) + 1;
        continue;
      }

      const key = `${eeCode}__${dateRaw}`;
      if (!groups.has(key)) {
        groups.set(key, {
          eeCode,
          lastName: String(row["Last Name"] || "").trim(),
          firstName: String(row["First Name"] || "").trim(),
          dateRaw,
          punches: [],
        });
      }

      const deletedRaw = String(row["Deleted"] || "").trim().toLowerCase();
      groups.get(key)!.punches.push({
        type,
        time: String(row["Time"] || "").trim(),
        deleted: deletedRaw === "yes",
        lastModified: String(row["Last Modified"] || "").trim(),
        modifiedBy: String(row["Modified By"] || "").trim(),
      });
    }

    // ── Resolve employees by eeCode (single query, then lookup by code) ──
    const eeCodes = Array.from(new Set(Array.from(groups.values()).map((g) => g.eeCode)));
    const employees = await SymxEmployee.find(
      { eeCode: { $in: eeCodes } },
      { firstName: 1, lastName: 1, eeCode: 1, transporterId: 1, status: 1 }
    ).lean();
    const employeeByEeCode = new Map(employees.map((e: any) => [e.eeCode, e]));

    const clean: any[] = [];
    const exceptions: any[] = [];

    for (const group of groups.values()) {
      const dateObj = parsePunchDate(group.dateRaw);
      // Paycom records an edit as a new row plus a deleted row, and some days
      // carry non-clock entries (e.g. "HR" hours). Only the four clock punches count.
      const activePunches = group.punches.filter((p) => !p.deleted && KNOWN_TYPES.has(p.type));
      const ignoredNonClock = group.punches.filter((p) => !p.deleted && !KNOWN_TYPES.has(p.type)).length;
      const deletedCount = group.punches.length - activePunches.length;
      const employeeLabel = `${group.firstName} ${group.lastName}`.trim() || group.eeCode;

      if (!dateObj) {
        exceptions.push({ eeCode: group.eeCode, employeeName: employeeLabel, dateRaw: group.dateRaw, reason: "Unparseable punch date", punches: activePunches });
        continue;
      }

      const employee: any = employeeByEeCode.get(group.eeCode);
      if (!employee) {
        exceptions.push({ eeCode: group.eeCode, employeeName: employeeLabel, dateRaw: group.dateRaw, reason: "No SYMX employee found with this EE Code", punches: activePunches });
        continue;
      }

      if (!employee.transporterId) {
        exceptions.push({ eeCode: group.eeCode, employeeName: employeeLabel, employeeStatus: employee.status || "Active", dateRaw: group.dateRaw, reason: `Matched ${employee.firstName} ${employee.lastName}, but that employee has no Transporter ID on file`, punches: activePunches });
        continue;
      }

      // Unrecognized punch type (not ID/OL/IL/OD at all) — can't place this anywhere.
      const unknownTypes = Array.from(new Set(activePunches.filter((p) => !KNOWN_TYPES.has(p.type)).map((p) => p.type)));
      if (unknownTypes.length > 0 && activePunches.every((p) => !KNOWN_TYPES.has(p.type))) {
        exceptions.push({
          eeCode: group.eeCode,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          transporterId: employee.transporterId,
          dateRaw: group.dateRaw,
          employeeStatus: employee.status || "Active",
          reason: `Unrecognized punch type ${unknownTypes.join("/")}`,
          punches: activePunches,
        });
        continue;
      }

      if (activePunches.length === 0) {
        exceptions.push({
          eeCode: group.eeCode,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          transporterId: employee.transporterId,
          dateRaw: group.dateRaw,
          employeeStatus: employee.status || "Active",
          reason: `No punches left after excluding ${deletedCount} deleted punch${deletedCount === 1 ? "" : "es"}`,
          punches: activePunches,
        });
        continue;
      }

      // Parse times first.
      const withMinutes = activePunches.map((p) => ({ ...p, parsed: parsePaycomTime(p.time) }));
      if (withMinutes.some((p) => p.parsed === null)) {
        exceptions.push({
          eeCode: group.eeCode,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          transporterId: employee.transporterId,
          dateRaw: group.dateRaw,
          employeeStatus: employee.status || "Active",
          reason: "Unparseable punch time",
          punches: activePunches,
        });
        continue;
      }
      withMinutes.sort((a, b) => (a.parsed as any).minutes - (b.parsed as any).minutes);

      // Placement. Trust the Paycom label (ID/OL/IL/OD) when it is consistent:
      // a day with only In Day + Out Day (no lunch punched) must NOT push the
      // Out Day time into the Out Lunch slot. If a type repeats, the latest
      // punch of that type wins. When there is no In Day label at all, or the
      // labels contradict the clock order, fall back to Paycom's own
      // sequential reading (1st=In Day, 2nd=Out Lunch, 3rd=In Lunch, 4th=Out Day).
      const byType = new Map<string, { type: string; time: string; parsed: { minutes: number; hhmm: string } }>();
      for (const p of withMinutes) byType.set(p.type, p as any);
      const ordered = POSITION_TYPES.filter((t) => byType.has(t)).map((t) => byType.get(t)!);
      const labelsConsistent =
        byType.has("ID") && ordered.every((p, i) => i === 0 || p.parsed.minutes >= ordered[i - 1].parsed.minutes);

      const values: Record<string, string> = {};
      const corrections: string[] = [];
      const present: string[] = [];
      if (labelsConsistent) {
        POSITION_TYPES.forEach((t, idx) => {
          const p = byType.get(t);
          if (p) { values[POSITION_FIELDS[idx]] = p.parsed.hhmm; present.push(t); }
        });
        const dupes = withMinutes.length - ordered.length;
        if (dupes > 0) corrections.push(`${dupes} repeated punch${dupes > 1 ? "es" : ""} — kept the latest of each type`);
      } else {
        const seq = withMinutes.slice(0, 4);
        seq.forEach((p, idx) => {
          values[POSITION_FIELDS[idx]] = (p.parsed as any).hhmm;
          present.push(POSITION_TYPES[idx]);
          if (p.type !== POSITION_TYPES[idx]) {
            corrections.push(`labeled "${p.type}" at ${p.time}, treated as ${POSITION_TYPES[idx] === "ID" ? "In Day" : POSITION_TYPES[idx] === "OL" ? "Out Lunch" : POSITION_TYPES[idx] === "IL" ? "In Lunch" : "Out Day"} by time order`);
          }
        });
        if (withMinutes.length > 4) corrections.push(`${withMinutes.length} punches recorded — used the first four by time; review`);
      }
      if (ignoredNonClock > 0) corrections.push(`${ignoredNonClock} non-clock entr${ignoredNonClock > 1 ? "ies" : "y"} (e.g. HR hours) ignored`);

      const route = await SYMXRoute.findOne({ transporterId: employee.transporterId, date: dateObj, ...S }, { _id: 1, paycomInDay: 1, paycomOutLunch: 1, paycomInLunch: 1, paycomOutDay: 1 }).lean();
      if (!route) {
        exceptions.push({
          eeCode: group.eeCode,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          transporterId: employee.transporterId,
          dateRaw: group.dateRaw,
          employeeStatus: employee.status || "Active",
          reason: "No SYMX route found for this employee on this date (nothing to write the punches onto)",
          punches: activePunches,
        });
        continue;
      }

      clean.push({
        eeCode: group.eeCode,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeStatus: employee.status || "Active",
        transporterId: employee.transporterId,
        date: dateObj.toISOString(),
        dateRaw: group.dateRaw,
        ...values,
        punchesPresent: present,
        complete: present.length === 4,
        corrections,
        currentValues: {
          paycomInDay: (route as any).paycomInDay || "",
          paycomOutLunch: (route as any).paycomOutLunch || "",
          paycomInLunch: (route as any).paycomInLunch || "",
          paycomOutDay: (route as any).paycomOutDay || "",
        },
        deletedExcluded: deletedCount,
      });
    }

    return NextResponse.json({
      success: true,
      totalEmployeeDays: groups.size,
      skippedOtherStations,
      clean,
      exceptions,
      summary: {
        clean: clean.length,
        exceptions: exceptions.length,
      },
    });
  } catch (error: any) {
    console.error("[Punch Import] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse punch report" }, { status: 500 });
  }
}
