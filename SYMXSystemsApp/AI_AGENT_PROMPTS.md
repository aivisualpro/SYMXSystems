# SYMXSystemsApp — Step-by-Step Prompts for Your AI Agent

> Copy-paste each block (in order) into your AI coding agent.
> Each prompt is self-contained — it includes paths, endpoints, sample data and acceptance criteria.
> Backend = existing Next.js + MongoDB app at `https://symx-systems.vercel.app`.
> Sample driver for testing: `badgeNumber=2915` → `transporterId=A3NFCBK3U05AQY` → `NICHOLAS SANTOS`.

---

## PROMPT 1 — Scaffold the Flutter project

```
You are working inside the existing repo "SYMXSystems" (a Next.js + MongoDB app deployed at https://symx-systems.vercel.app).

Create a new Flutter project at:
  ./SYMXSystemsApp

Requirements:
- Flutter 3.22+ with null safety
- Platforms enabled: Android, iOS, Web, macOS, Windows
- Project name: symx_systems_app
- Org: com.symxsystems

Run:
  flutter create --org com.symxsystems --platforms=android,ios,web,macos,windows --project-name symx_systems_app SYMXSystemsApp

Then add these dependencies to pubspec.yaml and run `flutter pub get`:
  - go_router: ^14.0.0           # routing (deep links + web URLs)
  - dio: ^5.4.0                  # HTTP client
  - flutter_riverpod: ^2.5.1     # state management
  - shared_preferences: ^2.2.2   # local persistence
  - flutter_secure_storage: ^9.0.0  # secure token storage
  - google_fonts: ^6.2.1         # typography
  - lottie: ^3.1.0               # high-quality animations
  - flutter_animate: ^4.5.0      # cool one-line animations
  - shimmer: ^3.0.0              # loading shimmers
  - intl: ^0.19.0                # date formatting
  - cached_network_image: ^3.3.1
  - pin_code_fields: ^8.0.1      # PIN input UI

Create this folder structure inside lib/:
  lib/
    main.dart
    app.dart
    core/
      theme/
      constants/
      api/        (dio client + interceptors)
      router/     (go_router config)
    features/
      auth/
        data/
        presentation/
      home/
      inspections/
      notices/
      coming_soon/
    shared/
      widgets/
      models/

Confirm: list the project tree once done. Don't write any UI yet.
```

---

## PROMPT 2 — Theme, base app shell, and API client

```
Inside SYMXSystemsApp/, set up the foundation:

1. lib/core/constants/app_constants.dart
   - const String kApiBaseUrl = 'https://symx-systems.vercel.app';
   - const String kAppName = 'SYMX Systems';

2. lib/core/theme/app_theme.dart
   - Light + Dark themes using Google Fonts "Inter".
   - Primary: deep indigo (#4F46E5), Accent: emerald (#10B981).
   - Rounded corners (16), soft shadows, generous padding.
   - Material 3 enabled.

3. lib/core/api/api_client.dart
   - Dio instance with baseUrl = kApiBaseUrl.
   - Interceptor: attach `x-badge-token` header from FlutterSecureStorage if present.
   - Logging interceptor in debug only.

4. lib/core/router/app_router.dart
   - go_router with routes:
       /            → SplashScreen (decides login vs home)
       /login       → LoginScreen
       /home        → HomeShell with bottom nav (3 tabs)
       /inspections → branch of HomeShell
       /notices     → branch of HomeShell
       /coming-soon → branch of HomeShell
   - Use StatefulShellRoute.indexedStack for the bottom-nav tabs (preserves state per tab).
   - Web URL strategy: PathUrlStrategy (clean URLs, no #).

5. lib/main.dart
   - usePathUrlStrategy()
   - ProviderScope(child: SymxApp())
   - SymxApp returns MaterialApp.router with light/dark themes.

Acceptance: `flutter run -d chrome` opens a blank themed shell that routes to /login.
```

---

## PROMPT 3 — Add a badge-number login API endpoint to the Next.js backend

