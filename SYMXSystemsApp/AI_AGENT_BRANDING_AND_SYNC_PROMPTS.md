# SYMXSystemsApp — Branding & Auto-Sync Fixes (Round 3)

> Two prompts: **A** fixes every branding mismatch (logo, favicon, PWA icons, splash screen).
> **B** makes the Flutter `/app` rebuild automatically on every Vercel deploy so you never have to manually copy build files again.
> Run them in order.

---

## PROMPT A — Unify branding everywhere (logo, favicon, splash, PWA)

```
The Flutter web app at /app currently shows the default Flutter favicon and the splash screen uses a generic truck icon. The root Next.js app uses public/logo.png (232x232) and public/symx-logo.png (1024x171 wordmark) — Flutter must use the SAME assets so the experience feels like one product.

Changes are split across three areas: Flutter web shell, Flutter Dart code, and the deployed bundle.

═════════════════════════════════════════════════════════════════
PART 1 — Copy SYMX logos into the Flutter project
═════════════════════════════════════════════════════════════════

From the SYMXSystems repo root, run:

  # Make sure assets folder exists
  mkdir -p SYMXSystemsApp/assets
  mkdir -p SYMXSystemsApp/web/icons

  # Wordmark (already used by login) — re-copy in case it's stale
  cp public/symx-logo.png SYMXSystemsApp/assets/symx-logo.png

  # Square logo for splash + PWA icons
  cp public/logo.png SYMXSystemsApp/assets/symx-icon.png

  # PWA icons for the Flutter web build (replace defaults)
  cp public/icons/icon-192x192.png SYMXSystemsApp/web/icons/Icon-192.png
  cp public/icons/icon-512x512.png SYMXSystemsApp/web/icons/Icon-512.png
  cp public/icons/icon-192x192.png SYMXSystemsApp/web/icons/Icon-maskable-192.png
  cp public/icons/icon-512x512.png SYMXSystemsApp/web/icons/Icon-maskable-512.png

  # Favicon
  cp public/logo.png SYMXSystemsApp/web/favicon.png

═════════════════════════════════════════════════════════════════
PART 2 — Register the new asset in pubspec.yaml
═════════════════════════════════════════════════════════════════

Edit SYMXSystemsApp/pubspec.yaml — under `flutter: assets:`, add the new icon line so the block looks like:

flutter:
  uses-material-design: true
  assets:
    - assets/lottie/welcome.json
    - assets/lottie/empty_box.json
    - assets/lottie/rocket.json
    - assets/symx-logo.png
    - assets/symx-icon.png

Then: cd SYMXSystemsApp && flutter pub get

═════════════════════════════════════════════════════════════════
PART 3 — Update the splash screen to use the real SYMX logo
═════════════════════════════════════════════════════════════════

Open SYMXSystemsApp/lib/features/auth/presentation/splash_screen.dart.

Replace the entire `// ── Logo Icon ──` Container block (the one using
Icons.local_shipping_rounded inside a gradient square) with:

              // ── Logo Icon ──
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryIndigo.withValues(alpha: 0.25),
                      blurRadius: 40,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Image.asset(
                    'assets/symx-icon.png',
                    width: 120,
                    height: 120,
                    fit: BoxFit.contain,
                  ),
                ),
              )
                  .animate()
                  .scale(
                    begin: const Offset(0.6, 0.6),
                    end: const Offset(1.0, 1.0),
                    duration: 600.ms,
                    curve: Curves.easeOutBack,
                  )
                  .fadeIn(duration: 400.ms)
                  .then()
                  .shimmer(
                    duration: 1800.ms,
                    color: Colors.white.withValues(alpha: 0.25),
                  ),

Keep everything else (the "SYMX / SYSTEMS" text below, the gradient
background) unchanged.

═════════════════════════════════════════════════════════════════
PART 4 — Update web/index.html with proper meta + favicon
═════════════════════════════════════════════════════════════════

Edit SYMXSystemsApp/web/index.html.

Replace the entire <head> section with:

<head>
  <base href="$FLUTTER_BASE_HREF">
  <meta charset="UTF-8">
  <meta content="IE=Edge" http-equiv="X-UA-Compatible">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="description" content="SYMX Systems — Driver operations app for inspections, routes, and notices.">

  <!-- Match the dark navy used by the root marketing app -->
  <meta name="theme-color" content="#0a0e1a">

  <!-- iOS PWA meta -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="SYMX Systems">

  <!-- Favicons -->
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="apple-touch-icon" href="icons/Icon-192.png">
  <link rel="manifest" href="manifest.json">

  <title>SYMX Systems</title>

  <style>
    /* Splash screen styles to hide white flash before Flutter loads */
    body {
      margin: 0;
      background-color: #0a0e1a;
      overflow: hidden;
    }
    /* Centered loader while Flutter bootstraps */
    #app-loader {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: #0a0e1a;
      transition: opacity 300ms ease;
    }
    #app-loader img {
      width: 96px; height: 96px;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1);   opacity: 1; }
      50%      { transform: scale(0.92); opacity: 0.6; }
    }
  </style>
