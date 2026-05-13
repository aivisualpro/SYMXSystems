# SYMX — iOS `/app/` Shows Email/Password Login Instead of Badge PIN

Hand these prompts to your AI coding agent **one at a time, in order**.

## Root cause analysis (verified in repo)

iOS users visit `localhost:9568/app/` and see the Next.js email/password screen instead of the Flutter badge-PIN screen. There are **four overlapping defects** any one of which can cause this — fix all of them.

**1. Stale outer service worker.** `public/sw.js` (registered by `components/pwa/service-worker-registration.tsx`, mounted in `app/layout.tsx`, runs on EVERY page) has scope `/`. The current version has a `/app/*` skip rule:

   ```js
   if (url.pathname.startsWith('/app/') || url.pathname === '/app') return;
   ```

   But iOS users who visited the site BEFORE this rule existed still have the OLD SW installed (Safari is sticky about SW updates). Their old SW's navigate handler catches `/app/` requests, fails to find them in cache, and falls back to the pre-cached `/login` — the email/password page. Cache name is `symx-v3` currently — earlier installs may be `symx-v1`/`symx-v2`.

**2. Outer manifest precaches `/login`.** `public/sw.js` line 4–13 hard-codes `/login` into `PRECACHE_URLS`. So even on a fresh install, the email/password page lives in cache, ready to be served as a fallback for anything Safari considers "missing".

**3. Flutter manifest has no explicit `scope`.** `public/app/manifest.json` has `start_url: "."` but no `scope: "/app/"`. The default-derived scope works in Chrome but iOS Safari sometimes leaks PWA navigation to the parent manifest at `/manifest.json` (which has `scope: "/"` and `start_url: "/dashboard"`).

**4. No SW unregister on the Flutter route.** When iOS users land on `/app/`, nothing tells any previously-installed SW to step aside. The Flutter app is built with `--pwa-strategy=none` so Flutter itself doesn't register a SW, but it also doesn't unregister the outer one.

**Why Android APK is unaffected:** APK doesn't go through the browser at all — no service workers, no manifest scopes, no cached login pages. It's a clean room.

---

## PASS 1 — Add explicit scope to the Flutter manifest

```
Make iOS Safari treat /app/ as a fully isolated PWA scope.

1. Edit `SYMXSystemsApp/web/manifest.json` (this is the source for the build) AND `public/app/manifest.json` (the built artifact — same fix applied here too in case you don't rebuild immediately):

   Add two fields at the top level:
     "scope": "/app/",
     "id": "/app/",

   And change `start_url` from `"."` to `"/app/"` for explicitness (still relative-safe because of the base href).

2. Final manifest top:
     {
       "name": "SYMX Systems",
       "short_name": "SYMX",
       "id": "/app/",
       "start_url": "/app/",
       "scope": "/app/",
       "display": "standalone",
       ...
     }

3. The OUTER manifest at `public/manifest.json` already has `scope: "/"` and `start_url: "/dashboard"`. Leave the scope at `/` but verify the `id` field. PWA spec says id is what dedupes the installed PWA — distinct IDs guarantee iOS will treat them as separate apps.

Done when:
- `public/app/manifest.json` has `"scope": "/app/"` and `"id": "/app/"`.
- `public/manifest.json` has a distinct `id` (e.g. `"id": "/"`).
- Re-running `npm run flutter:build` does not strip these (they live in the source web/manifest.json now).
```

---

## PASS 2 — Bump the SW cache version + force update + scope skip on `/app/`

