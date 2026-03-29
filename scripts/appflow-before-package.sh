#!/usr/bin/env bash
set -euo pipefail

# Appflow native before-packaging hook
# Ensure web assets are copied into the native Android project before Gradle packages

echo "== Appflow before-package: copy web assets into android/ =="
npx cap copy android

echo "== Sanity check: index.html location =="
if [ -f android/app/src/main/assets/public/index.html ]; then
  echo "Found: android/app/src/main/assets/public/index.html"
  ls -l android/app/src/main/assets/public/index.html
elif [ -f android/app/src/main/assets/www/index.html ]; then
  echo "Found: android/app/src/main/assets/www/index.html"
  ls -l android/app/src/main/assets/www/index.html
else
  echo "Warning: index.html not found in expected locations"
fi

echo "Appflow before-package finished"
