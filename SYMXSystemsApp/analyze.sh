#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# analyze.sh — Run full static analysis pipeline for SYMXSystemsApp
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║  SYMX Systems — Static Analysis          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Flutter version
echo "▸ Flutter version:"
flutter --version
echo ""

# 2. Pub get
echo "▸ flutter pub get..."
flutter pub get
echo ""

# 3. Format
echo "▸ dart format lib test..."
dart format lib test
echo ""

# 4. Analyze
echo "▸ flutter analyze..."
flutter analyze
echo ""

# 5. Test
echo "▸ flutter test..."
flutter test
echo ""

echo "✅  Analysis pipeline complete!"