```
Open the existing Next.js project at the repo root (NOT inside SYMXSystemsApp).
We need a new public-ish endpoint the Flutter app can call to log in by badgeNumber only (PIN-style).

Create file: app/api/mobile/badge-login/route.ts

Behavior:
- Method: POST
- Body: { badgeNumber: string }
- Look up SymxEmployee by badgeNumber (trim, case-insensitive). Use the existing model at lib/models/SymxEmployee.ts.
- If not found OR employee.status !== "Active": return 401 { error: "Invalid badge number" }.
- If found, return:
    {
      success: true,
      employee: {
        transporterId,
        badgeNumber,
        firstName,
        lastName,
        fullName: "FIRSTNAME LASTNAME" (uppercase),
        profileImage,
        type
      },
      token: <signed JWT containing transporterId, badgeNumber, exp 30d>
    }
- Sign the JWT using process.env.JWT_SECRET (fall back to a constant for now if not set, but log a warning).
- Add CORS headers so the Flutter web app can call it from any origin:
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: POST, OPTIONS
    Access-Control-Allow-Headers: Content-Type
  Also handle OPTIONS preflight.

Also create: app/api/mobile/me/route.ts
- Method: GET
- Reads the JWT from header `x-badge-token`.
- Returns the employee object (same shape as above) or 401.

Do NOT touch any existing auth flow (lib/auth, app/api/auth/*). This is an additive, parallel auth path used only by the mobile app.

Test with:
  curl -X POST https://symx-systems.vercel.app/api/mobile/badge-login \
       -H "Content-Type: application/json" \
       -d '{"badgeNumber":"2915"}'
Expected: returns NICHOLAS SANTOS with transporterId A3NFCBK3U05AQY.
```

---

## PROMPT 4 — Add a transporter-scoped routes endpoint

```
Still in the Next.js repo (root), add a new endpoint that returns only the routes for ONE driver, used by the Flutter "Daily Inspections" screen.

Create file: app/api/mobile/my-routes/route.ts

Behavior:
- Method: GET
- Auth: read JWT from `x-badge-token` header. Reject 401 if missing/invalid.
- Query params: `yearWeek` (e.g. 2026-W19), `date` (e.g. 2026-05-09, optional — defaults to today in America/Los_Angeles).
- Internally reuse the same logic as app/api/dispatching/routes/route.ts BUT:
    * Force `transporterId` filter to the JWT's transporterId.
    * Skip the `requirePermission("Dispatching", "view")` and `authorizeAction` checks (this endpoint is auth'd by JWT, scoped to self).
    * Return only: routes[] (with employee name, type, routeNumber, van, routeDuration, waveTime, inspectionTime, actualDepartureTime, deliveryCompletionTime, profileImage), and the resolved date.

Add CORS headers (same as Prompt 3).

Test:
  curl "https://symx-systems.vercel.app/api/mobile/my-routes?yearWeek=2026-W19&date=2026-05-09" \
       -H "x-badge-token: <token from /badge-login>"
Expected: only Nicholas Santos's routes for that week/date.
```

---

## PROMPT 5 — Splash + Login screen with PIN entry and gorgeous animation

```
In the Flutter project (SYMXSystemsApp/), build the auth UI.

1. lib/features/auth/data/auth_repository.dart
   - login(badgeNumber): POST /api/mobile/badge-login → save token to FlutterSecureStorage under "badge_token", save employee JSON under "employee".
   - me(): GET /api/mobile/me using stored token.
   - logout(): clear storage.
   - Riverpod providers: authRepositoryProvider, currentEmployeeProvider (FutureProvider that calls me()).

2. lib/features/auth/presentation/splash_screen.dart
   - Animated SYMX logo (use flutter_animate: scale + fade + a subtle continuous shimmer).
   - On mount: call me(); if success → context.go('/home'); else → context.go('/login').
   - Hold splash for at least 900ms for polish.

3. lib/features/auth/presentation/login_screen.dart
   - Background: a soft animated indigo→emerald gradient (use AnimatedContainer cycling colors every 6s).
   - Top: SYMX wordmark fading in from above.
   - Center card (glassy, blur backdrop on web/desktop):
       * Title: "Welcome, Driver"
       * Subtitle: "Enter your Badge PIN to continue"
       * pin_code_fields: 4-digit numeric (autoFocus, haptic on enter, big tap targets)
       * Solid CTA "Sign In" with loading spinner state
       * Inline error chip on failure (shake animation via flutter_animate)
   - Footer: "v1.0 • SYMX Systems"
   - Responsive: on web/desktop wider than 600px, center the card at max-width 420.

4. On successful login:
   - Vibrate (HapticFeedback.mediumImpact).
   - context.go('/home') with a custom transition (scale + fade).

Use riverpod for the loading/error state. Keep the file under 300 lines per screen — extract widgets if needed.

Test login with badgeNumber 2915 (NICHOLAS SANTOS, transporterId A3NFCBK3U05AQY).
```

---

## PROMPT 6 — Home shell with bottom nav + welcome animation

