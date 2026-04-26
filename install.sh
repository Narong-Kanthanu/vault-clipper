#!/bin/bash
#
# Vault Clipper — Native Messaging Host Installer
# Registers the native host with Brave (and optionally Chrome) on macOS.
#
# IMPORTANT: The native host script is copied to ~/.config/vault-clipper/
# because macOS sandboxed browsers (Brave/Chrome) cannot execute scripts
# located in ~/Documents/ or other protected folders.
#
# Usage:
#   ./install.sh                          # Interactive (prompts for extension ID)
#   ./install.sh --extension-id ABC123    # Non-interactive
#   ./install.sh --chrome                 # Also register for Chrome
#   ./install.sh --uninstall              # Remove native host registration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.vaultclipper.host"
HOST_SOURCE="$SCRIPT_DIR/native-host/vault_clipper_host.py"
INSTALL_DIR="$HOME/.config/vault-clipper"
HOST_SCRIPT="$INSTALL_DIR/vault_clipper_host.py"

# Brave and Chrome native messaging host directories
BRAVE_NM_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
CHROME_NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
CHROMIUM_NM_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"

EXTENSION_ID=""
INSTALL_CHROME=false
UNINSTALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --extension-id)
      EXTENSION_ID="$2"
      shift 2
      ;;
    --chrome)
      INSTALL_CHROME=true
      shift
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./install.sh [--extension-id ID] [--chrome] [--uninstall]"
      exit 1
      ;;
  esac
done

# --- Uninstall ---
if $UNINSTALL; then
  echo "Removing native messaging host registration..."
  rm -f "$BRAVE_NM_DIR/$HOST_NAME.json" 2>/dev/null && echo "  Removed from Brave" || true
  rm -f "$CHROME_NM_DIR/$HOST_NAME.json" 2>/dev/null && echo "  Removed from Chrome" || true
  rm -f "$CHROMIUM_NM_DIR/$HOST_NAME.json" 2>/dev/null && echo "  Removed from Chromium" || true
  rm -rf "$INSTALL_DIR" 2>/dev/null && echo "  Removed $INSTALL_DIR" || true
  echo "Done."
  exit 0
fi

# --- Install ---

# Detect python3 path
PYTHON3_PATH="$(command -v python3 2>/dev/null || true)"
if [[ -z "$PYTHON3_PATH" ]]; then
  echo "Error: python3 is required but not found in PATH."
  exit 1
fi

echo "=== Vault Clipper Native Host Installer ==="
echo ""

# Get extension ID
if [[ -z "$EXTENSION_ID" ]]; then
  echo "To find your extension ID:"
  echo "  1. Open brave://extensions/ (or chrome://extensions/)"
  echo "  2. Enable 'Developer mode'"
  echo "  3. Load the extension (if not already loaded)"
  echo "  4. Copy the ID shown under the extension name"
  echo ""
  read -rp "Enter extension ID: " EXTENSION_ID
fi

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Error: Extension ID is required."
  exit 1
fi

# Copy host script to ~/.config/vault-clipper/
# (macOS sandboxed browsers cannot execute from ~/Documents/)
mkdir -p "$INSTALL_DIR"
cp "$HOST_SOURCE" "$HOST_SCRIPT"

# Set absolute python3 shebang for reliable execution
sed -i '' "1s|^#!.*|#!${PYTHON3_PATH}|" "$HOST_SCRIPT"
chmod +x "$HOST_SCRIPT"

echo ""
echo "Extension ID: $EXTENSION_ID"
echo "Python3:      $PYTHON3_PATH"
echo "Host script:  $HOST_SCRIPT"
echo ""

# Generate the native messaging host manifest
generate_manifest() {
  cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "Vault Clipper native messaging host for writing files to Obsidian vaults",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
}

# Install for Brave
mkdir -p "$BRAVE_NM_DIR"
generate_manifest > "$BRAVE_NM_DIR/$HOST_NAME.json"
echo "Installed for Brave"

# Install for Chromium (Brave also checks this path)
mkdir -p "$CHROMIUM_NM_DIR"
generate_manifest > "$CHROMIUM_NM_DIR/$HOST_NAME.json"
echo "Installed for Chromium"

# Optionally install for Chrome
if $INSTALL_CHROME; then
  mkdir -p "$CHROME_NM_DIR"
  generate_manifest > "$CHROME_NM_DIR/$HOST_NAME.json"
  echo "Installed for Chrome"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Quit Brave completely (Cmd+Q) and reopen"
echo "  2. Navigate to any web page"
echo "  3. Click the Vault Clipper icon to clip"
echo ""
