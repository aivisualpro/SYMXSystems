# SYMXSystemsApp — Fix Prompts (Audit Round 2)

> Copy-paste each block (in order) into your AI coding agent.
> Each prompt is self-contained.
> Project root = `SYMXSystems/` (Next.js). Flutter app = `SYMXSystems/SYMXSystemsApp/`.

---

## FIX 1 — Build the Flutter web bundle and deploy under /app (BLOCKER)

```
The Flutter web build hasn't been produced yet, so https://symx-systems.vercel.app/app currently 404s.

Inside the SYMXSystems repo:

1. Build:
     cd SYMXSystemsApp
     flutter clean
     flutter pub get
     flutter build web --release --base-href "/app/" --pwa-strategy=none

2. Verify build succeeded:
     ls build/web/index.html

3. Copy bundle into the Next.js public folder:
     cd ..
     rm -rf public/app
     mkdir -p public/app
     cp -R SYMXSystemsApp/build/web/* public/app/

4. Confirm next.config.ts already has these rewrites (they should be there from the original prompt):
     { source: "/app", destination: "/app/index.html" },
     { source: "/app/:path((?!.*\\.).*)", destination: "/app/index.html" },

5. Local sanity check:
     npm run dev
     visit http://localhost:3000/app → Flutter login screen should render.
     Login with PIN 2915 → should show Nicholas Santos's daily inspections.

6. Commit and push:
     git add public/app SYMXSystemsApp next.config.ts
     git commit -m "ship: deploy Flutter web bundle under /app"
     git push

After Vercel deploys, https://symx-systems.vercel.app/app must load the Flutter app.
Acceptance: PIN 2915 login on the live URL returns Nicholas Santos and routes for the current LA date in week 2026-W19.
```

---

## FIX 2 — Set a real JWT_SECRET in Vercel and verify it locally

```
The mobile auth endpoints sign JWTs using process.env.JWT_SECRET. Locally it's "symx" (4 chars) which is too weak for production HS256.

1. Generate a strong secret locally (one-liner):
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

2. Update SYMXSystems/.env with the new value:
     JWT_SECRET="<the 128-hex-char string>"

3. Add the same secret to Vercel:
     - Go to Vercel project → Settings → Environment Variables
     - Add JWT_SECRET for Production AND Preview, paste the same value
     - Redeploy

4. Confirm the three mobile endpoints still validate after rotation:
   In SYMXSystems/app/api/mobile/badge-login/route.ts,
   SYMXSystems/app/api/mobile/me/route.ts,
   SYMXSystems/app/api/mobile/my-routes/route.ts —
   they all read process.env.JWT_SECRET. Confirm the fallback constant is unchanged so dev still works.

5. After deploy, any previously-issued tokens are now invalid (expected). Force a fresh login on test devices.

Test:
   curl -X POST https://symx-systems.vercel.app/api/mobile/badge-login \
     -H "Content-Type: application/json" \
     -d '{"badgeNumber":"2915"}' | jq .
   → expect success:true and a token whose first segment decodes to {"alg":"HS256","typ":"JWT"}.
```

---

## FIX 3 — Add Lottie animations (welcome, empty states, coming-soon hero)

```
The pubspec includes `lottie: ^3.1.0` but no Lottie JSON files exist. Replace the placeholder UIs with real Lottie animations.

In SYMXSystemsApp/:

1. Create the assets folder:
     mkdir -p assets/lottie

2. Download three free Lottie JSONs from lottiefiles.com (or any free source). Save as:
     assets/lottie/welcome.json        — confetti burst / celebration
     assets/lottie/empty_box.json      — friendly empty state (used by Notices empty list)
     assets/lottie/rocket.json         — rocket launch (used by Coming Soon hero)

3. Register them in pubspec.yaml under the `flutter:` block:

flutter:
  uses-material-design: true
  assets:
    - assets/lottie/welcome.json
    - assets/lottie/empty_box.json
    - assets/lottie/rocket.json

4. Run:
     flutter pub get

5. Update lib/features/home/presentation/welcome_overlay.dart:
   - Replace the custom-painted particle burst with:
       Lottie.asset('assets/lottie/welcome.json',
         width: 280, height: 280, repeat: false, fit: BoxFit.contain)
   - Keep the existing typewriter/slide-up "Hello, $firstName 👋" text on top of it.
   - Keep the auto-dismiss + tap-to-skip behavior.

6. Update lib/features/coming_soon/presentation/coming_soon_screen.dart:
   - Replace the hero icon with:
       Lottie.asset('assets/lottie/rocket.json',
         width: 240, height: 240, repeat: true)
   - Keep the existing parallax/hover effect.

7. Update lib/features/notices/presentation/notices_screen.dart:
   - When the list is empty, show the Lottie:
       Lottie.asset('assets/lottie/empty_box.json',
         width: 180, height: 180, repeat: true)
     above the existing copy.

8. Update lib/features/inspections/presentation/inspection_widgets.dart:
   - In the "no routes for this day" empty state inside _RoutesList, also use empty_box.json (180x180).

Rebuild for web after changes (FIX 1 step 1-4 again).
Acceptance: welcome overlay plays a Lottie celebration; coming-soon hero shows an animated rocket; empty states show a Lottie instead of a static icon.
```

