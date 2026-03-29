#!/usr/bin/env bash
set -euo pipefail

# Appflow pre-build / web-build hook
# Installs deps, builds mobile web bundle, and syncs/copies into android/

echo "== Appflow pre-build: install and build web bundle =="
npm ci
npm run build:mobile

echo "== Syncing Capacitor and copying web assets into android/ =="
# Ensure any checked-in or stale web assets in the native project are removed
if [ -d android/app/src/main/assets/public ]; then
	echo "Removing stale native web assets: android/app/src/main/assets/public"
	rm -rf android/app/src/main/assets/public
fi

# Sync and copy fresh assets
npx cap sync android
npx cap copy android

echo "Appflow pre-build finished"
