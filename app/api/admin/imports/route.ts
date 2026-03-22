
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxPhotoOnDelivery from "@/lib/models/SymxPhotoOnDelivery";
import SymxDVICVehicleInspection from "@/lib/models/SymxDVICVehicleInspection";
import SymxSafetyDashboardDFO2 from "@/lib/models/SymxSafetyDashboardDFO2";
import ScoreCardQualityDSBDNR from "@/lib/models/ScoreCardQualityDSBDNR";
import ScoreCardDCR from "@/lib/models/ScoreCardDCR";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import ScoreCardRTS from "@/lib/models/ScoreCardRTS";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import SymxIncident from "@/lib/models/SymxIncident";
import SymxHrTicket from "@/lib/models/SymxHrTicket";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import DailyInspection from "@/lib/models/DailyInspection";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import DropdownOption from "@/lib/models/DropdownOption";
import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

const reimbursementHeaderMap: Record<string, string> = {
    // Current CSV headers (camelCase)
    "transporterId": "transporterId",
    "date": "date",
    "amount": "amount",
    "reason": "notes",
    "attachment": "attachment",
    "status": "status",
    "createdBy": "createdBy",
    "createdAt": "createdAt",
    // Legacy/alternative headers (backward compatibility)
    "Transporter ID": "transporterId",
    "Date of Expense": "date",
    "Date": "date",
    "Amount": "amount",
    "Reason": "notes",
    "Attachment": "attachment",
    "Status": "status",
    "Employee Name": "employeeName",
    "Category": "category",
    "Description": "description",
    "Receipt Number": "receiptNumber",
    "Approved By": "approvedBy",
    "Notes": "notes",
};

const claimsHeaderMap: Record<string, string> = {
    "ReportedDate": "reportedDate",
    "IncidentDate": "incidentDate",
    "Transporter ID": "transporterId",
    "ClaimType": "claimType",
    "Van": "van",
    "ClaimantName": "claimantName",
    "ShortDescription": "shortDescription",
    "ClaimNumber": "claimNumber",
    "ClaimantLawyer": "claimantLawyer",
    "ClaimStatus": "claimStatus",
    "StatusDetail": "statusDetail",
    "CoverageDescription": "coverageDescription",
    "ClaimIncurred": "claimIncurred",
    "Employee Notes": "employeeNotes",
    "Supervisor Notes": "supervisorNotes",
    "Third Party Name": "thirdPartyName",
    "Third Party Phone": "thirdPartyPhone",
    "Third Party Email": "thirdPartyEmail",
    "With Insurance": "withInsurance",
    "Insurance Policy": "insurancePolicy",
    "Paid": "paid",
    "Reserved": "reserved",
    "createdBy": "createdBy",
    "createdAt": "createdAt",
    "IncidentUploadFile": "incidentUploadFile",
};

const hrTicketsHeaderMap: Record<string, string> = {
    "createdAt": "createdAt",
    "Ticket #": "ticketNumber",
    "Transporter ID": "transporterId",
    "Category": "category",
    "Issue": "issue",
    "Attachment": "attachment",
    "Managers Email": "managersEmail",
    "Notes": "notes",
    "Approve / Deny": "approveDeny",
    "Resolution": "resolution",
    "Hold Reason": "holdReason",
    "Closed DateTime": "closedDateTime",
    "Closed By": "closedBy",
    "Closed Ticket Sent": "closedTicketSent",
    // camelCase alternatives
    "ticketNumber": "ticketNumber",
    "transporterId": "transporterId",
    "category": "category",
    "issue": "issue",
    "attachment": "attachment",
    "managersEmail": "managersEmail",
    "notes": "notes",
    "approveDeny": "approveDeny",
    "resolution": "resolution",
    "holdReason": "holdReason",
    "closedDateTime": "closedDateTime",
    "closedBy": "closedBy",
    "closedTicketSent": "closedTicketSent",
};

// Helper to sanitize keys (remove whitespace, special chars if needed) - not strictly needed if we map manually
// But manual mapping is safer for exact matches.
const deliveryExcellenceHeaderMap: Record<string, string> = {
    "Week": "week",
    "Delivery Associate": "deliveryAssociate",
    "Transporter ID": "transporterId",
    "Overall Standing": "overallStanding",
    "Overall Score": "overallScore",
    "FICO Metric": "ficoMetric",
    "FICO Tier": "ficoTier",
    "FICO Score": "ficoScore",
    "Speeding Event Rate (per trip)": "speedingEventRate",
    "Speeding Event Rate Tier": "speedingEventRateTier",
    "Speeding Event Rate Score": "speedingEventRateScore",
    "Seatbelt-Off Rate (per trip)": "seatbeltOffRate",
    "Seatbelt-Off Rate Tier": "seatbeltOffRateTier",
    "Seatbelt-Off Rate Score": "seatbeltOffRateScore",
    "Distractions Rate (per trip)": "distractionsRate",
    "Distractions Rate Tier": "distractionsRateTier",
    "Distractions Rate Score": "distractionsRateScore",
    "Sign/ Signal Violations Rate (per trip)": "signSignalViolationsRate",
    "Sign/ Signal Violations Rate Tier": "signSignalViolationsRateTier",
    "Sign/ Signal Violations Rate Score": "signSignalViolationsRateScore",
    "Following Distance Rate (per trip)": "followingDistanceRate",
    "Following Distance Rate Tier": "followingDistanceRateTier",
    "Following Distance Rate Score": "followingDistanceRateScore",
    "CDF DPMO": "cdfDpmo",
    "CDF DPMO Tier": "cdfDpmoTier",
    "CDF DPMO Score": "cdfDpmoScore",
    "CED": "ced",
    "CED Tier": "cedTier",
    "CED Score": "cedScore",
    "DCR": "dcr",
    "DCR Tier": "dcrTier",
    "DCR Score": "dcrScore",
    "DSB": "dsb",
    "DSB DPMO Tier": "dsbDpmoTier",
    "DSB DPMO Score": "dsbDpmoScore",
    "POD": "pod",
    "POD Tier": "podTier",
    "POD Score": "podScore",
    "PSB": "psb",
    "PSB Tier": "psbTier",
    "PSB Score": "psbScore",
    "Packages Delivered": "packagesDelivered",
    "FICO Metric Weight Applied": "ficoMetricWeightApplied",
    "Speeding Event Rate Weight Applied": "speedingEventRateWeightApplied",
    "Seatbelt-Off Rate Weight Applied": "seatbeltOffRateWeightApplied",
    "Distractions Rate Weight Applied": "distractionsRateWeightApplied",
    "Sign/ Signal Violations Rate Weight Applied": "signSignalViolationsRateWeightApplied",
    "Following Distance Rate Weight Applied": "followingDistanceRateWeightApplied",
    "CDF DPMO Weight Applied": "cdfDpmoWeightApplied",
    "CED Weight Applied": "cedWeightApplied",
    "DCR Weight Applied": "dcrWeightApplied",
    "DSB DPMO Weight Applied": "dsbDpmoWeightApplied",
    "POD Weight Applied": "podWeightApplied",
    "PSB Weight Applied": "psbWeightApplied"
};

