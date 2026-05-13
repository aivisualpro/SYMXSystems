# SYMX Flutter — iOS PWA + Android APK Parity Prompt Pack

Hand these prompts to your AI coding agent **one at a time, in order**.

## What I found in your Flutter project

**Stack:** `go_router`, `riverpod`, `dio`, `flutter_secure_storage`, `image_picker`, `shared_preferences`. Single `kIsWeb` branch in 13 files of source — clean.

**Actual parity risks I verified:**

1. **`kApiBaseUrl` is hardcoded to `https://symx-systems.vercel.app`** in `lib/core/constants/app_constants.dart`. That means the **web build at `/app/` calls cross-origin to Vercel** even though it could call its own origin. Works (CORS is set), but wasteful + breaks local dev (`flutter:dev` at `localhost:5050` calls production).

2. **`android/app/src/main/AndroidManifest.xml` only has `INTERNET`.** Missing `CAMERA` and `READ_MEDIA_IMAGES` — image_picker camera mode will crash on Android 13+. The web build doesn't need them; the APK does.

3. **`ios/Runner/Info.plist` has no `NSCameraUsageDescription`** etc. PWA on iOS doesn't need them, but if you ever publish a native iOS app it'll fail review.

4. **No `PopScope` / `onWillPop` on `inspection_form_screen.dart`.** Android hardware back + iOS Safari swipe-back will silently discard the form mid-edit.

5. **`flutter_secure_storage` falls back to localStorage on web.** iOS Safari evicts that after **7 days of no use** → driver gets kicked back to login. No biometric quick-unlock today, so they re-type badge each time.

6. **No offline queue.** Form submit during dead spots just fails — same problem on both platforms, but Android APK could solve it with `connectivity_plus` + retry on reconnect.

7. **No `launchMode` deep-link intent filter** for opening directly to an inspection from a notification. Not blocking, but normally industry-standard.

8. **`image_picker` uses different UX on web vs native** — and there's no platform-aware wrapper. The single `kIsWeb` branch currently handles only a date-picker dialog quirk.

---

## PASS 1 — API base URL: same-origin on web, absolute on native

```
Fix the hardcoded base URL so the web build calls same-origin and the Android APK calls the production URL — and so the dev build (flutter:dev at port 5050) can hit a local backend.

1. Edit `SYMXSystemsApp/lib/core/constants/app_constants.dart`:
   - Replace the single `kApiBaseUrl` constant with a helper that returns the right URL per platform + build mode.

     import 'package:flutter/foundation.dart';

     String get kApiBaseUrl {
       // Web build is served from the same Next.js server; use relative URLs.
       if (kIsWeb) return '';
       // Native (Android APK / iOS native): hit production by default.
       // Override via --dart-define=API_BASE_URL=... at build/run time.
       const fromDefine = String.fromEnvironment('API_BASE_URL');
       return fromDefine.isNotEmpty ? fromDefine : 'https://symx-systems.vercel.app';
     }

   - Keep `kAppName`, `kBadgeTokenKey`, `kEmployeeKey` unchanged.

2. Verify `lib/core/api/api_client.dart` already uses `kApiBaseUrl` for `BaseOptions.baseUrl` — no change needed, but confirm Dio handles empty baseUrl correctly (it does; requests like `/api/mobile/me` go to current origin).

3. Update root `package.json` Flutter dev script to allow overriding the URL:
     "flutter:dev": "cd SYMXSystemsApp && flutter run -d web-server --web-port=5050 --web-hostname=localhost --dart-define=API_BASE_URL=http://localhost:9568"
   - This only matters for native; web ignores it because of step 1.

4. Document in `SYMXSystemsApp/README.md` (create if missing) how to build the APK with a different backend:
     flutter build apk --release --dart-define=API_BASE_URL=https://staging.symx-systems.com

Done when:
- `grep -rn "symx-systems.vercel.app" SYMXSystemsApp/lib/` shows only the fallback line in `app_constants.dart`.
- Flutter web build mounted at `/app/` makes a request to `/api/mobile/me` (same-origin) — verify in Chrome devtools Network tab.
- Android APK debug build prints `[DIO] https://symx-systems.vercel.app/api/...` in logs.
- `flutter build web --release --base-href /app/ --pwa-strategy=none` succeeds.
```

---

## PASS 2 — Unsaved-form guard with `PopScope`

```
Stop Android's hardware back button and iOS Safari's swipe-back gesture from silently discarding form data.

