#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT=${CI_WORKSPACE:-$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)}

cd "$ROOT"

if [ ! -f "ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig" ]; then
  echo "::error::Missing CocoaPods release xcconfig. ci_post_clone.sh must run before xcodebuild."
  exit 1
fi

if [ ! -f "ios/App/App/PrivacyInfo.xcprivacy" ]; then
  echo "::error::Missing iOS Privacy Manifest at ios/App/App/PrivacyInfo.xcprivacy."
  exit 1
fi

/usr/bin/plutil -lint ios/App/App/Info.plist ios/App/App/PrivacyInfo.xcprivacy

echo "[itdasy:xcode-cloud] iOS review preflight passed."
