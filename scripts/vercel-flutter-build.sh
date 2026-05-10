#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# vercel-flutter-build.sh
# Runs on Vercel's build server to:
#   1. Install the Flutter SDK (cached across deploys)
#   2. Build the Flutter web bundle
#   3. Copy the output into public/app/ so Next.js serves it
#   4. Run the normal Next.js build
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

FLUTTER_CHANNEL="stable"
FLUTTER_VERSION="3.38.4"
FLUTTER_ROOT="$HOME/.flutter-sdk"
FLUTTER_BIN="$FLUTTER_ROOT/bin"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLUTTER_APP="$PROJECT_ROOT/SYMXSystemsApp"
PUBLIC_APP="$PROJECT_ROOT/public/app"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  SYMX Systems — Vercel Flutter + Next.js Build  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Install Flutter SDK (or reuse cache) ──────────────────────
if [ -x "$FLUTTER_BIN/flutter" ]; then
  echo "▸ Flutter SDK found in cache"
else
  echo "▸ Installing Flutter SDK $FLUTTER_VERSION ($FLUTTER_CHANNEL)..."
  git clone --depth 1 --branch "$FLUTTER_VERSION" \
    https://github.com/flutter/flutter.git "$FLUTTER_ROOT"
fi

export PATH="$FLUTTER_BIN:$PATH"

echo "▸ Flutter version:"
flutter --version
echo ""

# ── 2. Build Flutter web ─────────────────────────────────────────
echo "▸ Building Flutter web (release)..."
cd "$FLUTTER_APP"
flutter pub get
flutter build web --release --base-href "/app/" --pwa-strategy=none

if [ ! -f build/web/index.html ]; then
  echo "❌  Flutter build FAILED — build/web/index.html not found"
  exit 1
fi
echo "✅  Flutter web build succeeded"
echo ""

# ── 3. Copy to public/app/ ──────────────────────────────────────
echo "▸ Copying Flutter build → public/app/ ..."
rm -rf "$PUBLIC_APP"
mkdir -p "$PUBLIC_APP"
cp -R build/web/* "$PUBLIC_APP/"
echo "   Size: $(du -sh "$PUBLIC_APP" | cut -f1)"
echo ""

# ── 4. Build Next.js ─────────────────────────────────────────────
echo "▸ Building Next.js..."
cd "$PROJECT_ROOT"
npm run build

echo ""
echo "✅  Full build complete (Flutter + Next.js)"
echo ""