const safeParseFloat = (val: any) => {
    if (!val) return undefined;
    if (typeof val === 'number') return val;
    const str = val.toString().trim().replace('%', '');
    if (str === '') return undefined;
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
};

// Function to normalize POD CSV headers (handling newlines)
const normalizePodHeader = (header: string) => {
    return header.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const podHeaderMap: Record<string, string> = {
    "Transporter Id": "transporterId",
    "Transporter ID": "transporterId",
    "Opportunities": "opportunities",
    "Success": "success",
    "Bypass": "bypass",
    "Rejects": "rejects",
    "Blurry Photo": "blurryPhoto",
    "Human In The Picture": "humanInThePicture",
    "No Package Detected": "noPackageDetected",
    "Package In Car": "packageInCar",
    "Package In Hand": "packageInHand",
    "Package Not Clearly Visible": "packageNotClearlyVisible",
    "Package Too Close": "packageTooClose",
    "Photo Too Dark": "photoTooDark",
    "Other": "other"
};


const dvicHeaderMap: Record<string, string> = {
    "start_date": "startDate",
    "dsp": "dsp",
    "station": "station",
    "transporter_id": "transporterId",
    "transporter_name": "transporterName",
    "vin": "vin",
    "fleet_type": "fleetType",
    "inspection_type": "inspectionType",
    "inspection_status": "inspectionStatus",
    "start_time": "startTime",
    "end_time": "endTime",
    "duration": "duration",
};

const safetyDashboardHeaderMap: Record<string, string> = {
    "Date": "date",
    "Delivery Associate": "deliveryAssociate",
    "Delivery Associate ": "deliveryAssociate",
    "Transporter ID": "transporterId",
    "Event ID": "eventId",
    "Date Time (PDT/PST)": "dateTime",
    "VIN": "vin",
    "Program Impact": "programImpact",
    "Metric Type": "metricType",
    "Metric Subtype": "metricSubtype",
    "Source": "source",
    "Video Link": "videoLink",
    "Review Details": "reviewDetails",
};

const qualityDSBDNRHeaderMap: Record<string, string> = {
    "Week": "week",
    "Delivery Associate": "deliveryAssociate",
    "Delivery Associate ": "deliveryAssociate",
    "Transporter ID": "transporterId",
    "DSB Count": "dsbCount",
    "DSB DPMO": "dsbDpmo",
    "Attended Delivery Count": "attendedDeliveryCount",
    "Unattended Delivery Count": "unattendedDeliveryCount",
    "Simultaneous Deliveries": "simultaneousDeliveries",
    "Delivered > 50 m": "deliveredOver50m",
    "Incorrect Scan Usage - Attended Delivery": "incorrectScanUsageAttended",
    "Incorrect Scan Usage - Unattended Delivery": "incorrectScanUsageUnattended",
    "No POD on Delivery": "noPodOnDelivery",
    "Scanned - Not Delivered - Not Returned": "scannedNotDeliveredNotReturned",
};

const dcrHeaderMap: Record<string, string> = {
    "Week": "week",
    "Delivery Associate": "deliveryAssociate",
    "Delivery Associate ": "deliveryAssociate",
    "Transporter ID": "transporterId",
    "DCR": "dcr",
    "Packages Delivered": "packagesDelivered",
    "Packages Dispatched": "packagesDispatched",
    "Packages Returned To Station": "packagesReturnedToStation",
    "Packages Returned to Station - DA Controllable": "packagesReturnedDAControllable",
    "RTS All Exempted": "rtsAllExempted",
    "RTS Business Closed": "rtsBusinessClosed",
    "RTS Customer Unavailable": "rtsCustomerUnavailable",
    "RTS No Secure Location": "rtsNoSecureLocation",
    "RTS Other": "rtsOther",
    "RTS Out of Drive Time": "rtsOutOfDriveTime",
    "RTS Unable To Access": "rtsUnableToAccess",
    "RTS Unable To Locate": "rtsUnableToLocate",
    "RTS Unsafe Due to Dog": "rtsUnsafeDueToDog",
    "RTS Bad Weather": "rtsBadWeather",
    "RTS Locker Issue": "rtsLockerIssue",
    "RTS Missing or Incorrect Access Code": "rtsMissingOrIncorrectAccessCode",
    "RTS OTP Not Available": "rtsOtpNotAvailable",
};

const cdfNegativeHeaderMap: Record<string, string> = {
    "Delivery Group ID": "deliveryGroupId",
    "Delivery Associate": "deliveryAssociate",
    "Delivery Associate Name": "deliveryAssociateName",
    "DA Mishandled Package": "daMishandledPackage",
    "DA was Unprofessional": "daWasUnprofessional",
    "DA did not follow my delivery instructions": "daDidNotFollowInstructions",
    "Delivered to Wrong Address": "deliveredToWrongAddress",
    "Never Received Delivery": "neverReceivedDelivery",
    "Received Wrong Item": "receivedWrongItem",
    "Feedback Details": "feedbackDetails",
    "Tracking ID": "trackingId",
    "Delivery Date": "deliveryDate",
};

const rtsHeaderMap: Record<string, string> = {
    "Delivery Associate": "deliveryAssociate",
    "Tracking ID": "trackingId",
    "Transporter ID": "transporterId",
    "Impact DCR": "impactDcr",
    "RTS Code": "rtsCode",
    "Customer Contact Details": "customerContactDetails",
    "Planned Delivery Date": "plannedDeliveryDate",
    "Exemption Reason": "exemptionReason",
    "Service Area": "serviceArea",
};

/**
 * Convert a date string like "2026-01-25" to ISO week format "2026-W04"
 */
function dateToISOWeek(dateStr: string): string | null {
    try {
        const date = parseISO(dateStr);
        if (isNaN(date.getTime())) return null;
        const weekYear = getISOWeekYear(date);
        const weekNum = getISOWeek(date);
        return `${weekYear}-W${weekNum.toString().padStart(2, '0')}`;
    } catch {
        return null;
    }
}

/**
 * Compute yearWeek (Sunday-based) from a date string.
 * Weeks run Sun–Sat, matching getWeekDates() used throughout the app.
 * Returns "YYYY-WXX" or null if parsing fails.
 */
/** Timezone-safe date parser: extracts the calendar date the user intended
 *  (using local getters) and stores as UTC midnight. This prevents the -1 day
 *  shift that occurs when CSV parsers create Date objects at local midnight
 *  in positive UTC-offset timezones. */
function parseToUTCMidnight(value: any): Date | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    let y = 0, m = 0, d = 0;
    // M/D/YYYY or MM/DD/YYYY
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    // YYYY-MM-DD
    const dashMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (slashMatch) {
        m = parseInt(slashMatch[1]);
        d = parseInt(slashMatch[2]);
        y = parseInt(slashMatch[3]);
    } else if (dashMatch) {
        y = parseInt(dashMatch[1]);
        m = parseInt(dashMatch[2]);
        d = parseInt(dashMatch[3]);
    } else {
        // Fallback: parse and use LOCAL date components (not UTC)
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
            y = parsed.getFullYear();
            m = parsed.getMonth() + 1;
            d = parsed.getDate();
        }
    }

    if (y > 0 && m > 0 && d > 0) {
        return new Date(Date.UTC(y, m - 1, d));
    }
    return null;
}

