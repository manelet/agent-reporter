#!/usr/bin/env bash
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.30.2}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS_NAME" in
  darwin) PB_OS="darwin" ;;
  linux)  PB_OS="linux"  ;;
  *) echo "Unsupported OS: $OS_NAME" >&2; exit 1 ;;
esac

case "$ARCH" in
  arm64|aarch64) PB_ARCH="arm64" ;;
  x86_64|amd64)  PB_ARCH="amd64" ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

ASSET="pocketbase_${PB_VERSION}_${PB_OS}_${PB_ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${ASSET}"
TMP_DIR="$(mktemp -d)"

echo "Downloading $URL ..."
curl -fL --progress-bar -o "$TMP_DIR/$ASSET" "$URL"

echo "Extracting to $ROOT_DIR ..."
unzip -q -o "$TMP_DIR/$ASSET" -d "$TMP_DIR"
mv "$TMP_DIR/pocketbase" "$ROOT_DIR/pocketbase"
chmod +x "$ROOT_DIR/pocketbase"

rm -rf "$TMP_DIR"
echo "Done. PocketBase v${PB_VERSION} installed at $ROOT_DIR/pocketbase"
