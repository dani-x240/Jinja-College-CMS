FEATURES ADDED IN THE LAST 14 DAYS

This document lists the features, fixes, and scripts added to the repository during the last ~14 days.

Overview
- Restored a single authoritative `android/` native project into the repo root (copied from archived artifacts).
- Appflow hook scripts and config to ensure web bundle is built and copied into the native android project before packaging.
- Build automation and verification scripts for local use and CI parity.

Mobile / Appflow / CI
- `scripts/appflow-prebuild.sh` — installs deps, runs `npm run build:mobile`, removes stale native web assets, runs Capacitor sync/copy.
- `scripts/appflow-before-package.sh` — removes stale assets, runs cap copy, optionally runs `assembleRelease` when `APPFLOW_FORCE_RELEASE=1`.
- `appflow.config.json` — updated to include `hooks` arrays (`build:before`, `package:before`) to avoid jq parsing issues in CI.
- Added instructions & saved environment usage for `APPFLOW_FORCE_RELEASE=1` to trigger Release assemble in CI.
- Build stack used: Linux - 2025.11 (node 22.x, npm 10.x).

Android / Signing
- `scripts/generate-keystore.sh` / `.ps1` — helper scripts for local keystore generation.
- `.gitignore` updated to exclude `keys/` and keystore files.
- Guidance added for uploading `JinjaCMS-Key` to Appflow and mapping secrets (alias/password) in environments.

Web / React changes
- `src/components/Sidebar.js` — navigation title changed to "Jinja College CMS" (was "Jinja College cmc").
- `src/pages/Attendance.js` — restricted attendance marking to admins or regular teachers (not class teachers) via `canMarkAttendance` guard.
- `src/utils/autoSubmission.js` — auto-submission payloads now include full `lessons` JSON details for reports.

Scripts and Helpers
- `scripts/update-android-icons.ps1` — generate Android launcher icons from `public/icon.ico`.
- `scripts/restore-android.ps1` — restore `android/` project into repo root and run icon generation.
- `scripts/build-and-verify.ps1` — local automation to run restore -> build -> verify flow.

Repository maintenance
- `package-lock.json` updated and committed to fix CI `npm ci` mismatches.
- Fixed CI parsing error: "jq: Cannot iterate over null (null)" by adding `hooks` arrays to `appflow.config.json`.
- Added logic to delete stale native web assets before copying fresh web bundle into `android/app/src/main/assets/public`.

CI/Debug notes
- Ensure Appflow build uses the uploaded signing key `JinjaCMS-Key` and has `APPFLOW_FORCE_RELEASE=1` set for Release builds.
- When verifying builds, look for markers in logs: prebuild hook run, `npm run build:mobile` output, `npx cap copy` messages, before-package hook, and `./gradlew assembleRelease` outputs.

How to verify locally
- Build mobile web bundle locally:
  - `npm ci`
  - `npm run build:mobile`
  - `npx cap copy android`
  - Confirm `android/app/src/main/assets/public/index.html` has expected version/timestamp.

If you want more detail (file diffs, commit SHAs, or logs), tell me and I'll add them here.
