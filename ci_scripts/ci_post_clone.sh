#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT=${CI_WORKSPACE:-$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)}

cd "$ROOT"

echo "[itdasy:xcode-cloud] Node: $(node --version 2>/dev/null || echo missing)"
echo "[itdasy:xcode-cloud] npm: $(npm --version 2>/dev/null || echo missing)"

export CI=1
export HUSKY=0

# Xcode Cloud checks out source only. Recreate Capacitor's native iOS workspace
# before xcodebuild reads Pods-App.release.xcconfig.
npm ci --no-audit --no-fund
npx cap sync ios

cd ios/App

if ! command -v pod >/dev/null 2>&1; then
  echo "::error::CocoaPods is required in Xcode Cloud before building ios/App/App.xcworkspace."
  exit 1
fi

pod install --repo-update

if [ ! -f "Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig" ]; then
  echo "::error::Pods-App.release.xcconfig was not generated. Check CocoaPods output above."
  exit 1
fi

echo "[itdasy:xcode-cloud] CocoaPods workspace is ready."
