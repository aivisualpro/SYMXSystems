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

export async function getSession() {
  const session = (await cookies()).get("symx_session")?.value;
  if (!session) return null;
  try {
    return await decryptLocal(session);
  } catch (e) {
    return null;
  }
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
