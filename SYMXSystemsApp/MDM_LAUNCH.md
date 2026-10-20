# Driver app — launch on locked-down work phones (managed Google Play)

Because the phones are managed by Google MDM, publish the app as a **private
app** in managed Google Play. This skips the public store review and the
12-tester / 14-day closed test (those in PLAY_STORE_CHECKLIST.md only apply
to public listings). Steps 1–2 and 4 of that checklist still apply.

## A. One-time setup
1. Vercel env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
   FIREBASE_PRIVATE_KEY, NETRADYNE_WEBHOOK_KEY (see checklist step 1). Redeploy.
2. Create the release keystore and `android/key.properties` (checklist step 2).
   Back up `symx-release.jks` — you can never update the app without it.
3. Build: `cd SYMXSystemsApp && flutter pub get && flutter build appbundle --release`
   → `build/app/outputs/bundle/release/app-release.aab`.
4. Netradyne portal: set the alert webhook to
   `https://symx-systems.vercel.app/api/public/netradyne-webhook?key=NETRADYNE_WEBHOOK_KEY`
   (severities 1 and 2). Drivers match by Netradyne driver ID, else by exact
   first+last name.

## B. Publish privately
1. play.google.com/console → **Create app** (name "SYMX Driver").
2. Left menu → **Advanced settings → Managed Google Play** → turn on
   **Private app** and add your organization ID (from your MDM / Google admin).
3. Create a release (Production or Internal testing track), upload the `.aab`,
   complete the required forms (content rating, data safety, privacy policy
   `https://symx-systems.vercel.app/privacy`). Private apps still need these
   but are typically approved within hours.

## C. Push it to the phones (MDM policy)
In the MDM console, for the work-phone policy:
- Add **SYMX Driver** (`com.symxsystems.symx_systems_app`) as **Force-installed**
  and allow it in kiosk/lock-task if you use that.
- Grant the **notifications** permission automatically (Android 13+) so drivers
  can't turn it off.
- Exempt the app from **battery optimization / Doze** and allow background
  activity. This is the single biggest factor in alerts arriving instantly.
- Do not let users clear data or force-stop the app, if your MDM supports it.
- Make sure the phone's volume policy doesn't mute the **alarm** stream (the
  alert plays on the alarm channel so it sounds even when media is muted).

## D. Verify each phone (30 seconds)
1. Open the app, type the driver's email, sign in.
2. Today tab → should say **Safety alerts are on** → tap **Send test alert**.
   Expect a loud siren and a notification within a few seconds.
3. Lock the screen, repeat. Then swipe the app away, repeat.
   If step 3 is silent, battery-optimization exemption (section C) is missing.

## E. What a driver gets in this release
Sign in by email → Today (van, route, wave, stops, VIN, alert status/test) →
Inspections with photos → Notices → End-of-Day tasks → real-time Netradyne
alerts (siren + spoken message) while signed in.

## F. Next releases (not in this build)
Surveys, feedback, performance-concern acknowledgement, training-video library.
