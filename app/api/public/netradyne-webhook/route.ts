import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { orgWide } from "@/lib/scoped-query";
import SymxEmployee from "@/lib/models/SymxEmployee";
import NetradyneAlert from "@/lib/models/NetradyneAlert";
import { sendSafetyAlertPush } from "@/lib/firebase-admin";

/**
 * ══════════════════════════════════════════════════════════════
 * PUBLIC API — Netradyne Alert Webhook
 * ══════════════════════════════════════════════════════════════
 * Receives real-time safety-event alerts pushed by Netradyne (the fleet
 * safety camera system) and, for severe/moderate confirmed alerts, pushes
 * a near-real-time notification to the driver's phone via Firebase Cloud
 * Messaging — the driver app plays it aloud with text-to-speech.
 *
 * Configure this URL (with the ?key=... query param) as the webhook
 * destination in the Netradyne partner portal. Payload shape and field
 * meanings: https://partner-help.netradyne.com/hc/en-us/articles/4402142121497-Alert-Webhook
 *
 * Netradyne re-posts the SAME alert on status changes (confirmed/rejected),
 * video availability changes, and driver-reassignment — this always
 * upserts by netradyneAlertId rather than inserting duplicates, and only
 * fires a NEW push the first time an alert is seen with a pushable
 * severity + CONFIRMED status (a later re-post of an already-pushed alert
 * doesn't re-notify the driver).
 * ══════════════════════════════════════════════════════════════
 */

// Shared secret configured as the webhook URL's query param in the
// Netradyne portal. Netradyne's webhook config doesn't document custom
// header support, so (like this app's other inbound webhooks) the secret
// rides in the URL itself rather than a header.
const NETRADYNE_WEBHOOK_KEY = process.env.NETRADYNE_WEBHOOK_KEY || "symx-netradyne-alert-2026";

// Only these severities page the driver's phone. 3 = DRIVER-STAR (positive
// recognition, not a violation) and 4 = NEUTRAL never trigger a push.
const PUSHABLE_SEVERITIES = new Set([1, 2]);

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== NETRADYNE_WEBHOOK_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only "alert" webhook events carry the fields this endpoint cares
  // about — Netradyne's webhook subscription can in principle be reused
  // for other event families later, so this guards against silently
  // mis-parsing something else.
  if (body?.webhookType && body.webhookType !== "alert") {
    return NextResponse.json({ ok: true, skipped: true, reason: `Ignoring webhookType "${body.webhookType}"` });
  }

  try {
    await connectToDatabase();

    const netradyneAlertId = String(body?.id ?? "");
    const netradyneDriverId = String(body?.driver?.driverId ?? "");
    const firstName = body?.driver?.firstName || "";
    const lastName = body?.driver?.lastName || "";
    const driverName = `${firstName} ${lastName}`.trim();
    const details = body?.details || {};
    const severity: number | undefined = typeof details.severity === "number" ? details.severity : undefined;

    if (!netradyneAlertId) {
      return NextResponse.json({ error: "Payload missing alert id" }, { status: 400 });
    }

    // Has this exact alert already resulted in a push? (Re-posts on status/
    // video/driver-reassignment updates should not re-notify the driver.)
    const existing = await orgWide(
      NetradyneAlert.findOne({ netradyneAlertId }),
      "checking whether this Netradyne alert id was already processed — Netradyne re-posts the same alert on status/video updates, and this dedupe check has to see across every station, not just whichever one happens to be in scope for this request"
    ).lean() as any;

    // Resolve the SYMX employee: prefer the explicit netradyneDriverId
    // mapping (set on the employee record by an admin), fall back to a
    // name match since that mapping won't be filled in for every driver
    // on day one.
    let employee: any = null;
    if (netradyneDriverId) {
      employee = await orgWide(
        SymxEmployee.findOne({ netradyneDriverId, status: "Active" }),
        "resolving which driver a Netradyne alert belongs to — the mapping is org-wide, not scoped to whichever station happens to be active for this request"
      ).lean();
    }
    if (!employee && firstName && lastName) {
      employee = await orgWide(
        SymxEmployee.findOne({
          firstName: new RegExp(`^${firstName}$`, "i"),
          lastName: new RegExp(`^${lastName}$`, "i"),
          status: "Active",
        }),
        "falling back to a name match when no netradyneDriverId mapping is on file yet for this driver"
      ).lean();
    }

    const transporterId = employee?.transporterId || "";
    const siteId = employee?.primarySiteId || undefined;

    let pushSent = false;
    let pushSkippedReason = "";
    const alreadyPushed = !!existing?.pushSent;
    const isPushable = severity !== undefined && PUSHABLE_SEVERITIES.has(severity) && body?.status === "CONFIRMED";

    if (alreadyPushed) {
      pushSkippedReason = "already pushed for this alert id on a previous webhook delivery";
      pushSent = true; // preserve — this delivery is just a status re-post
    } else if (!isPushable) {
      pushSkippedReason = severity === undefined
        ? "no severity in payload"
        : !PUSHABLE_SEVERITIES.has(severity)
          ? `severity ${severity} (${details.severityDescription || "n/a"}) below push threshold`
          : `status "${body?.status}" is not CONFIRMED`;
    } else if (!employee) {
      pushSkippedReason = "no matching SYMX employee found for this driver";
    } else if (!employee.fcmToken) {
      pushSkippedReason = "employee has no registered device (fcmToken) — app not installed or not logged in yet";
    } else {
      const result = await sendSafetyAlertPush(employee.fcmToken, {
        transporterId,
        driverName: driverName || transporterId,
        typeDescription: details.typeDescription || "Safety event",
        subTypeDescription: details.subTypeDescription || "",
        severityDescription: details.severityDescription || "",
        netradyneAlertId,
      });
      if (result.ok) {
        pushSent = true;
      } else {
        pushSkippedReason = `push send failed: ${result.reason}`;
      }
    }

    const alertDoc = {
      netradyneAlertId,
      netradyneDriverId,
      transporterId,
      driverName,
      vehicleNumber: body?.vehicle?.vehicleNumber || "",
      vin: body?.vehicle?.vin || "",
      severity,
      severityDescription: details.severityDescription || "",
      typeId: details.typeId,
      typeDescription: details.typeDescription || "",
      subTypeDescription: details.subTypeDescription || "",
      status: body?.status || "",
      timestamp: body?.timestamp ? new Date(body.timestamp) : undefined,
      pushSent,
      pushSkippedReason,
      rawPayload: body,
      ...(siteId ? { siteId } : {}),
    };

    if (existing) {
      await NetradyneAlert.updateOne({ _id: existing._id }, { $set: alertDoc });
    } else {
      // siteId set directly here (not via a scoped write helper) — this
      // request has no user session to derive scope from, and the
      // resolved employee's own station IS the correct scope.
      await NetradyneAlert.create(alertDoc);
    }

    return NextResponse.json({ ok: true, matched: !!employee, pushSent, pushSkippedReason: pushSkippedReason || undefined });
  } catch (error: any) {
    console.error("[Netradyne Webhook] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process alert" }, { status: 500 });
  }
}