1. Create `SYMXSystemsApp/lib/shared/widgets/unsaved_changes_guard.dart`:

     import 'package:flutter/material.dart';

     /// Wraps a screen body and prompts the user to confirm before
     /// popping if [hasUnsavedChanges] is true.
     class UnsavedChangesGuard extends StatelessWidget {
       const UnsavedChangesGuard({
         super.key,
         required this.hasUnsavedChanges,
         required this.child,
       });

       final bool hasUnsavedChanges;
       final Widget child;

       Future<bool> _confirmDiscard(BuildContext context) async {
         if (!hasUnsavedChanges) return true;
         final discard = await showDialog<bool>(
           context: context,
           builder: (ctx) => AlertDialog(
             title: const Text('Discard changes?'),
             content: const Text('You have unsaved inspection data. Leave anyway?'),
             actions: [
               TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Stay')),
               TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Discard')),
             ],
           ),
         );
         return discard ?? false;
       }

       @override
       Widget build(BuildContext context) {
         return PopScope(
           canPop: !hasUnsavedChanges,
           onPopInvokedWithResult: (didPop, result) async {
             if (didPop) return;
             final shouldPop = await _confirmDiscard(context);
             if (shouldPop && context.mounted) Navigator.of(context).pop();
           },
           child: child,
         );
       }
     }

2. Edit `SYMXSystemsApp/lib/features/inspections/presentation/inspection_form_screen.dart`:
   - Add a getter `bool get _hasUnsavedChanges` returning true if any of: mileage non-empty, comments non-empty, any photo set, repair fields touched, anyRepairs toggled. Compute from current form state.
   - Wrap the `Scaffold` body in `UnsavedChangesGuard(hasUnsavedChanges: _hasUnsavedChanges, child: ...)`.
   - After successful submit, set a `_justSaved = true` flag and read it inside `_hasUnsavedChanges` to bypass the prompt on the auto-pop.

3. Apply the same guard to any other multi-field forms in the Flutter app (search for files with multiple `TextEditingController` instances).

Done when:
- Filling the inspection form, then pressing Android back / iOS swipe-back → confirm dialog appears.
- Submitting the form → pops cleanly without the dialog.
- Empty form + back → pops immediately, no dialog.
- `flutter build web` and (if Android SDK installed) `flutter build apk --debug` both succeed.
```

---

## PASS 3 — Native platform permissions (Android + iOS native)

```
Make image_picker camera mode actually work on Android APK and prep for a future native iOS build.

1. Edit `SYMXSystemsApp/android/app/src/main/AndroidManifest.xml`:
   - Add these permissions just below the existing INTERNET line:
       <uses-permission android:name="android.permission.CAMERA"/>
       <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
       <uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
       <!-- Legacy gallery access on Android <= 12 -->
       <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
       <!-- Optional camera feature declaration (not required) -->
   - Add inside `<manifest>` (after the existing <queries>):
       <uses-feature android:name="android.hardware.camera" android:required="false"/>

2. Edit `SYMXSystemsApp/ios/Runner/Info.plist`:
   - Add inside the top-level <dict>:
       <key>NSCameraUsageDescription</key>
       <string>SYMX needs camera access to capture vehicle inspection photos.</string>
       <key>NSPhotoLibraryUsageDescription</key>
       <string>SYMX needs photo library access to attach inspection photos.</string>
       <key>NSPhotoLibraryAddUsageDescription</key>
       <string>SYMX needs permission to save inspection photos to your library.</string>

