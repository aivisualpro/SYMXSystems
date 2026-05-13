# SYMX — `/app` (no slash) breaks Flutter routing → falls back to Next.js `/login`

## The bug, in one sentence

When a user types `localhost:9568/app` (no trailing slash), the route handler at `app/app/route.ts` serves the Flutter `index.html`, but the URL doesn't match the `<base href="/app/">` in the HTML. Flutter's `usePathUrlStrategy()` then treats the page as living at document root, so when the splash screen calls `context.go('/login')` for an unauthenticated user, GoRouter pushes `/login` at the document root — which is the Next.js email/password login page, not the Flutter badge-PIN screen.

**Affects every browser** (Chrome, Safari, Firefox, mobile, desktop). It's not an iOS-specific issue. It's just easy to trigger because most users don't type trailing slashes.

## Verified facts from the repo

- `SYMXSystemsApp/lib/main.dart` calls `usePathUrlStrategy()` — clean URLs, no hash.
- `SYMXSystemsApp/web/index.html` has `<base href="$FLUTTER_BASE_HREF">` which is set to `/app/` at build time by `npm run flutter:build`.
- `SYMXSystemsApp/lib/features/auth/presentation/splash_screen.dart` calls `context.go('/login')` when no token is found.
- `app/app/route.ts` serves `public/app/index.html` for both `/app` and `/app/`.
- `app/login/page.tsx` is the Next.js office login (email + password) — that's what the user sees.

When the path matches the base href (i.e., `/app/`), Flutter strips the base and treats internal routes as `/`, `/login`, `/inspections`. When it doesn't match (i.e., `/app` with no slash), Flutter's URL strategy gets confused, and `context.go('/login')` writes `/login` to the document root, triggering a full navigation away from the Flutter app.

---

## THE FIX — force trailing slash on `/app`

```
Make `/app` always redirect to `/app/` (308 Permanent Redirect) so that Flutter's base href is always honored, regardless of how the user typed the URL.

1. Edit `app/app/route.ts`. Replace the GET handler with a permanent redirect to `/app/`:

   import { NextRequest, NextResponse } from "next/server";

   export const dynamic = "force-dynamic";

   export async function GET(req: NextRequest) {
     // Always force the trailing slash so the Flutter <base href="/app/">
     // matches the URL. Without this, Flutter's PathUrlStrategy treats
     // the page as living at document root and any internal navigation
     // (e.g., context.go('/login')) escapes into the Next.js routes.
     const url = new URL(req.url);
     url.pathname = "/app/";
     return NextResponse.redirect(url, 308);
   }

2. Edit `app/app/[...slug]/route.ts`. Keep the existing logic (serve index.html for sub-paths). But ADD a guard at the top to handle the edge case where the slug is empty (i.e., the request was for `/app/` exactly):

   - This route already handles `/app/anything-here`. For `/app/` itself, Next.js routes that to `app/app/route.ts` if it exists, OR to `app/app/[...slug]/route.ts` with an empty slug — behavior depends on Next config. To make it robust, create a new file:

3. Create `app/app/page.tsx` (NOT a route.ts — a page.tsx, served by the app router for `/app/` exactly when no slug is present):

   import { readFileSync, existsSync } from "fs";
   import { join } from "path";

   export const dynamic = "force-dynamic";

   export default function FlutterAppRoot() {
     const htmlPath = join(process.cwd(), "public", "app", "index.html");
     if (!existsSync(htmlPath)) {
       return (
         <html>
           <body style={{margin:0,background:"#0A0E1A",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"sans-serif"}}>
             <div style={{textAlign:"center"}}>
               <h2>SYMX Driver App</h2>
               <p style={{opacity:0.6}}>The app build is not available yet.</p>
             </div>
           </body>
         </html>
       );
     }
     const html = readFileSync(htmlPath, "utf-8");
     // Return raw HTML using dangerouslySetInnerHTML in a way Next.js handles
     return <div dangerouslySetInnerHTML={{ __html: html }} />;
   }

   ACTUALLY — page.tsx wraps content in Next.js's <html>/<body>, which conflicts with serving a full HTML document. Instead, KEEP `app/app/[...slug]/route.ts` as-is (it correctly serves the raw HTML for sub-paths), and ALSO ADD a route.ts handler for `/app/` with empty slug.

   Simpler approach — replace step 3 with: rely on the [...slug] catch-all to also handle the empty slug case. In Next.js 16, `[...slug]` matches `/app/foo` but NOT `/app/` (you need `[[...slug]]` for optional catch-all). So:

   Rename `app/app/[...slug]/route.ts` → `app/app/[[...slug]]/route.ts` (note the DOUBLE brackets — optional catch-all in Next.js). This makes the same handler respond to both `/app/` and `/app/anything-here`.

4. Net result of file changes:
   - `app/app/route.ts` — now ONLY does the 308 redirect from `/app` to `/app/`.
   - `app/app/[[...slug]]/route.ts` — serves `public/app/index.html` for `/app/`, `/app/login`, `/app/inspections`, etc. (Rename from `[...slug]` to `[[...slug]]`.)

5. (Optional but recommended) Update root `app/page.tsx` so bare-domain visits don't dead-end at the Next.js office login. Replace:

       import { redirect } from "next/navigation";
       export default function Home() { redirect("/login"); }

   With:

       import { cookies } from "next/headers";
       import { redirect } from "next/navigation";

       export default async function Home() {
         const cookieStore = await cookies();
         const role = cookieStore.get("symx_role")?.value;
         if (role === "driver") redirect("/app/");
         redirect("/login");
       }

   Then in `app/api/mobile/badge-login/route.ts`, after issuing the JWT, also set:
       res.cookies.set("symx_role", "driver", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
   So next time a driver visits `localhost:9568` bare, they bounce straight into `/app/`.

Done when:
- `curl -i http://localhost:9568/app` returns `HTTP/1.1 308` with `Location: /app/`.
- `curl -i http://localhost:9568/app/` returns the Flutter HTML (200, content-type text/html).
- Typing `localhost:9568/app` in any browser → URL bar updates to `localhost:9568/app/` → Flutter splash → badge-PIN login (not email/password).
- `npm run build && npm run lint` pass.
- The Next.js office login at `/login` is still reachable for office users.
```

---

## Why this works

`usePathUrlStrategy()` in Flutter web reads `window.location.pathname` and compares it against `<base href>`. When `pathname === '/app/'`, the base prefix matches and Flutter computes the relative path correctly. When `pathname === '/app'` (no slash), the prefix doesn't match the base (because base ends in `/`), so Flutter falls back to treating the page as living at root — and every internal navigation escapes the Flutter SPA back into Next.js territory.

Forcing `/app` → `/app/` via a 308 ensures Flutter ALWAYS sees a base-matching URL.

## Quick sanity test (no rebuild needed)

After applying the fix:

```
curl -i http://localhost:9568/app
# Expect: HTTP/1.1 308 Permanent Redirect
#         Location: http://localhost:9568/app/

curl -sL http://localhost:9568/app/ | grep -o '<base[^>]*>'
# Expect: <base href="/app/">
```

Then in browser: `localhost:9568/app` → auto-redirects to `localhost:9568/app/` → Flutter loads → badge PIN screen.

## Rollback

If anything breaks, the old behavior is one git revert away. The 308 redirect is the only behavior change at the URL level — everything past `/app/` was already correct.
