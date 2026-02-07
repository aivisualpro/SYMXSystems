import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/admin", "/inventory"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // IMMEDIATELY skip everything that isn't a page
  if (
    path.startsWith('/api') || 
    path.startsWith('/_next') || 
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route)) || path === "/";
  const sessionCookie = req.cookies.get("symx_session")?.value;

  // If trying to access protected route without a cookie
  if (isProtectedRoute && !sessionCookie && path !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // If has cookie and is on login/home, go to dashboard
  if (sessionCookie && (path === "/login" || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
