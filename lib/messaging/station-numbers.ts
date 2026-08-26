import Site from "@/lib/models/Site";
import type { RequestScope } from "@/lib/scoped-query";

// ── Station ↔ Quo number ──────────────────────────────────────────────
// Each station texts from its own Quo (OpenPhone) number. That number is
// the join between a message and a station, in both directions, so both
// the send path and the webhook resolve it here rather than each doing
// its own lookup and drifting.
//
// Outbound: the number is derived from the station, never accepted from
// the request body. A client-supplied `from` would let a user at one
// station send messages that appear to come from another.
//
// Inbound: the Quo webhook is unauthenticated and carries no station, so
// the number a reply arrived at is the only evidence of which station it
// belongs to. If that lookup fails the message must NOT be silently
// filed under the default station — see resolveStationByNumber.

export interface StationNumber {
  siteId: string;
  code: string;
  name: string;
  phoneNumberId: string;
  phoneNumber: string;
}

function toStationNumber(site: any): StationNumber | null {
  const id = site?.messaging?.quoPhoneNumberId;
  if (!id) return null;
  return {
    siteId: String(site._id),
    code: site.code,
    name: site.name,
    phoneNumberId: id,
    phoneNumber: site.messaging?.quoPhoneNumber || "",
  };
}

/** The sending number for one station, or null if none is configured. */
export async function getStationNumber(siteId: string): Promise<StationNumber | null> {
  const site = await Site.findById(siteId).lean();
  return site ? toStationNumber(site) : null;
}

/**
 * Sending numbers for every station the request may reach.
 *
 * Used to populate the "from" picker, so the list is already limited to
 * what the user is entitled to — the picker cannot offer another
 * station's number in the first place.
 */
export async function getSendableNumbers(scope: RequestScope): Promise<StationNumber[]> {
  if (scope.isEmpty) return [];
  const sites = await Site.find({ _id: { $in: scope.allowedSiteIds }, status: "active" }).lean();
  return sites.map(toStationNumber).filter((n): n is StationNumber => n !== null);
}

/**
 * Validate a caller-supplied phoneNumberId against what they may use.
 *
 * Returns the station that owns the number, or null if the caller is not
 * entitled to it. Callers must treat null as a refusal rather than
 * falling back to a default — falling back is how a message ends up sent
 * from the wrong station's number.
 */
export async function resolveSendingNumber(
  scope: RequestScope,
  requestedPhoneNumberId?: string | null
): Promise<StationNumber | null> {
  const allowed = await getSendableNumbers(scope);
  if (allowed.length === 0) return null;

  if (requestedPhoneNumberId) {
    return allowed.find((n) => n.phoneNumberId === requestedPhoneNumberId) || null;
  }

  // No explicit choice: only safe when exactly one station is in view.
  // With several, guessing would attribute messages to a station the
  // sender did not pick.
  const active = allowed.filter((n) => scope.activeSiteIds.includes(n.siteId));
  return active.length === 1 ? active[0] : null;
}

/**
 * Which station does an inbound message belong to?
 *
 * Matches on either the OpenPhone id or the E.164 number, because the
 * webhook payload has used both shapes depending on event type.
 *
 * Returns null when the number maps to no station. Callers must record
 * the message as unattributed rather than defaulting it to the primary
 * station: a driver's reply filed under the wrong station is worse than
 * one flagged as needing attention, because nothing later reveals it.
 */
export async function resolveStationByNumber(
  numberOrId: string | null | undefined
): Promise<StationNumber | null> {
  if (!numberOrId) return null;
  const site = await Site.findOne({
    $or: [
      { "messaging.quoPhoneNumberId": numberOrId },
      { "messaging.quoPhoneNumber": numberOrId },
    ],
  }).lean();
  return site ? toStationNumber(site) : null;
}
