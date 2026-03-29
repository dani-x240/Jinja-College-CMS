#!/usr/bin/env bash
set -euo pipefail

# Appflow pre-build / web-build hook
# Installs deps, builds mobile web bundle, and syncs/copies into android/

echo "== Appflow pre-build: install and build web bundle =="
npm ci
npm run build:mobile

echo "== Syncing Capacitor and copying web assets into android/ =="
npx cap sync android
npx cap copy android

echo "Appflow pre-build finished"
