
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxPhotoOnDelivery from "@/lib/models/SymxPhotoOnDelivery";
import SymxCustomerDeliveryFeedback from "@/lib/models/SymxCustomerDeliveryFeedback";
import SymxDVICVehicleInspection from "@/lib/models/SymxDVICVehicleInspection";
import SymxSafetyDashboardDFO2 from "@/lib/models/SymxSafetyDashboardDFO2";
import ScoreCardQualityDSBDNR from "@/lib/models/ScoreCardQualityDSBDNR";
import ScoreCardDCR from "@/lib/models/ScoreCardDCR";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

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

const cdfHeaderMap: Record<string, string> = {
    "Delivery Associate": "deliveryAssociate",
    "Transporter ID": "transporterId",
    "CDF DPMO": "cdfDpmo",
    "CDF DPMO Tier": "cdfDpmoTier",
    "CDF DPMO Score": "cdfDpmoScore",
    "Negative Feedback Count": "negativeFeedbackCount",
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
 * Convert a date to yearWeek format "yyyy-Wxx" where Sunday is the first day of the week.
 * Week 1 starts with the first Sunday of the year (or Jan 1 if it is a Sunday).
 */
function dateToSundayWeek(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    // Find the Sunday that starts this week (Sunday=0)
    const dayOfWeek = date.getUTCDay(); // 0=Sun,1=Mon...6=Sat
    const sundayOfThisWeek = new Date(date);
    sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
    // Compute the year of that Sunday
    const year = sundayOfThisWeek.getUTCFullYear();
    // The first day of that year
    const jan1 = new Date(Date.UTC(year, 0, 1));
    // Day of year for that Sunday (0-indexed)
    const dayOfYear = Math.floor((sundayOfThisWeek.getTime() - jan1.getTime()) / 86400000);
    const weekNum = Math.floor(dayOfYear / 7) + 1;
    return `${year}-W${weekNum.toString().padStart(2, '0')}`;
  } catch {
    return null;
  }
}

const employeeScheduleHeaderMap: Record<string, string> = {
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
        if (!rawData.email) return null;

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
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  // Normalize to YYYY-MM-DDT00:00:00.000Z to avoid timezone shifts
                  const dateStr = date.toISOString().split('T')[0];
                  processedData[key] = new Date(`${dateStr}T00:00:00.000Z`);
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

        return {
          updateOne: {
            filter: { email: processedData.email },
            update: { $set: processedData },
            upsert: true,
          },
        };
      }).filter((op): op is NonNullable<typeof op> => op !== null);

      if (operations.length > 0) {
        const result = await SymxEmployee.bulkWrite(operations);
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
    
    // ── Customer Delivery Feedback Import ──
    else if (type === "customer-delivery-feedback") {
        if (!week) {
            return NextResponse.json({ error: "Week is required for CDF import" }, { status: 400 });
        }

        // 1. Gather Transporter IDs
        const transporterIds = data
            .map((row: any) => row["Transporter ID"])
            .filter((id: any) => id);

        // 2. Fetch Employees
        const employees = await SymxEmployee.find(
            { transporterId: { $in: transporterIds } },
            { _id: 1, transporterId: 1 }
        ).lean();
        
        const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp._id]));

        // 3. Process Rows
        const operations = data.map((row: any) => {
            const transporterId = row["Transporter ID"];
            
            if (!transporterId) return null;

            const processedData: any = {
                week: week, // Use the passed week
                transporterId: transporterId
            };

            // Map Headers
            Object.entries(row).forEach(([header, value]) => {
                // Remove extra spaces if any
                const normalizedHeader = header.trim();
                const schemaKey = cdfHeaderMap[normalizedHeader];

                if (schemaKey) {
                    if (schemaKey === 'deliveryAssociate' || schemaKey === 'transporterId' || schemaKey === 'cdfDpmoTier') {
                        if (value !== undefined && value !== null && value !== "") {
                           processedData[schemaKey] = value.toString().trim();
                        }
                    } else {
                        // Numeric stats
                        processedData[schemaKey] = safeParseFloat(value);
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
            const result = await SymxCustomerDeliveryFeedback.bulkWrite(operations);
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

            // Use the passed week from the frontend (auto-detected from filename), fallback to date-based calculation
            const recordWeek = week || (startDate ? dateToISOWeek(startDate) : null);
            if (!recordWeek) return null; // Skip rows without a valid week

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

    // ── Safety Dashboard DFO2 Import ──
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

            // Parse the date field
            let dateVal: Date | null = null;
            if (processedData.date) {
                const parsed = new Date(processedData.date);
                if (!isNaN(parsed.getTime())) {
                    const dateStr = parsed.toISOString().split('T')[0];
                    dateVal = new Date(`${dateStr}T00:00:00.000Z`);
                    processedData.date = dateVal;
                }
            }
            if (!dateVal) return null;

            // Compute yearWeek from date (Sunday first day)
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

    return NextResponse.json({ error: "Invalid import type" }, { status: 400 });

  } catch (error: any) {
    console.error("Import API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
