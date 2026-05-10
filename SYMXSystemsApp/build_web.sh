#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# build_web.sh — Build Flutter web release and copy to Next.js /public/app
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_DIR="$SCRIPT_DIR"
NEXTJS_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_APP="$NEXTJS_DIR/public/app"

echo "╔══════════════════════════════════════════╗"
echo "║  SYMX Systems — Flutter Web Build        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Clean previous build
echo "▸ Cleaning previous build..."
cd "$FLUTTER_DIR"
flutter clean

# 2. Fetch dependencies
echo ""
echo "▸ Fetching dependencies..."
flutter pub get

# 3. Build Flutter web release
echo ""
echo "▸ Building Flutter web (release)..."
flutter build web --release --base-href "/app/" --pwa-strategy=none

# 4. Verify build succeeded
if [ ! -f build/web/index.html ]; then
  echo "❌  Build FAILED — build/web/index.html not found"
  exit 1
fi
echo "✅  build/web/index.html found"

# 5. Copy to Next.js public folder
echo ""
echo "▸ Copying build output to $PUBLIC_APP ..."
rm -rf "$PUBLIC_APP"
mkdir -p "$PUBLIC_APP"
cp -R build/web/* "$PUBLIC_APP/"

# 6. Report
echo ""
echo "✅  Build complete!"
echo ""
echo "   Web build:  $PUBLIC_APP"
echo "   Size:       $(du -sh "$PUBLIC_APP" | cut -f1)"
echo ""
echo "   Next steps:"
echo "   1. cd $NEXTJS_DIR"
echo "   2. npm run dev"
echo "   3. Visit http://localhost:3000/app"
echo "   4. Login with PIN 2915 → see Nicholas Santos's inspections"
echo ""
echo "   To deploy:"
echo "   cd $NEXTJS_DIR"
echo "   git add public/app SYMXSystemsApp next.config.ts"
echo '   git commit -m "ship: deploy Flutter web bundle under /app"'
echo "   git push"
echo ""
echo "   The Flutter web bundle ships as static assets under /app."
