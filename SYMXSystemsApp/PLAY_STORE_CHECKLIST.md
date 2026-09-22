# SYMX Driver App — Launch Checklist (Rohan's manual steps)

Everything Claude could build is done and committed. Everything below
needs a human clicking through consoles Claude has no access to. Roughly
in the order you'd actually do them.

## 1. Backend environment variables (Vercel)

Go to your Vercel project → Settings → Environment Variables, and add:

- `FIREBASE_PROJECT_ID` — from the Firebase service account JSON you
  downloaded (Project Settings → Service Accounts → Generate new private
  key), the `project_id` field. Should be `symx-systems`.
- `FIREBASE_CLIENT_EMAIL` — the `client_email` field from that same file.
- `FIREBASE_PRIVATE_KEY` — the `private_key` field from that same file,
  pasted exactly as-is (it's a multi-line string starting with
  `-----BEGIN PRIVATE KEY-----`; Vercel's env var box handles the
  newlines fine, just paste the whole thing including the BEGIN/END
  lines).
- `NETRADYNE_WEBHOOK_KEY` — make up a long random string (e.g. run
  `openssl rand -hex 24` in a terminal). This is the shared secret between
  Netradyne and your webhook endpoint — keep it, you'll need it in step 4.

Redeploy after adding these (Vercel → Deployments → redeploy latest, or
just push a commit).

## 2. Release keystore (one-time, for real)

```
cd ~/Cluade/SYMX/SYMXSystemsApp/android
keytool -genkey -v -keystore symx-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias symx
```

It'll ask for a store password, key password, and some certificate
identity questions. Then create `android/key.properties` (copy
`key.properties.example` and fill in real values — see that file for the
exact format).

**Back up `symx-release.jks` and its passwords somewhere safe** (password
manager, encrypted drive). If you lose this file, you can never publish
an update to this app under its existing Play Store listing again —
you'd have to create a whole new listing from scratch.

## 3. Build the release bundle

```
cd ~/Cluade/SYMX/SYMXSystemsApp
flutter pub get
flutter build appbundle --release
```

Output: `build/app/outputs/bundle/release/app-release.aab` — this is
the file you upload to Play Console (Google requires an .aab, not .apk,
for new apps).

If `flutter pub get` or the build itself complains about anything, that's
useful signal Claude couldn't verify without the Flutter SDK installed —
paste the error back and it can help debug.

## 4. Configure the Netradyne webhook

In the Netradyne partner portal, find the webhook / integration settings
and set the Alert Webhook destination URL to:

```
https://symx-systems.vercel.app/api/public/netradyne-webhook?key=YOUR_NETRADYNE_WEBHOOK_KEY
```

(the same random string you put in `NETRADYNE_WEBHOOK_KEY` in step 1).
If Netradyne's setup requires you to select which alert severities or
event types to send, include at minimum severity 1 (ALERT/SEVERE) and 2
(WARN/MODERATE) — those are the only ones that page a driver's phone.

**Map your drivers**: the webhook identifies drivers by Netradyne's own
driver ID, which has no automatic link to your SYMX employee records. For
each driver, open their HR profile in SYMX and set their Netradyne Driver
ID (find this in the Netradyne portal's driver list) — until this is set,
alerts fall back to matching by first+last name, which works but is more
fragile (breaks on name mismatches/typos between the two systems).

*(Note: there's currently no dedicated field on the employee edit form
for this yet — the database field `netradyneDriverId` exists, but ask
Claude to add a UI input for it if you want to set these without a
database script.)*

## 5. Google Play Console — create the app

1. Play Console → Create app → fill in name/language/app-or-game/free-or-paid.
2. Store listing: use `PLAY_STORE_LISTING.md` (same folder as this file)
   for all the copy — it's written to paste directly into each field.
3. Upload the app icon, feature graphic, and phone screenshots (see the
   Graphics table in that file for what's still needed — Claude can't
   generate real screenshots of a running app or original artwork).
4. App content section: content rating questionnaire, data safety form,
   target audience, and "App access" (provide a test login) — all
   detailed in `PLAY_STORE_LISTING.md`.
5. Set the privacy policy URL: `https://symx-systems.vercel.app/privacy`.

## 6. Closed testing (required for new developer accounts)

Google requires new Play Console developer accounts to run a closed test
with at least 12 testers for 14 continuous days before a production
release is allowed. If your Play Console account is new:

1. Play Console → Testing → Closed testing → create a track, upload the
   .aab from step 3.
2. Add at least 12 testers by email (real employees is fine — they'll
   need to opt in via a link Play Console gives you).
3. Wait out the 14-day window with the test track active.
4. After that, promote the release to Production.

If your Play Console account is NOT new (has published apps before),
you can likely skip straight to a production release — Play Console will
tell you which applies to your account when you try to create a release.

## 7. Submit for review

Once the store listing, content rating, data safety, and release are all
complete, submit for review. Google's review typically takes a few days
to a couple weeks for a first submission; expect possible back-and-forth
if the reviewer has questions about the "App access" test credentials or
the employee-only nature of the app.

## 8. After it's live

- Test the whole flow end-to-end on a real phone install from the Play
  Store: login, submit an inspection, complete an end-of-day task, and
  (once a driver has their Netradyne Driver ID mapped and the webhook is
  live) trigger a real safety event to confirm the push + spoken alert
  actually arrives.
- Keep `symx-release.jks` and `key.properties` backed up — every future
  update needs the same signing key.