</head>

Replace the <body> with:

<body>
  <div id="app-loader"><img src="favicon.png" alt="SYMX"></div>
  <script>
    // Hide the loader once Flutter's first frame paints.
    window.addEventListener('flutter-first-frame', () => {
      const el = document.getElementById('app-loader');
      if (!el) return;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    });
  </script>
  <script src="flutter_bootstrap.js" async></script>
</body>

═════════════════════════════════════════════════════════════════
PART 5 — Fix the PWA manifest colors and theme
═════════════════════════════════════════════════════════════════

The auto-generated SYMXSystemsApp/web/manifest.json should match the
root app's branding. Open it (or the file at public/app/manifest.json
if you want to fix the deployed copy).

Replace the JSON with:

{
  "name": "SYMX Systems",
  "short_name": "SYMX",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#0a0e1a",
  "theme_color": "#0a0e1a",
  "description": "SYMX Systems — Driver operations app",
  "orientation": "portrait-primary",
  "prefer_related_applications": false,
  "icons": [
    { "src": "icons/Icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/Icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/Icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/Icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}

═════════════════════════════════════════════════════════════════
PART 6 — Native icons for Android & iOS (so APK/IPA also branded)
═════════════════════════════════════════════════════════════════

Add the flutter_launcher_icons package as a dev dependency.

In pubspec.yaml, add to dev_dependencies:

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  flutter_launcher_icons: ^0.13.1

And add this top-level config block at the bottom of pubspec.yaml:

flutter_launcher_icons:
  android: "launcher_icon"
  ios: true
  image_path: "assets/symx-icon.png"
  min_sdk_android: 21
  web:
    generate: true
    image_path: "assets/symx-icon.png"
    background_color: "#0a0e1a"
    theme_color: "#0a0e1a"
  windows:
    generate: true
    image_path: "assets/symx-icon.png"
    icon_size: 256
  macos:
    generate: true
    image_path: "assets/symx-icon.png"

Then run:

  cd SYMXSystemsApp
  flutter pub get
  dart run flutter_launcher_icons

This regenerates icons for every platform from the same source PNG.

═════════════════════════════════════════════════════════════════
PART 7 — Rebuild and redeploy
═════════════════════════════════════════════════════════════════

  cd SYMXSystemsApp
  flutter clean
  flutter pub get
  flutter build web --release --base-href "/app/"
  rm -rf ../public/app
  mkdir -p ../public/app
  cp -R build/web/* ../public/app/

  cd ..
  git add SYMXSystemsApp public/app
  git commit -m "branding: unify SYMX logo across Flutter splash, favicon, PWA icons"
  git push

═════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═════════════════════════════════════════════════════════════════

After deploy, https://symx-systems.vercel.app/app must:
1. Show the SYMX logo (not a truck icon) on the splash screen.
2. Show the real SYMX favicon in the browser tab (not the default Flutter logo).
3. "Add to Home Screen" on mobile installs with the SYMX icon and dark navy splash.
4. The browser tab title reads "SYMX Systems".
5. Building the Android APK (`flutter build apk --release`) produces an
   app whose launcher icon matches the root web app's logo.
```

---

## PROMPT B — Make /app rebuild automatically on every Vercel deploy

```
Right now, the Flutter web bundle in public/app/ is a static snapshot
that only updates if someone manually runs `flutter build web` and copies
the output. Any time the Flutter source changes, public/app/ goes stale
unless that workflow is repeated. Fix this by automating the rebuild
inside the existing Vercel build pipeline.

The fix has three parts:
  1. A wrapper npm script that does the Flutter build then the Next.js build.
  2. Vercel install hook that fetches the Flutter SDK on the build server.
  3. Local helper script for fast iteration during development.

═════════════════════════════════════════════════════════════════
PART 1 — Add scripts to the root package.json
═════════════════════════════════════════════════════════════════

Edit SYMXSystems/package.json. Under "scripts", add the following entries (keep existing ones):

  "scripts": {
    "dev": "next dev",
    "dev:safe": "next dev --turbo=false",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "backup": "node scripts/run-backup.mjs",

    "flutter:build": "cd SYMXSystemsApp && flutter build web --release --base-href \"/app/\" && rm -rf ../public/app && mkdir -p ../public/app && cp -R build/web/* ../public/app/",
    "flutter:dev":   "cd SYMXSystemsApp && flutter run -d chrome --web-port=5050",

    "vercel-build": "bash scripts/vercel-flutter-build.sh && next build"
  }

Notes:
- `npm run flutter:build` rebuilds /app locally — call this before
  `git push` whenever you change Flutter code.
- `npm run flutter:dev` runs the Flutter app standalone in Chrome on
  http://localhost:5050 with hot reload — use this during active
  development instead of repeatedly building for /app.
- `vercel-build` is a Vercel-recognized hook that overrides the default
  `npm run build`. Vercel will run this instead, ensuring Flutter is
  built fresh on every deploy.

═════════════════════════════════════════════════════════════════
PART 2 — Create the Vercel build helper script
═════════════════════════════════════════════════════════════════

Create file: SYMXSystems/scripts/vercel-flutter-build.sh

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Runs during Vercel's build phase (via `vercel-build` npm script).
# Installs Flutter SDK, builds the web bundle, and copies it into
# /public/app so Next.js serves the latest version on every deploy.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

FLUTTER_VERSION="${FLUTTER_VERSION:-3.27.0}"
FLUTTER_DIR="$HOME/flutter"

echo "▸ SYMX Flutter Build — version $FLUTTER_VERSION"

# 1. Install Flutter SDK if not cached
if [ ! -d "$FLUTTER_DIR" ]; then
  echo "▸ Downloading Flutter $FLUTTER_VERSION ..."
  git clone --depth 1 --branch "$FLUTTER_VERSION" \
    https://github.com/flutter/flutter.git "$FLUTTER_DIR"
fi

export PATH="$FLUTTER_DIR/bin:$PATH"
flutter --version
flutter config --no-analytics
flutter precache --web

# 2. Build the Flutter web bundle
cd SYMXSystemsApp
flutter pub get
flutter build web --release --base-href "/app/"

# 3. Copy into the Next.js public folder so it ships with the deploy
cd ..
rm -rf public/app
mkdir -p public/app
cp -R SYMXSystemsApp/build/web/* public/app/

echo "✅  Flutter web bundle ready at public/app/"

Make the script executable:

  chmod +x scripts/vercel-flutter-build.sh
  git update-index --chmod=+x scripts/vercel-flutter-build.sh

═════════════════════════════════════════════════════════════════
PART 3 — Tell Vercel to use the new build command
═════════════════════════════════════════════════════════════════

Vercel automatically picks up `vercel-build` from package.json scripts —
no UI changes needed.

But also add SYMXSystems/vercel.json (create or update) so the build
settings are explicit and source-controlled:

{
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm install",
  "framework": "nextjs"
}

═════════════════════════════════════════════════════════════════
PART 4 — Stop tracking the build artifact in git
═════════════════════════════════════════════════════════════════

Since /public/app is now regenerated on every deploy, it shouldn't be
checked in.

Edit SYMXSystems/.gitignore — add at the bottom:

# Flutter web build output (regenerated on each deploy by vercel-build)
public/app/
SYMXSystemsApp/build/

Then untrack the existing copy WITHOUT deleting it locally:

  git rm -r --cached public/app
  git rm -r --cached SYMXSystemsApp/build || true
  git commit -m "ci: stop tracking generated Flutter web bundle"
  git push

═════════════════════════════════════════════════════════════════
PART 5 — Verify the new flow
═════════════════════════════════════════════════════════════════

Local sanity check:
  npm run flutter:build
  → public/app/ should be regenerated, no errors.

  npm run flutter:dev
  → Chrome opens http://localhost:5050 running the Flutter app standalone
    with hot reload (much faster iteration than rebuilding /app).

  npm run vercel-build
  → simulates a full Vercel deploy locally; should build Flutter then
    Next.js without errors.

Vercel deploy verification:
  - Push any Flutter source change.
  - Watch the Vercel deploy log; it should show "▸ Downloading Flutter ..."
    on first run, then "▸ SYMX Flutter Build — version 3.27.0", then the
    normal Next.js build.
  - Visit https://symx-systems.vercel.app/app and confirm the change is live.

═════════════════════════════════════════════════════════════════
WORKFLOW GOING FORWARD
═════════════════════════════════════════════════════════════════

Daily Flutter work:
  npm run flutter:dev    → fast hot-reload in Chrome at :5050

Before pushing changes:
  (nothing — Vercel rebuilds Flutter automatically on every deploy)

If you want a local preview at http://localhost:3000/app:
  npm run flutter:build
  npm run dev

═════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═════════════════════════════════════════════════════════════════

1. Editing any file in SYMXSystemsApp/lib/ and pushing to main results
   in https://symx-systems.vercel.app/app reflecting the change after
   Vercel finishes the deploy — without anyone manually running
   `flutter build` or copying files.

2. `git status` after a Flutter change shows only the Dart source
   modification, not anything under public/app/.

3. `npm run flutter:dev` opens the Flutter app in Chrome standalone
   with hot reload working.
```

---

## Why this is now bulletproof
- **Single source of truth:** Flutter source under `SYMXSystemsApp/lib/` is the only thing you commit. `public/app/` is treated like a `dist/` folder.
- **No drift possible:** Every Vercel deploy rebuilds the Flutter bundle from scratch. Whatever's live = whatever was committed.
- **Fast local dev:** `npm run flutter:dev` gives you proper Flutter hot reload (not `/app` reloads).
- **Branding consistent:** logo.png used for splash, favicon, PWA icons, Android launcher, iOS app icon, macOS, Windows — all driven from one source PNG.