3. Create `SYMXSystemsApp/lib/shared/widgets/photo_source_sheet.dart` — a unified picker bottom sheet that:
   - On native: shows "Take Photo" (camera) + "Choose from Library" (gallery) options.
   - On web (kIsWeb): falls back to a single "Choose Photo" since iOS Safari PWA exposes the same `<input>` for both. Use `ImageSource.gallery` — the OS will offer camera as an option in the file picker.
   - Returns the picked `XFile?`.

4. Replace direct `ImagePicker().pickImage(...)` calls in `inspection_form_screen.dart` with the new helper.

Done when:
- Android APK install + camera capture works without crashes on Android 13+.
- iOS Safari PWA still works (since the helper falls back to gallery there).
- `flutter analyze` is clean.
```

---

## PASS 4 — Token-eviction recovery + optional biometric quick-unlock

```
iOS Safari PWA evicts localStorage after ~7 days of no use. Driver gets kicked back to login. Add a softer recovery path.

1. Edit `SYMXSystemsApp/lib/features/auth/data/auth_repository.dart`:
   - In the splash/initial check, when `_storage.read(kBadgeTokenKey)` returns null, do NOT clear the cached employee JSON if it exists. Keep the employee identity so we can offer a quick re-auth.
   - Add `Future<String?> getLastKnownBadgeNumber()` returning `employee?.badgeNumber` from the cached JSON.

2. Edit `SYMXSystemsApp/lib/features/auth/presentation/login_screen.dart`:
   - On mount, call `getLastKnownBadgeNumber()`. If non-null, prefill the badge input and show a small "Welcome back, <firstName>!" header.
   - Add a 1-line note: "Session expired — re-enter your badge to continue."

3. (Native only) Add `local_auth: ^2.2.0` to `pubspec.yaml`:
   - Add platform check helper `lib/core/auth/biometric_auth.dart`:
       Future<bool> isBiometricAvailable() async {
         if (kIsWeb) return false;
         final auth = LocalAuthentication();
         return await auth.canCheckBiometrics && await auth.isDeviceSupported();
       }

       Future<bool> authenticateWithBiometric() async {
         if (kIsWeb) return false;
         final auth = LocalAuthentication();
         return auth.authenticate(
           localizedReason: 'Unlock SYMX',
           options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
         );
       }

4. On the login screen, if cached employee exists AND biometric is available (native only), show a "Unlock with Face ID / Fingerprint" button that bypasses badge entry by re-using a cached refresh token. Skip this on web (button hidden under `kIsWeb` check) — web users always re-type their badge.

5. Add Android permission in AndroidManifest.xml:
       <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
   And iOS Info.plist:
       <key>NSFaceIDUsageDescription</key>
       <string>Use Face ID to quickly unlock SYMX.</string>

6. Backend: extend `app/api/mobile/badge-login/route.ts` to also accept a `refreshToken` field. Issue a long-lived refresh token (30 days) alongside the badge JWT. On the Flutter side, store the refresh token in secure storage and use it for biometric unlock to re-mint a fresh JWT without re-entering the badge.

Done when:
- iOS Safari PWA after 7-day eviction: opens login pre-filled with badge number + "Welcome back" header. One-tap re-auth.
- Android APK: shows Face ID / fingerprint button on login. Tap → unlocks without badge entry.
- Web hides the biometric button.
- `flutter analyze` clean, build succeeds.
```

---

## PASS 5 — Offline queue: capture submissions when wifi drops

```
Make the inspection submit survive a network drop on both platforms.

1. Add to `pubspec.yaml`:
   connectivity_plus: ^6.0.5

2. Create `SYMXSystemsApp/lib/core/sync/pending_inspections_queue.dart`:
   - In-memory list of pending submissions (or persisted via `shared_preferences` as JSON).
   - On enqueue: try to POST immediately. If it fails with a network error (not a 4xx), keep in queue and emit a UI signal.
   - Riverpod `connectivityStreamProvider` listens to `Connectivity().onConnectivityChanged`. When state flips from offline → online, drain the queue.
   - Cap queue at 20 items. Older ones drop with a `notify`-style toast warning.