---

## FIX 4 — Replace the UTC-7 hack with proper America/Los_Angeles timezone handling

```
In SYMXSystemsApp/lib/features/inspections/presentation/inspection_widgets.dart the function todayLA() hardcodes UTC-7, which is wrong for ~5 months of the year (PST = UTC-8). This can flip the date at midnight in winter.

Replace the approximation with the timezone package.

1. Add to pubspec.yaml:
     timezone: ^0.9.4

2. Run: flutter pub get

3. In lib/main.dart, initialize the tz database BEFORE runApp:

     import 'package:timezone/data/latest_all.dart' as tzdata;
     import 'package:timezone/timezone.dart' as tz;

     void main() {
       WidgetsFlutterBinding.ensureInitialized();
       usePathUrlStrategy();
       tzdata.initializeTimeZones();
       runApp(const ProviderScope(child: SymxSystemsApp()));
     }

4. In lib/features/inspections/presentation/inspection_widgets.dart, replace todayLA() with:

     String todayLA() {
       final la = tz.getLocation('America/Los_Angeles');
       final now = tz.TZDateTime.now(la);
       return '${now.year}-${_pad(now.month)}-${_pad(now.day)}';
     }

5. Remove the old UTC-7 comment.

6. Manual sanity test:
   - Run on web at 11:30 PM Pacific in winter (or simulate by changing system clock):
     `todayLA()` should return today's date, not tomorrow's.
   - Confirm flutter analyze still passes.

Acceptance: today's date in the inspections screen always matches the date shown by the existing /dispatching/closing Next.js page.
```

---

## FIX 5 — Make splash feel instant: cached-first, refresh-in-background

```
Currently lib/features/auth/presentation/splash_screen.dart always calls /api/mobile/me over the network before routing to /home, which adds latency on every cold start and breaks offline launches.

Refactor so the splash:
1. Checks if a token exists.
2. Reads the cached Employee JSON from FlutterSecureStorage.
3. If both present → route to /home immediately (after the 900 ms minimum hold).
4. Kick off a background /me call to refresh the cache silently. If it returns 401, wipe storage and bump the user back to /login on the next interaction.

In SYMXSystemsApp/lib/features/auth/presentation/splash_screen.dart:

1. Replace _checkAuthAndNavigate with:

     Future<void> _checkAuthAndNavigate() async {
       final repo = ref.read(authRepositoryProvider);

       final results = await Future.wait([
         _resolveEmployee(repo),
         Future.delayed(const Duration(milliseconds: 900)),
       ]);
       if (!mounted) return;
       final employee = results[0] as Employee?;

       if (employee != null) {
         ref.read(showWelcomeOverlayProvider.notifier).state = false;
         context.go('/home');
         // Background refresh — don't await.
         _backgroundRefresh(repo);
       } else {
         context.go('/login');
       }
     }

     Future<Employee?> _resolveEmployee(AuthRepository repo) async {
       if (!await repo.hasToken) return null;
       final cached = await repo.cachedEmployee();
       if (cached != null) return cached;
       try { return await repo.me(); } catch (_) { return null; }
     }

     Future<void> _backgroundRefresh(AuthRepository repo) async {
       try {
         await repo.me();
         ref.invalidate(currentEmployeeProvider);
       } catch (_) {
         // Token expired/invalid — clear silently. User will be bumped on next API failure.
         await repo.logout();
       }
     }

2. In lib/features/home/presentation/home_shell.dart, when the drawer "Sign out" button is tapped, call:

     await ref.read(authRepositoryProvider).logout();
     ref.invalidate(currentEmployeeProvider);
     if (context.mounted) context.go('/login');

   Confirm currentEmployeeProvider invalidates so the cached profile is dropped.

Acceptance: subsequent app launches show /home in under 1 second; turning off network at launch still shows the cached driver profile and routes screen with a friendly retry card on the data fetch.
```