```
Build the home shell with 3-tab bottom navigation.

1. lib/features/home/presentation/home_shell.dart
   - Receives StatefulNavigationShell from go_router.
   - Bottom nav:
       Tab 0: Daily Inspections — icon Icons.fact_check_outlined / fact_check
       Tab 1: Notices           — icon Icons.campaign_outlined / campaign
       Tab 2: Coming Soon       — icon Icons.auto_awesome_outlined / auto_awesome
   - Use a custom animated bottom bar:
       * Pill indicator that slides between selected items (AnimatedAlign + AnimatedContainer).
       * Selected item label fades in; unselected shows icon only.
       * Soft shadow above the bar.
   - AppBar: minimal — left = profile circle (initials of logged-in employee, tappable opens a drawer with logout), right = bell (notices count placeholder), center = current tab title.

2. lib/features/home/presentation/welcome_overlay.dart
   - On the FIRST visit to /home after login (track with a Riverpod flag), display a full-screen overlay for ~2 seconds:
       * Lottie confetti or burst animation (use any free Lottie URL or a bundled .json under assets/lottie/welcome.json).
       * Big text: "Hello, ${firstName} 👋" with a typewriter/slide-up effect.
       * Subtitle: today's date in America/Los_Angeles (use intl).
       * Auto-dismiss; tap anywhere to skip.

3. Initial selected tab = Daily Inspections.

Acceptance: after sign-in with PIN 2915, Nicholas sees "Hello, Nicholas 👋" and lands on Daily Inspections.
```

---

## PROMPT 7 — Daily Inspections screen (mirrors /dispatching/closing, scoped to driver)

```
Reference UI: https://symx-systems.vercel.app/dispatching/closing?week=2026-W19&date=2026-05-09
Reuse the column logic from app/(protected)/dispatching/closing/page.tsx in the Next.js repo, but rebuild it as a mobile-first Flutter screen.

1. lib/features/inspections/data/routes_repository.dart
   - getMyRoutes({yearWeek, date}): GET /api/mobile/my-routes (with x-badge-token).
   - Returns List<RouteRow>.

2. lib/shared/models/route_row.dart
   Fields (match backend response):
     id, transporterId, date, weekDay, employeeName, type, routeNumber, van,
     routeDuration, waveTime, inspectionTime, actualDepartureTime,
     deliveryCompletionTime, inspectionId, profileImage.

3. lib/features/inspections/presentation/inspections_screen.dart
   Layout (mobile-first, but adapts to wide screens):

   Top bar (sticky):
     - Date pill (taps → opens a horizontal date scroller for the current ISO week).
     - Week selector chip showing "Week 19, 2026" (taps → modal to switch weeks).
     - Current driver name + small avatar on the right.

   Body:
     - If loading → 5 shimmer rows.
     - If empty → friendly empty state ("No routes assigned for this day") with a soft Lottie.
     - Else → list of "Route Cards" (one per route row), each card showing:
         * Type pill (color from a getTypeStyle() helper — port the colors from lib/route-types.ts).
         * Route #, Van, Duration, Wave Time as compact labeled chips.
         * Status row showing Inspected / Departed / Delivered times — each with an icon, green check if present, gray dash if missing.
         * Tap a card → opens a bottom sheet with full route details and a placeholder "Start Inspection" CTA (disabled for now, label "Coming in next update").

   Wide screens (>= 900px):
     - Switch to a 2-column responsive grid.
     - Adds a left-side mini sidebar: "This Week" with a 7-day vertical date picker; selected day filters the list.

4. Animations:
   - Each card uses flutter_animate: fadeIn(duration: 200ms) + slideY(begin: 0.05) staggered by index * 40ms.
   - Pull-to-refresh on mobile; "Refresh" icon button on web/desktop top-right.

5. URL sync (web): when on /inspections, reflect ?week=2026-W19&date=2026-05-09 in the URL using go_router query params, so it matches the Next.js page paradigm.

Acceptance: open /inspections after PIN 2915 login → see only Nicholas Santos's routes for the current week, default date today (LA time).
```

---

## PROMPT 8 — Notices and Coming Soon tabs (lightweight placeholders)

```
1. lib/features/notices/presentation/notices_screen.dart
   - For now, return a static list of 3 example "company notices" cards (title, posted date, body excerpt) with a tappable card that expands inline (AnimatedSize).
   - Add a TODO comment: "TODO: Wire to /api/mobile/notices once endpoint exists."
   - Animate cards in with flutter_animate stagger.
   - Empty state Lottie if list is empty.

2. lib/features/coming_soon/presentation/coming_soon_screen.dart
   - Centered hero:
       * Lottie "rocket" or "construction" animation.
       * Big text: "Something awesome is coming."
       * Subtitle: "We're cooking up new tools for your daily ride."
       * Pill button "Notify me" — tap shows a snackbar "We'll let you know!".
   - Subtle parallax: the hero shifts a few pixels with mouse hover on web (use MouseRegion + AnimatedPositioned).

Both screens must respect the dark theme.
```