function dateToSundayWeek(dateStr: string): string | null {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;

        // Sunday-based week: Sunday is the FIRST day of the week
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const year = d.getUTCFullYear();
        // Find Jan 1 and the Sunday on or before it (= start of W01)
        const jan1 = new Date(Date.UTC(year, 0, 1));
        const jan1Day = jan1.getUTCDay(); // 0=Sun..6=Sat
        const w01Start = new Date(jan1);
        w01Start.setUTCDate(jan1.getUTCDate() - jan1Day);
        // Days from W01 start to this date
        const diffDays = Math.floor((d.getTime() - w01Start.getTime()) / 86400000);
        const weekNum = Math.floor(diffDays / 7) + 1;
        return `${year}-W${weekNum.toString().padStart(2, '0')}`;
    } catch {
        return null;
    }
}

const employeeScheduleHeaderMap: Record<string, string> = {
    // Spaced headers
    "Week Day": "weekDay",
    "Year Week": "yearWeek",
    "Transporter ID": "transporterId",
    " Transporter ID": "transporterId",
    "Date": "date",
    "Status": "status",
    "Type": "type",
    "Sub Type": "subType",
    "Training Day": "trainingDay",
    "Start Time": "startTime",
    "Day Before Confirmation": "dayBeforeConfirmation",
    "Day Of Confirmation": "dayOfConfirmation",
    "Week Confirmation": "weekConfirmation",
    "Van": "van",
    "Note": "note",
    // camelCase headers (from exported CSV)
    "weekDay": "weekDay",
    "yearWeek": "yearWeek",
    "transporterId": "transporterId",
    "date": "date",
    "status": "status",
    "subType": "subType",
    "trainingDay": "trainingDay",
    "startTime": "startTime",
    "dayBeforeConfirmation": "dayBeforeConfirmation",
    "dayOfConfirmation": "dayOfConfirmation",
    "weekConfirmation": "weekConfirmation",
    "van": "van",
    "note": "note",
};

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { type, data, week } = body; // Add week destructured

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        await connectToDatabase();

        // Register the week in the available weeks collection
        if (week) {
            await SymxAvailableWeek.updateOne({ week }, { $set: { week } }, { upsert: true });
        }

        if (type === "employees") {
            // Get schema paths to dynamically handle types
            const paths = SymxEmployee.schema.paths;

            const operations = data.map((employee: any) => {
                const { _id, ...rawData } = employee;

                const processedData: any = {};

                Object.keys(rawData).forEach((key) => {
                    const value = rawData[key];
                    const schemaPath = paths[key];

                    if (!schemaPath) {
                        // Field not in schema, keep as is if not empty
                        if (value !== undefined && value !== null && value !== "") {
                            processedData[key] = value;
                        }
                        return;
                    }

                    const instance = schemaPath.instance;

                    if (instance === "Boolean") {
                        const valStr = value?.toString().toLowerCase().trim();
                        processedData[key] = valStr === "true" || valStr === "yes" || valStr === "1";
                    } else if (instance === "Date") {
                        if (value && value.toString().trim() !== "") {
                            try {
                                const utcDate = parseToUTCMidnight(value);
                                if (utcDate) {
                                    processedData[key] = utcDate;
                                }
                            } catch (e) {
                                // Ignore invalid dates
                            }
                        }
                    } else if (instance === "Number") {
                        if (value && value.toString().trim() !== "") {
                            const num = parseFloat(value);
                            if (!isNaN(num)) processedData[key] = num;
                        }
                    } else {
                        // Treatment for String and others
                        if (value !== undefined && value !== null) {
                            processedData[key] = value.toString();
                        }
                    }
                });

                // Determine upsert filter: prefer email, fallback to transporterId
                let filter: Record<string, string> | null = null;
                if (processedData.email && processedData.email.trim()) {
                    filter = { email: processedData.email };
                } else if (processedData.transporterId && processedData.transporterId.trim()) {
                    filter = { transporterId: processedData.transporterId };
                } else {
                    return null; // Skip records with neither email nor transporterId
                }

                return {
                    updateOne: {
                        filter,
                        update: { $set: processedData },
                        upsert: true,
                    },
                };
            }).filter((op): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                try {
                    const result = await SymxEmployee.bulkWrite(operations, { ordered: false });
                    return NextResponse.json({
                        success: true,
                        count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                        inserted: result.upsertedCount || 0,
                        updated: result.modifiedCount || 0,
                        matched: result.matchedCount
                    });
                } catch (bulkErr: any) {
                    // With ordered:false, partial success is possible
                    console.error("Employee bulkWrite error:", bulkErr.message);
                    if (bulkErr.result) {
                        return NextResponse.json({
                            success: true,
                            count: (bulkErr.result.nUpserted || 0) + (bulkErr.result.nModified || 0),
                            inserted: bulkErr.result.nUpserted || 0,
                            updated: bulkErr.result.nModified || 0,
                            errors: bulkErr.result.getWriteErrors?.()?.length || 0,
                        });
                    }
                    return NextResponse.json({ error: bulkErr.message || "Import failed" }, { status: 500 });
                }
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Delivery Excellence Import ──
        else if (type === "delivery-excellence") {
            // 1. Gather all Transporter IDs to fetch Employees
            const transporterIds = data
                .map((row: any) => row["Transporter ID"])
                .filter((id: any) => id); // Filter out empty/null

            // 2. Fetch Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();

            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows
            const operations = data.map((row: any) => {
                const transporterId = row["Transporter ID"];
                const rowWeek = row["Week"]; // Use row week for this type

                if (!transporterId || !rowWeek) return null; // Skip invalid rows

                const processedData: any = {};

                // Map CSV headers to Schema fields
                Object.entries(row).forEach(([header, value]) => {
                    const schemaKey = deliveryExcellenceHeaderMap[header.trim()];
                    if (schemaKey) {
                        if (
                            schemaKey.endsWith('Score') ||
                            schemaKey.endsWith('Rate') ||
                            schemaKey.endsWith('Metric') ||
                            schemaKey.endsWith('WeightApplied') ||
                            schemaKey === 'overallScore' ||
                            schemaKey === 'packagesDelivered' ||
                            schemaKey === 'cdfDpmo' ||
                            schemaKey === 'ced' ||
                            schemaKey === 'dsb' ||
                            schemaKey === 'psb'
                        ) {
                            processedData[schemaKey] = safeParseFloat(value);
                        } else {
                            // Strings (Tiers, IDs, etc)
                            if (value !== undefined && value !== null && value !== "") {
                                processedData[schemaKey] = value.toString().trim();
                            }
                        }
                    }
                });

                // Link Employee if found
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                // Construct Upsert Operation
                return {
                    updateOne: {
                        filter: { week: processedData.week, transporterId: processedData.transporterId },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxDeliveryExcellence.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Photo On Delivery Import ──
        else if (type === "import-pod") {
            if (!week) {
                return NextResponse.json({ error: "Week is required for POD import" }, { status: 400 });
            }

            // 1. Gather Transporter IDs (support both "Transporter Id" and "Transporter ID")
            const transporterIds = data
                .map((row: any) => (row["Transporter Id"] || row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            // 2. Fetch Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();

            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows
            const operations = data.map((row: any) => {
                const transporterId = (row["Transporter Id"] || row["Transporter ID"] || "").toString().trim();

                if (!transporterId) return null;

                const processedData: any = {
                    week: week, // Use the passed week
                    transporterId: transporterId
                };

                // Map Headers
                Object.entries(row).forEach(([header, value]) => {
                    // Normalize header (newlines to spaces)
                    const normalizedHeader = normalizePodHeader(header);
                    const schemaKey = podHeaderMap[normalizedHeader];

                    if (schemaKey) {
                        if (schemaKey === 'transporterId') {
                            if (value !== undefined && value !== null) processedData[schemaKey] = value.toString().trim();
                        } else {
                            // Numeric stats
                            processedData[schemaKey] = safeParseFloat(value) || 0;
                        }
                    }
                });

                // Link Employee
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: { week: processedData.week, transporterId: processedData.transporterId },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxPhotoOnDelivery.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }


        // ── DVIC Vehicle Inspection Times Import ──
        else if (type === "dvic-vehicle-inspection") {
            // 1. Gather Transporter IDs
            const transporterIds = data
                .map((row: any) => (row["transporter_id"] || "").toString().trim())
                .filter((id: string) => id);

            // 2. Fetch Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();

            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows — use passed week, fallback to auto-calculate from start_date
            const operations = data.map((row: any) => {
                const transporterId = (row["transporter_id"] || "").toString().trim();
                const startDate = (row["start_date"] || "").toString().trim();

                if (!transporterId) return null;

                // DVIC: Always derive week from startDate (Sunday-based), ignore the passed week
                const recordWeek = startDate ? dateToSundayWeek(startDate) : null;
                if (!recordWeek) return null; // Skip rows without a valid startDate

                const processedData: any = {
                    week: recordWeek,
                    transporterId,
                };

                // Map Headers
                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim().toLowerCase();
                    // Find matching key in dvicHeaderMap (case-insensitive)
                    const matchKey = Object.keys(dvicHeaderMap).find(k => k.toLowerCase() === normalizedHeader);
                    if (matchKey) {
                        const schemaKey = dvicHeaderMap[matchKey];
                        if (value !== undefined && value !== null && value !== "") {
                            processedData[schemaKey] = value.toString().trim();
                        }
                    }
                });

                // Link Employee
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: {
                            week: processedData.week,
                            transporterId: processedData.transporterId,
                            vin: processedData.vin || '',
                            startTime: processedData.startTime || '',
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxDVICVehicleInspection.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Safety Dashboard Import ──
        else if (type === "safety-dashboard-dfo2") {
            if (!week) {
                return NextResponse.json({ error: "Week is required for Safety Dashboard import" }, { status: 400 });
            }

            // 1. Gather Transporter IDs
            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            // 2. Fetch Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();

            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows
            const operations = data.map((row: any) => {
                const processedData: any = { week };

                // Map Headers
                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = safetyDashboardHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        processedData[schemaKey] = value.toString().trim();
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                // Link Employee
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: {
                            week: processedData.week,
                            transporterId: processedData.transporterId,
                            eventId: processedData.eventId || '',
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxSafetyDashboardDFO2.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Quality DSB DNR Import ──
        else if (type === "quality-dsb-dnr") {
            if (!week) {
                return NextResponse.json({ error: "Week is required for Quality DSB DNR import" }, { status: 400 });
            }

            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            const operations = data.map((row: any) => {
                const processedData: any = { week };

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = qualityDSBDNRHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        const val = value.toString().trim();
                        // Numeric fields
                        if (["dsbCount", "dsbDpmo", "attendedDeliveryCount", "unattendedDeliveryCount", "simultaneousDeliveries", "deliveredOver50m", "incorrectScanUsageAttended", "incorrectScanUsageUnattended", "noPodOnDelivery", "scannedNotDeliveredNotReturned"].includes(schemaKey)) {
                            processedData[schemaKey] = parseFloat(val) || 0;
                        } else if (schemaKey !== "week") {
                            processedData[schemaKey] = val;
                        }
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: { week, transporterId },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await ScoreCardQualityDSBDNR.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Quality DCR Import ──
        else if (type === "quality-dcr") {
            if (!week) {
                return NextResponse.json({ error: "Week is required for Quality DCR import" }, { status: 400 });
            }

            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            const numericFields = ["dcr", "packagesDelivered", "packagesDispatched", "packagesReturnedToStation", "packagesReturnedDAControllable", "rtsAllExempted", "rtsBusinessClosed", "rtsCustomerUnavailable", "rtsNoSecureLocation", "rtsOther", "rtsOutOfDriveTime", "rtsUnableToAccess", "rtsUnableToLocate", "rtsUnsafeDueToDog", "rtsBadWeather", "rtsLockerIssue", "rtsMissingOrIncorrectAccessCode", "rtsOtpNotAvailable"];

            const operations = data.map((row: any) => {
                const processedData: any = { week };

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = dcrHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        const val = value.toString().trim();
                        if (numericFields.includes(schemaKey)) {
                            processedData[schemaKey] = parseFloat(val) || 0;
                        } else if (schemaKey !== "week") {
                            processedData[schemaKey] = val;
                        }
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: { week, transporterId },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await ScoreCardDCR.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── CDF Negative Import ──
        else if (type === "cdf-negative") {
            if (!week) {
                return NextResponse.json({ error: "Week is required for CDF Negative import" }, { status: 400 });
            }

            // CDF Negative uses "Delivery Associate" as the transporter ID
            const transporterIds = data
                .map((row: any) => (row["Delivery Associate"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            const operations = data.map((row: any) => {
                const processedData: any = { week };

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = cdfNegativeHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        processedData[schemaKey] = value.toString().trim();
                    }
                });

                const deliveryAssociate = processedData.deliveryAssociate;
                if (!deliveryAssociate) return null;

                // Set transporterId from deliveryAssociate (which is actually the transporter ID in this CSV)
                processedData.transporterId = deliveryAssociate;

                if (employeeMap.has(deliveryAssociate)) {
                    processedData.employeeId = employeeMap.get(deliveryAssociate);
                }

                return {
                    updateOne: {
                        filter: {
                            week,
                            deliveryAssociate,
                            trackingId: processedData.trackingId || '',
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await ScoreCardCDFNegative.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Return to Station (RTS) Import ──
        else if (type === "rts") {
            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            const operations = data.map((row: any) => {
                const processedData: any = {};

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = rtsHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        processedData[schemaKey] = value.toString().trim();
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                // Derive week from Planned Delivery Date using Sunday-based week
                const plannedDate = processedData.plannedDeliveryDate;
                const computedWeek = plannedDate ? dateToSundayWeek(plannedDate) : (week || null);
                if (!computedWeek) return null;
                processedData.week = computedWeek;

                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: {
                            week: computedWeek,
                            transporterId,
                            trackingId: processedData.trackingId || '',
                            plannedDeliveryDate: processedData.plannedDeliveryDate || '',
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            // Register computed weeks
            const rtsWeeks = new Set<string>();
            operations.forEach((op: any) => { if (op.updateOne.filter.week) rtsWeeks.add(op.updateOne.filter.week); });
            for (const w of rtsWeeks) {
                await SymxAvailableWeek.updateOne({ week: w }, { $set: { week: w } }, { upsert: true });
            }

            if (operations.length > 0) {
                const result = await ScoreCardRTS.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Employee Schedules Import ──
        else if (type === "employee-schedules") {
            // 1. Gather Transporter IDs
            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || row[" Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            // 2. Fetch matching Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1, firstName: 1, lastName: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows
            const operations = data.map((row: any) => {
                const processedData: any = {};

                // Map headers
                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = employeeScheduleHeaderMap[normalizedHeader] || employeeScheduleHeaderMap[header];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        processedData[schemaKey] = value.toString().trim();
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                // Parse the date field — timezone-safe, store as UTC midnight
                let dateVal: Date | null = null;
                if (processedData.date) {
                    let y = 0, m = 0, d = 0;
                    const rawVal = processedData.date;

                    // If CSV parser already converted to a Date object (toString'd),
                    // try to match common string formats first
                    const raw = String(rawVal).trim();
                    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    const dashMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

                    if (slashMatch) {
                        // M/D/YYYY or MM/DD/YYYY
                        m = parseInt(slashMatch[1]);
                        d = parseInt(slashMatch[2]);
                        y = parseInt(slashMatch[3]);
                    } else if (dashMatch) {
                        // YYYY-MM-DD
                        y = parseInt(dashMatch[1]);
                        m = parseInt(dashMatch[2]);
                        d = parseInt(dashMatch[3]);
                    } else {
                        // Fallback: parse with Date and extract LOCAL components
                        // (CSV parsers create Dates at midnight LOCAL time,
                        //  so local getters give the correct calendar date)
                        const parsed = new Date(raw);
                        if (!isNaN(parsed.getTime())) {
                            y = parsed.getFullYear();
                            m = parsed.getMonth() + 1;
                            d = parsed.getDate();
                        }
                    }

                    if (y > 0 && m > 0 && d > 0) {
                        dateVal = new Date(Date.UTC(y, m - 1, d));
                        processedData.date = dateVal;
                    }
                }
                if (!dateVal) return null;

                // Always compute yearWeek from the date for consistency
                // (CSV may use ISO weeks which differ from our Sun-based weeks)
                const computedWeek = dateToSundayWeek(dateVal.toISOString());
                if (computedWeek) {
                    processedData.yearWeek = computedWeek;
                }

                // Link Employee
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return {
                    updateOne: {
                        filter: {
                            transporterId: processedData.transporterId,
                            date: processedData.date,
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxEmployeeSchedule.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Reimbursement Import ──
        else if (type === "reimbursement") {
            // 1. Gather Transporter IDs (support both camelCase and legacy headers)
            const transporterIds = data
                .map((row: any) => (row["transporterId"] || row["Transporter ID"] || "").toString().trim())
                .filter((id: string) => id);

            // 2. Fetch matching Employees
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // 3. Process Rows
            const operations = data.map((row: any) => {
                const processedData: any = {};

                // Map headers
                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = reimbursementHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        if (schemaKey === 'amount') {
                            const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
                            if (!isNaN(num)) processedData[schemaKey] = num;
                        } else if (schemaKey === 'date' || schemaKey === 'createdAt') {
                            const parsed = new Date(value.toString());
                            if (!isNaN(parsed.getTime())) {
                                if (schemaKey === 'date') {
                                    const utcDate = parseToUTCMidnight(value);
                                    if (utcDate) {
                                        processedData[schemaKey] = utcDate;
                                        const computedWeek = dateToSundayWeek(utcDate.toISOString());
                                        if (computedWeek) processedData.week = computedWeek;
                                    }
                                } else {
                                    processedData[schemaKey] = parsed;
                                }
                            }
                        } else {
                            processedData[schemaKey] = value.toString().trim();
                        }
                    }
                });

                const transporterId = processedData.transporterId;
                if (!transporterId) return null;

                // Link Employee
                if (employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                // Use transporterId + date for upsert deduplication
                const filter: any = { transporterId: processedData.transporterId };
                if (processedData.date) filter.date = processedData.date;

                return {
                    updateOne: {
                        filter,
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await SymxReimbursement.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Claims Import ──
        else if (type === "claims") {
            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || row["transporterId"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // Build case-insensitive header lookup
            const ciHeaderMap: Record<string, string> = {};
            Object.entries(claimsHeaderMap).forEach(([k, v]) => { ciHeaderMap[k.toLowerCase()] = v; });

            const documents = data.map((row: any) => {
                const processedData: any = {};

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = ciHeaderMap[normalizedHeader.toLowerCase()] || claimsHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        if (schemaKey === 'paid' || schemaKey === 'reserved') {
                            const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
                            if (!isNaN(num)) processedData[schemaKey] = num;
                        } else if (schemaKey === 'reportedDate' || schemaKey === 'incidentDate' || schemaKey === 'createdAt') {
                            const parsed = new Date(value.toString());
                            if (!isNaN(parsed.getTime())) processedData[schemaKey] = parsed;
                        } else if (schemaKey === 'withInsurance') {
                            const val = value.toString().trim().toUpperCase();
                            processedData[schemaKey] = val === 'TRUE' || val === 'YES' || val === '1';
                        } else {
                            processedData[schemaKey] = value.toString().trim();
                        }
                    }
                });

                const transporterId = processedData.transporterId;

                // Link employee if transporterId is present
                if (transporterId && employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return processedData;
            }).filter((doc: any): doc is NonNullable<typeof doc> => doc !== null);

            if (documents.length > 0) {
                const result = await SymxIncident.insertMany(documents, { ordered: false });
                return NextResponse.json({
                    success: true,
                    count: result.length,
                    inserted: result.length,
                    updated: 0,
                    matched: 0
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Fleet Records Import ──
        else if (type === "fleet-records") {
            const fleetHeaderMap: Record<string, string> = {
                "VIN": "vin",
                "Year": "year",
                "Vehicle Name": "vehicleName",
                "License Plate": "licensePlate",
                "Make": "make",
                "Model": "vehicleModel",
                "Status": "status",
                "Mileage": "mileage",
                "Service Type": "serviceType",
                "Dashcam": "dashcam",
                "Vehicle Provider": "vehicleProvider",
                "Ownership": "ownership",
                "Unit #": "unitNumber",
                "Start Date": "startDate",
                "End Date": "endDate",
                "Registration Expiration": "registrationExpiration",
                "State": "state",
                "Location": "location",
                "Location ": "location",
                "Notes": "notes",
                "Info": "info",
                "Image": "image",
                "Location From": "locationFrom",
            };

            const dateFields = new Set(["startDate", "endDate", "registrationExpiration"]);
            const numericFields = new Set(["mileage"]);

            const operations = data.map((row: any) => {
                const processedData: any = {};

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = fleetHeaderMap[normalizedHeader] || fleetHeaderMap[header];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        const val = value.toString().trim();
                        if (dateFields.has(schemaKey)) {
                            const utcDate = parseToUTCMidnight(val);
                            if (utcDate) {
                                processedData[schemaKey] = utcDate;
                            }
                        } else if (numericFields.has(schemaKey)) {
                            const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
                            if (!isNaN(num)) processedData[schemaKey] = num;
                        } else {
                            processedData[schemaKey] = val;
                        }
                    }
                });

                const vin = processedData.vin;
                if (!vin) return null;

                return {
                    updateOne: {
                        filter: { vin },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await Vehicle.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Fleet Repairs Import ──
        else if (type === "fleet-repairs") {
            const repairHeaderMap: Record<string, string> = {
                "VIN": "vin",
                "Description": "description",
                "Current Status": "currentStatus",
                "Estimated Date": "estimatedDate",
                "Image": "image",
                "Creation Date": "creationDate",
                "LastEditOn": "lastEditOn",
                "Repair": "description",        // fallback if "Description" is absent
                "Repair Duration": "repairDuration", // actual CSV column name
                "Duration": "repairDuration",   // fallback alias
            };

            const dateFields = new Set(["estimatedDate", "creationDate", "lastEditOn"]);
            const numericFields = new Set(["repairDuration"]);

            // 1. Gather all VINs to look up the Vehicle references
            const vins = data
                .map((row: any) => (row["VIN"] || "").toString().trim())
                .filter((v: string) => v);

            const vehicles = await Vehicle.find(
                { vin: { $in: vins } },
                { _id: 1, vin: 1, unitNumber: 1 }
            ).lean();
            const vehicleMap = new Map(vehicles.map((v: any) => [v.vin, { _id: v._id, unitNumber: v.unitNumber || "" }]));

            // 2. Process rows
            const operations = data.map((row: any) => {
                const processedData: any = {};

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = repairHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        const val = value.toString().trim();
                        if (dateFields.has(schemaKey)) {
                            const utcDate = parseToUTCMidnight(val);
                            if (utcDate) {
                                processedData[schemaKey] = utcDate;
                            }
                        } else if (numericFields.has(schemaKey)) {
                            const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
                            if (!isNaN(num)) processedData[schemaKey] = num;
                        } else {
                            // Don't overwrite description if already set (Description takes priority over Repair)
                            if (schemaKey === "description" && processedData.description) return;
                            processedData[schemaKey] = val;
                        }
                    }
                });

                const vin = processedData.vin;
                if (!vin) return null;

                // Link to Vehicle
                const vehicleInfo = vehicleMap.get(vin);
                if (vehicleInfo) {
                    processedData.vehicleId = vehicleInfo._id;
                    processedData.unitNumber = vehicleInfo.unitNumber;
                }

                return {
                    updateOne: {
                        filter: {
                            vin,
                            description: processedData.description || '',
                            creationDate: processedData.creationDate || new Date(),
                        },
                        update: { $set: processedData },
                        upsert: true
                    }
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await VehicleRepair.bulkWrite(operations);
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Daily Inspections ───────────────────────────────────────────────────────
        else if (type === "daily-inspections") {
            const headerMap: Record<string, string> = {
                "Routes ID": "routeId",
                "Driver": "driver",
                "Route Date": "routeDate",
                "Vin": "vin",
                "VIN": "vin",
                "Vehicle Picture 1": "vehiclePicture1",
                "Vehicle Picture 2": "vehiclePicture2",
                "Vehicle Picture 3": "vehiclePicture3",
                "Vehicle Picture 4": "vehiclePicture4",
                "Mileage": "mileage",
                "Dashboard Image": "dashboardImage",
                "Comments": "comments",
                "Additional Picture": "additionalPicture",
                "Inspected By": "inspectedBy",
                "TimeStamp": "timeStamp",
                "Timestamp": "timeStamp",
                "Any Repairs": "anyRepairs",
                "Description": "repairDescription",
                "Current Status": "repairCurrentStatus",
                "Estimated Date": "repairEstimatedDate",
                "Image": "repairImage",
                "iSCompared?": "isCompared",
                "isCompared?": "isCompared",
                "isCompared": "isCompared",
                "IsCompared": "isCompared",
                "Inspection Type": "inspectionType",
                "InspectionType": "inspectionType",
                "inspectionType": "inspectionType",
                "inspection_type": "inspectionType",
                "Type": "inspectionType",
            };

            const dateFields = new Set(["routeDate", "timeStamp", "repairEstimatedDate"]);
            const numericFields = new Set(["mileage"]);
            const boolFields = new Set(["isCompared"]);

            // Gather VINs for vehicle lookup
            const vins = [...new Set(
                data
                    .map((row: any) => ((row["Vin"] || row["VIN"] || "")).toString().trim())
                    .filter((v: string) => v)
            )];

            const vehicles = vins.length
                ? await Vehicle.find({ vin: { $in: vins } }, { _id: 1, vin: 1, unitNumber: 1 }).lean()
                : [];
            const vehicleMap = new Map(
                (vehicles as any[]).map((v: any) => [v.vin, { _id: v._id, unitNumber: v.unitNumber || "" }])
            );

            const operations: any[] = [];

            for (const row of data) {
                const doc: any = {};

                for (const [header, value] of Object.entries(row)) {
                    const key = headerMap[header.trim()];
                    if (!key || value === undefined || value === null || value === "") continue;
                    const val = value.toString().trim();
                    if (!val) continue;

                    if (dateFields.has(key)) {
                        const parsed = new Date(val);
                        if (!isNaN(parsed.getTime())) doc[key] = parsed;
                    } else if (numericFields.has(key)) {
                        const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
                        if (!isNaN(num)) doc[key] = num;
                    } else if (boolFields.has(key)) {
                        doc[key] = /^(true|yes|1)$/i.test(val);
                    } else {
                        doc[key] = val;
                    }
                }

                // Must have at minimum a VIN or routeId
                if (!doc.vin && !doc.routeId) continue;

                // Link to Vehicle if VIN found
                if (doc.vin) {
                    const vehicleInfo = vehicleMap.get(doc.vin);
                    if (vehicleInfo) {
                        doc.vehicleId = vehicleInfo._id;
                        doc.unitNumber = vehicleInfo.unitNumber;
                    }
                }

                // Upsert key: routeId + vin + routeDate
                const filter: any = {};
                if (doc.routeId) filter.routeId = doc.routeId;
                if (doc.vin) filter.vin = doc.vin;
                if (doc.routeDate) filter.routeDate = doc.routeDate;

                // If no usable filter key, skip
                if (Object.keys(filter).length === 0) continue;

                operations.push({
                    updateOne: {
                        filter,
                        update: { $set: doc },
                        upsert: true,
                    },
                });
            }

            if (operations.length > 0) {
                const result = await DailyInspection.bulkWrite(operations, { ordered: false });
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                    matched: result.matchedCount || 0,
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        else if (type === "rental-agreements") {
            const headerMap: Record<string, string> = {
                "Unit #": "unitNumber",
                "Unit": "unitNumber",
                "Vin": "vin",
                "VIN": "vin",
                "Invoice #": "invoiceNumber",
                "Invoice": "invoiceNumber",
                "Agreement #": "agreementNumber",
                "Agreement": "agreementNumber",
                "R. Start Date": "registrationStartDate",
                "R Start Date": "registrationStartDate",
                "Start Date": "registrationStartDate",
                "R. End Date": "registrationEndDate",
                "R End Date": "registrationEndDate",
                "End Date": "registrationEndDate",
                "Due Date": "dueDate",
                "Amount": "amount",
                "File": "file",
                "Image": "image",
            };

            const dateFields = new Set(["registrationStartDate", "registrationEndDate", "dueDate"]);
            const numericFields = new Set(["amount"]);

            // Gather VINs for vehicle lookup
            const vins = [...new Set(
                data
                    .map((row: any) => ((row["Vin"] || row["VIN"] || "")).toString().trim())
                    .filter((v: string) => v)
            )];

            const vehicles = vins.length
                ? await Vehicle.find({ vin: { $in: vins } }, { _id: 1, vin: 1 }).lean()
                : [];
            const vehicleMap = new Map(
                (vehicles as any[]).map((v: any) => [v.vin, v._id])
            );

            const docs: any[] = [];

            for (const row of data) {
                const doc: any = {};

                for (const [header, value] of Object.entries(row)) {
                    const key = headerMap[header.trim()];
                    if (!key || value === undefined || value === null || value === "") continue;
                    const val = value.toString().trim();
                    if (!val) continue;

                    if (dateFields.has(key)) {
                        const parsed = new Date(val);
                        if (!isNaN(parsed.getTime())) doc[key] = parsed;
                    } else if (numericFields.has(key)) {
                        const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
                        if (!isNaN(num)) doc[key] = num;
                    } else {
                        doc[key] = val;
                    }
                }

                // Combine File and Image into rentalAgreementFilesImages array
                const filesImages: string[] = [];
                if (doc.file) { filesImages.push(doc.file); delete doc.file; }
                if (doc.image) { filesImages.push(doc.image); delete doc.image; }
                if (filesImages.length > 0) doc.rentalAgreementFilesImages = filesImages;

                // Must have at minimum a VIN or agreementNumber
                if (!doc.vin && !doc.agreementNumber) continue;

                // Link to Vehicle if VIN found
                if (doc.vin) {
                    const vehicleId = vehicleMap.get(doc.vin);
                    if (vehicleId) doc.vehicleId = vehicleId;
                }

                docs.push(doc);
            }

            if (docs.length > 0) {
                const result = await VehicleRentalAgreement.insertMany(docs, { ordered: false });
                return NextResponse.json({
                    success: true,
                    count: result.length,
                    inserted: result.length,
                    updated: 0,
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── Dropdowns Import ──
        else if (type === "dropdowns") {
            const operations = data.map((row: any) => {
                const description = (row.description || "").toString().trim();
                const rowType = (row.type || "").toString().trim().toLowerCase();
                if (!description || !rowType) return null;

                return {
                    updateOne: {
                        filter: { description, type: rowType },
                        update: { $set: { description, type: rowType, isActive: true } },
                        upsert: true,
                    },
                };
            }).filter((op: any): op is NonNullable<typeof op> => op !== null);

            if (operations.length > 0) {
                const result = await DropdownOption.bulkWrite(operations, { ordered: false });
                return NextResponse.json({
                    success: true,
                    count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
                    inserted: result.upsertedCount || 0,
                    updated: result.modifiedCount || 0,
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        // ── HR Tickets Import ──
        else if (type === "hr-tickets") {
            const transporterIds = data
                .map((row: any) => (row["Transporter ID"] || row["transporterId"] || "").toString().trim())
                .filter((id: string) => id);

            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { _id: 1, transporterId: 1 }
            ).lean();
            const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

            // Build case-insensitive header lookup
            const ciMap: Record<string, string> = {};
            Object.entries(hrTicketsHeaderMap).forEach(([k, v]) => { ciMap[k.toLowerCase()] = v; });

            const documents = data.map((row: any) => {
                const processedData: any = {};

                Object.entries(row).forEach(([header, value]) => {
                    const normalizedHeader = header.trim();
                    const schemaKey = ciMap[normalizedHeader.toLowerCase()] || hrTicketsHeaderMap[normalizedHeader];
                    if (schemaKey && value !== undefined && value !== null && value !== "") {
                        if (schemaKey === 'closedDateTime' || schemaKey === 'createdAt') {
                            const parsed = new Date(value.toString());
                            if (!isNaN(parsed.getTime())) processedData[schemaKey] = parsed;
                        } else {
                            processedData[schemaKey] = value.toString().trim();
                        }
                    }
                });

                const transporterId = processedData.transporterId;
                if (transporterId && employeeMap.has(transporterId)) {
                    processedData.employeeId = employeeMap.get(transporterId);
                }

                return processedData;
            }).filter((doc: any): doc is NonNullable<typeof doc> => doc !== null);

            if (documents.length > 0) {
                const result = await SymxHrTicket.insertMany(documents, { ordered: false });
                return NextResponse.json({
                    success: true,
                    count: result.length,
                    inserted: result.length,
                    updated: 0,
                    matched: 0
                });
            }

            return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0 });
        }

        return NextResponse.json({ error: "Invalid import type" }, { status: 400 });

    } catch (error: any) {
        console.error("Import API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