---

## FIX 6 — Run flutter analyze + format and fix any issues before shipping

```
We haven't run static analysis yet. Do a clean pass on SYMXSystemsApp/.

1. cd SYMXSystemsApp
2. flutter --version          # confirm SDK >= 3.27 (we use Color.withValues which needs 3.27)
3. flutter pub get
4. dart format lib test
5. flutter analyze            # must end with "No issues found!"
6. flutter test               # must pass (delete the default counter test if it doesn't apply)

Common issues to expect and how to fix:
- "withValues isn't defined" → upgrade Flutter SDK to 3.27+, or temporarily swap to .withOpacity() (deprecated but works).
- "Unused import" → remove.
- "BuildContext used across async gaps" → add `if (!context.mounted) return;` guards.
- "Avoid using BuildContext across async gaps" in welcome_overlay → wrap in mounted check.
- "Use of deprecated member" for any package → bump to latest minor in pubspec.yaml and re-pub get.

Output a one-line summary at the end:
   ✅ analyze: 0 issues  •  format: clean  •  tests: N passed
or list every remaining warning verbatim.
```

---

## FIX 7 — Wire a global 401 handler so expired tokens force re-login

```
Right now, if the JWT expires while the app is open, API calls just fail with a generic error. Instead, on any 401 from /api/mobile/* the app should clear the token and bounce the user back to /login.

In SYMXSystemsApp/lib/core/api/api_client.dart, add a second interceptor below _AuthInterceptor:

class _UnauthorizedInterceptor extends Interceptor {
  _UnauthorizedInterceptor(this._onUnauthorized);
  final Future<void> Function() _onUnauthorized;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 &&
        (err.requestOptions.path).startsWith('/api/mobile/')) {
      await _onUnauthorized();
    }
    handler.next(err);
  }
}

Wire it up inside dioProvider AFTER the auth interceptor:

dio.interceptors.add(_UnauthorizedInterceptor(() async {
  await ref.read(secureStorageProvider).delete(key: kBadgeTokenKey);
  await ref.read(secureStorageProvider).delete(key: kEmployeeKey);
  ref.invalidate(currentEmployeeProvider);
  // Use the global navigator key from go_router to redirect.
  final router = ref.read(routerProvider);
  router.go('/login');
}));

Note: the dioProvider closure captures `ref` so this is straightforward. If the linter complains about using ref inside the closure, mark dioProvider as Provider<Dio> and capture ref from the outer build.

Acceptance:
   - Manually delete/expire the JWT in DevTools → IndexedDB on web (or use a 1-second token expiry for testing).
   - Trigger any /api/mobile/* call → app should auto-redirect to /login with a snackbar "Session expired".
```

---

## Bonus — Final smoke test after all fixes

```
After running FIX 1-7, do a full end-to-end test of the live deployed app at https://symx-systems.vercel.app/app:

1. Open the URL in an incognito window → splash → /login.
2. Enter PIN 2915 → see Lottie welcome animation → land on /inspections.
3. Confirm only Nicholas Santos's routes appear for today's LA date in week 2026-W19.
4. Tap a route card → bottom sheet with placeholder "Start Inspection".
5. Switch to Notices tab → see static cards animate in.
6. Switch to Coming Soon → see Lottie rocket + parallax hover.
7. Open browser DevTools → Application → Storage → delete the badge_token key.
8. Try to switch tabs / refresh inspections → should bounce to /login automatically.
9. Sign in again → should NOT show welcome overlay (returning user fast path).
10. Resize the browser to 1400px wide → inspections layout switches to 2-column grid + sidebar.
11. Build the Android APK: `cd SYMXSystemsApp && flutter build apk --release` → install on device → same UX.

Report:
   - Lighthouse score for /app (aim for 90+ Performance, 100 Best Practices).
   - APK size.
   - Any console errors or 4xx/5xx network calls.
```

---

## Quick checklist
- [ ] FIX 1 — web build + deploy under `/app` (blocker)
- [ ] FIX 2 — JWT_SECRET in Vercel env vars
- [ ] FIX 3 — Lottie assets registered + used in 4 screens
- [ ] FIX 4 — timezone package for accurate LA date
- [ ] FIX 5 — cached-first splash + logout invalidates provider
- [ ] FIX 6 — flutter analyze + format + test all clean
- [ ] FIX 7 — 401 interceptor auto-redirects to /login
- [ ] Smoke test passes end-to-end on live URL