---

## PROMPT 9 — Polish pass: animations, dark mode, responsive web/desktop

```
Do a final polish pass on the SYMXSystemsApp Flutter app.

1. Page transitions:
   - Replace default route transitions with a unified custom transition: fade + slight scale (0.98 → 1.0) over 220ms.

2. Skeleton/shimmer everywhere:
   - Any list or async data shows a shimmer placeholder while loading (use the `shimmer` package).

3. Empty states:
   - Every screen has a friendly empty state with a small Lottie + helpful copy.

4. Error states:
   - Any failed network call shows an inline retry card (icon + message + "Try again" button), never a raw exception.

5. Web / desktop polish:
   - Set the document title via SystemChrome on web to "SYMX Systems".
   - In index.html, set theme-color to #4F46E5 and add a nicer favicon (use the existing /icon.png from the Next.js public folder if accessible).
   - Add max content width 1200 on desktop with horizontal padding, but allow inspection cards grid to expand.
   - Keyboard shortcuts on web: `r` to refresh current screen, `1/2/3` to switch tabs.
   - Hover effects on cards (subtle lift + shadow) when kIsWeb || desktop.

6. Logout:
   - Profile drawer "Sign out" button → clears secure storage → context.go('/login') with fade transition.

7. Build verification:
   - flutter analyze → 0 errors.
   - flutter test → passing.
   - flutter build web --release should succeed.

Don't add new dependencies unless absolutely required.
```

---

## PROMPT 10 — Build & host the web version

```
Build the Flutter web release and prep it for hosting alongside the existing Next.js app.

1. From SYMXSystemsApp/:
     flutter build web --release --base-href "/app/"

2. Copy the build output into the Next.js public folder so users can hit it at https://symx-systems.vercel.app/app/ :
     mkdir -p ../public/app
     cp -R build/web/* ../public/app/

3. In the Next.js repo, edit next.config.ts to add a rewrite so any /app/* deep link still serves index.html (single-page app behavior):
     async rewrites() {
       return [
         { source: '/app', destination: '/app/index.html' },
         { source: '/app/:path((?!.*\\.).*)', destination: '/app/index.html' },
       ];
     }

4. Verify locally:
     npm run dev  (in the Next.js repo)
     visit http://localhost:3000/app  → Flutter app should load and call the existing /api/mobile/* endpoints.

5. Deploy: just push to the same Vercel project — the Flutter web bundle ships as static assets under /app.

Final URLs:
  - Web/desktop browser:  https://symx-systems.vercel.app/app
  - Android APK:          flutter build apk --release  → SYMXSystemsApp/build/app/outputs/flutter-apk/app-release.apk
  - iOS IPA:              flutter build ipa            (requires Xcode + Apple dev account)

Acceptance:
  - Logging in with PIN 2915 from the web build at /app shows Nicholas Santos's daily inspections for the current week.
  - The same APK build works on Android with identical UX.
```

---

## Bonus — Smoke-test the whole thing

```
Run an end-to-end smoke test of SYMXSystemsApp:

1. Start backend locally (npm run dev in the Next.js repo) — confirm /api/mobile/badge-login responds.
2. flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000
3. Enter PIN 2915 → expect Nicholas Santos welcome animation.
4. Tap Daily Inspections → confirm only Nicholas's routes appear for current LA-time date in week 2026-W19.
5. Tap Notices → confirm static cards animate in.
6. Tap Coming Soon → confirm hero animation.
7. Sign out → returns to /login with fade transition.
8. Test offline: disconnect network mid-session — confirm friendly retry UI, not crashes.

Report any analyze warnings, lighthouse score on /app, and APK size.
```

---

## Sample data for testing
- `badgeNumber`: **2915**
- `transporterId`: **A3NFCBK3U05AQY**
- Driver: **NICHOLAS SANTOS**
- Reference web view: https://symx-systems.vercel.app/dispatching/closing?week=2026-W19&date=2026-05-09

## Tips for vibe-coding this
- Run prompts **in order** — each one builds on the previous.
- After each prompt, do a quick `flutter run -d chrome` sanity check before moving on.
- If the agent skips animations, push back with: "make this feel premium — add the flutter_animate stagger and the gradient I asked for."
- Keep the JWT secret out of the repo; set `JWT_SECRET` in Vercel env vars before shipping prompt 3.