```
Force every iOS user's stale outer service worker to update or get out of the way.

1. Edit `public/sw.js`:
   a. Change `const CACHE_NAME = 'symx-v3'` to `const CACHE_NAME = 'symx-v4'`.
   b. REMOVE `/login` from PRECACHE_URLS. It's a hostile fallback for the driver app. Replace with empty array or just `['/manifest.json']`.
   c. The fetch handler already skips `/app/*` — confirm that line is the FIRST check after the GET filter, BEFORE the navigate fallback that returns cached `/login`. Move it up if needed.
   d. Add a new message handler so the page can ask the SW to unregister itself:

      self.addEventListener('message', (event) => {
        if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
        if (event.data?.type === 'UNREGISTER') {
          self.registration.unregister().then(() => {
            return self.clients.matchAll();
          }).then((clients) => {
            clients.forEach(c => c.navigate(c.url));
          });
        }
      });

2. Edit `components/pwa/service-worker-registration.tsx`:
   a. Before registering, check `window.location.pathname`. If it starts with `/app/` or equals `/app`, do NOT register a service worker at all — and unregister any existing one:

       if (typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
         if ("serviceWorker" in navigator) {
           navigator.serviceWorker.getRegistrations().then((regs) => {
             regs.forEach((reg) => reg.unregister());
           });
         }
         return;
       }

   Insert this guard at the top of the useEffect, before the existing registration code.

3. Done when:
   - `grep -n "symx-v" public/sw.js` shows `symx-v4`.
   - `grep -n "'/login'" public/sw.js` returns nothing inside PRECACHE_URLS.
   - The SW registration component early-returns on `/app/*` paths.
   - After a hard refresh of `/app/` on iOS Safari, devtools → Application → Service Workers shows zero workers for this origin.
```

---

## PASS 3 — Defensive unregister inside Flutter's index.html

```
Belt-and-suspenders: tell the browser to nuke any service worker the moment /app/ loads, BEFORE Flutter boots. This protects users whose iOS Safari was offline when Pass 2 deployed.

1. Edit `SYMXSystemsApp/web/index.html` (source) — add this inline script INSIDE the <head>, BEFORE the `<script src="flutter_bootstrap.js"...>` tag:

     <script>
       // Kill any service worker installed by the parent site — the
       // driver PWA is intentionally SW-free to avoid cache poisoning.
       if ('serviceWorker' in navigator) {
         navigator.serviceWorker.getRegistrations().then(function (regs) {
           for (var i = 0; i < regs.length; i++) {
             regs[i].unregister();
           }
         }).catch(function () {});
         // Also drop any caches the parent SW seeded (e.g. cached /login)
         if ('caches' in window) {
           caches.keys().then(function (keys) {
             keys.forEach(function (k) {
               if (!k.startsWith('flutter-')) caches.delete(k);
             });
           }).catch(function () {});
         }
       }
     </script>

2. Apply the SAME script edit to the BUILT `public/app/index.html` so it takes effect immediately without rebuilding Flutter. (Then rebuild with `npm run flutter:build` to make it permanent.)

Done when:
- `grep -n "getRegistrations" public/app/index.html` returns one match in the <head>.
- `grep -n "getRegistrations" SYMXSystemsApp/web/index.html` returns one match.
- Visiting `/app/` in a fresh iOS Safari session shows the Flutter splash within ~2s, no email/password screen anywhere.
```

---

## PASS 4 — Root-route bounce: send "no session" users to the right login

```
If iOS users navigate to the bare domain (`localhost:9568`) and they're not authenticated, the current behavior is `app/page.tsx` → `redirect("/login")` (email/password). That's wrong if the visitor is actually a driver. Give them a smarter landing.

1. Edit `app/page.tsx`. Current implementation:

       import { redirect } from "next/navigation";
       export default function Home() { redirect("/login"); }

   Replace with a logged-out chooser page — a single screen with two big buttons:
     [ Office Login → /login ]
     [ Driver App → /app/ ]

   Use Tailwind, mirror the existing /login background style. Keep it static (no auth check needed).

   - Alternatively: if a `symx_role=driver` cookie is set, redirect straight to `/app/`. Otherwise show the chooser.

2. Edit `app/(protected)/layout.tsx` and `app/login/page.tsx` (the office login): after a successful office login, set a cookie `symx_role=office` (`HttpOnly`, `SameSite=Lax`). This biases the chooser for return visits.

3. On the Flutter login success (`badge-login` API), have the response also `Set-Cookie: symx_role=driver; Path=/; SameSite=Lax; Max-Age=31536000`. Then `app/page.tsx` can read it and redirect drivers to `/app/` instantly.

Done when:
- Visiting `localhost:9568/` for the first time shows the two-button chooser, not the email/password form.
- After signing in as a driver once on `/app/`, future bare-domain visits go straight to `/app/`.
- Office users continue to be unaffected.
```

---

## PASS 5 — Verification on iOS Safari (real device, not just devtools)

```
Final sanity pass on actual hardware.

1. Rebuild and deploy:
   - `npm run flutter:build`
   - `npm run dev` (or your deploy step)

2. On a fresh iOS Safari profile (or use Private Browsing):
   a. Visit `https://<host>/app/` directly.
   b. Confirm: Flutter splash appears, then the badge-PIN screen — NOT the email/password form.
   c. Devtools (via Safari's Web Inspector with iPhone connected, or Settings → Safari → Advanced → Web Inspector): Application → Service Workers must show zero registrations.
   d. Application → Manifest: name = "SYMX Systems", scope = `/app/`, start_url = `/app/`.
   e. Add to Home Screen → confirm the icon opens to `/app/` (badge-PIN), not `/dashboard`.

3. On an iPhone that HAD the old SW installed (simulate by visiting `/login` first, waiting for the SW toast/registration, then visiting `/app/`):
   - Pass 3's inline script should unregister the SW automatically. Reload `/app/` once and confirm Service Workers panel is now empty.

4. Build the Android APK and confirm parity:
   - `flutter build apk --release --dart-define=API_BASE_URL=https://your-host.com`
   - Install on a test device. Confirm badge-PIN login works identically.

Report any deviations in a short note. If any iOS user still sees the email/password form, capture: (a) the URL they navigated to, (b) whether they had previously installed the outer PWA, (c) the iOS version, (d) whether `caches.keys()` in Safari Web Inspector shows any `symx-v*` entries.
```

---

## Why all four passes matter

- **Pass 1 (manifest scope)** stops iOS from confusing the two PWAs as the same app.
- **Pass 2 (SW bump + skip)** updates the cache for users who CAN receive SW updates.
- **Pass 3 (inline unregister)** is the safety net for users whose iOS Safari ignores or delays SW updates — runs in the page itself, no SW needed.
- **Pass 4 (smart root)** prevents the wrong-URL confusion from being the actual cause in the first place.

Run them sequentially and commit between passes. After Pass 3 your existing iOS users will self-heal on next visit; after Pass 4 new iOS users won't even hit the bad path.

## Quick triage tip

If you want to confirm THIS is the issue before applying any fix, ask one affected iOS user:

> "Open Settings → Safari → Advanced → Website Data, search for your domain, tap Edit, swipe-delete it. Now reopen /app/ in Safari. Do you see the badge-PIN screen?"

If yes → service worker poisoning was the cause (Passes 2 + 3 fix it). If no → manifest scope or URL routing was the cause (Passes 1 + 4 fix it).