3. Edit `inspection_form_screen.dart`:
   - On submit, enqueue rather than awaiting POST directly. Optimistically pop the form with `success: true` so the UI feels instant. Show a small "Saving in background…" Snackbar in the bottom-right.
   - If POST eventually fails permanently (4xx auth error), show a destructive Snackbar with a "Retry" action.

4. Add a tiny indicator dot in the app shell header (`home_shell.dart`) when the queue is non-empty: a yellow pulsing dot tooltipped "X inspections pending sync".

5. iOS PWA caveat: when the page is closed, the queue is lost. Add a guard: if the queue has items, attempting to navigate away from the inspections tab triggers a `PopScope` warning "X items still uploading — leave anyway?". On Android APK this isn't an issue because the queue persists in `shared_preferences`.

Done when:
- Airplane mode on, submit inspection, airplane mode off → inspection appears on server within 5s.
- Submitting 3 inspections offline, then reconnecting, shows the dot disappear as each completes.
- Closing the iOS PWA tab with pending items shows the warning.
- `flutter analyze` clean.
```

---

## PASS 6 — Parity verification matrix

```
Final pass — confirm both platforms behave identically. No new features.

1. Build all three artifacts:
   a. Web: `cd SYMXSystemsApp && flutter build web --release --base-href /app/ --pwa-strategy=none`
   b. Android APK: `cd SYMXSystemsApp && flutter build apk --release --dart-define=API_BASE_URL=https://symx-systems.vercel.app`
   c. (Optional) iOS native: `cd SYMXSystemsApp && flutter build ios --release` (requires macOS + Xcode)

2. Manually run the following scenarios on BOTH (iOS Safari PWA at `/app/inspections` AND Android APK installed from step 1b). Record pass/fail per cell in a markdown table at the repo root: `FLUTTER_PARITY_REPORT.md`.

   Test matrix:
   - Login with badge number → lands on /inspections
   - List shows today's routes for the driver
   - Tap an un-inspected route → form opens
   - Fill mileage, snap 4 photos via camera, repair=No, submit → card flips to inspected
   - Press hardware back / swipe-back mid-form → discard dialog appears
   - Submit succeeds → returns to list with optimistic update
   - Tap an already-inspected route → detail screen opens
   - Airplane mode + submit + airplane off → eventual success
   - Force-quit + reopen → still authenticated, list loads
   - Wait 8 days on iOS PWA → re-login pre-filled (or biometric on APK)
   - Pull to refresh → list updates

3. Verify Lighthouse PWA score on iOS Safari at /app/:
   - Performance: aim >= 80
   - PWA: all green
   - Accessibility: >= 90

4. Verify APK size: `ls -lh build/app/outputs/flutter-apk/app-release.apk` — should be under 25MB.

5. Run `flutter analyze` and `flutter test` — both clean.

6. Write a final `FLUTTER_PARITY_REPORT.md` with: build sizes, Lighthouse score, the 11-row test matrix table, and any divergences found.

Done when: every row in the matrix has ✓ on both columns, or has a documented intentional difference (e.g., "biometric: APK only").
```

---

## Tips for the agent

- **Don't change `kBadgeTokenKey` / `kEmployeeKey`** — that would orphan existing sessions on user devices.
- **`flutter_secure_storage` AndroidOptions(encryptedSharedPreferences: true)` is already correct** — don't switch to a different secure storage backend on Android (it triggers re-encryption on every install for some users).
- **The web build is served by Next.js from `public/app/`** — after every Flutter change you must run `npm run flutter:build` from the repo root, NOT just rebuild Flutter.
- **For the offline queue (Pass 5):** on iOS PWA, do NOT persist queue contents to localStorage that contain photo data — base64 photos will blow past the storage cap. Either upload photos eagerly (to Cloudinary) before enqueueing the metadata, or skip persistence on web entirely (`if (kIsWeb) return;` in the persist function).
- **For biometric auth (Pass 4):** make sure the `local_auth` plugin is added under `dependencies:`, not `dev_dependencies:`. Add the `MainActivity.kt` extending `FlutterFragmentActivity` instead of `FlutterActivity` on Android, or local_auth will throw at runtime.
- Run **one pass at a time**, commit, smoke-test, then proceed.
