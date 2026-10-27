import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export { decrypt } from "./auth-utils";
import { decrypt as decryptLocal, key } from "./auth-utils";

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function login(userData: any) {
  // Create the session with minimal data to keep header size small
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const minimalSession = {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    expires,
  };

  const session = await encrypt(minimalSession);

  // Save the session in a cookie
  const cookieStore = await cookies();
  cookieStore.set("symx_session", session, { 
    expires, 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: 'lax',
    path: '/'
  });
}

export async function logout() {
  // Destroy the session
  (await cookies()).set("symx_session", "", { expires: new Date(0), path: '/' });
}

// Live account state, cached briefly. The JWT is valid for 30 days, so on its
// own it would keep a deactivated user signed in and keep a stale role after
// an admin changes it. We re-check the database (cached ~30s per user) so:
//   - a deactivated user stops working within ~30s, and
//   - a role change takes effect without waiting for a re-login.
const LIVE_USER_TTL_MS = 60 * 1000;
const liveUserCache = new Map<string, { at: number; active: boolean; role: string }>();
// Concurrent requests (a page fires many API calls at once) share one lookup
// instead of each hitting the database.
const liveUserInflight = new Map<string, Promise<{ active: boolean; role: string } | null>>();

async function getLiveUser(id: string): Promise<{ active: boolean; role: string } | null> {
  const hit = liveUserCache.get(id);
  if (hit && Date.now() - hit.at < LIVE_USER_TTL_MS) return { active: hit.active, role: hit.role };
  const pending = liveUserInflight.get(id);
  if (pending) return pending;
  const p = (async () => {
    try {
      const { default: connectToDatabase } = await import("./db");
      const { default: SymxUser } = await import("./models/SymxUser");
      await connectToDatabase();
      const u: any = await SymxUser.findById(id).select("AppRole isActive").lean();
      const entry = u
        ? { at: Date.now(), active: u.isActive !== false, role: u.AppRole || "Manager" }
        : { at: Date.now(), active: false, role: "" };
      liveUserCache.set(id, entry);
      return { active: entry.active, role: entry.role };
    } catch {
      // Database hiccup: fall back to the signed session rather than locking everyone out.
      return null;
    } finally {
      liveUserInflight.delete(id);
    }
  })();
  liveUserInflight.set(id, p);
  return p;
}

export async function getSession() {
  const session = (await cookies()).get("symx_session")?.value;
  if (!session) return null;
  let payload: any;
  try {
    payload = await decryptLocal(session);
  } catch (e) {
    return null;
  }
  const id = payload?.id ? String(payload.id) : "";
  // The built-in Super Admin has no database row.
  if (!id || id === "super-admin" || !/^[0-9a-fA-F]{24}$/.test(id)) return payload;
  const live = await getLiveUser(id);
  if (!live) return payload;
  if (!live.active) return null;
  return { ...payload, role: live.role };
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("symx_session")?.value;
  if (!session) return null;

  // Refresh the session so it doesn't expire
  const parsed = await decryptLocal(session);
  parsed.expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const res = NextResponse.next();
  res.cookies.set({
    name: "symx_session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
    secure: true,
    sameSite: 'lax'
  });
  return res;
}
