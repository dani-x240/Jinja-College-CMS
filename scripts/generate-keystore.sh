#!/usr/bin/env bash
set -euo pipefail

# Generate an Android keystore for signing releases.
# Usage: ./scripts/generate-keystore.sh [keystore-path] [alias] [storepass] [keypass]
# Defaults: keys/jinja-release.jks jinja_alias changeit changeit

KEYSTORE_PATH=${1:-keys/jinja-release.jks}
ALIAS=${2:-jinja_alias}
STOREPASS=${3:-changeit}
KEYPASS=${4:-$STOREPASS}

mkdir -p "$(dirname "$KEYSTORE_PATH")"

echo "Generating keystore at: $KEYSTORE_PATH"
keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -storepass "$STOREPASS" \
  -keypass "$KEYPASS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Jinja College, OU=IT, O=Jinja College, L=Jinja, ST=Jinja, C=UG"

echo "Keystore created. DO NOT commit the keystore to source control. Move it to secure storage." 
