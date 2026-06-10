#!/bin/bash
# Install/uninstall the claude-bridge launchd agent (macOS).
# Usage: ./install-launchd.sh [install|uninstall]
set -euo pipefail

ACTION="${1:-install}"
LABEL="com.pegboard.claude-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LOG_DIR="$HOME/.pegboard/logs"

if [ "$ACTION" = "uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "uninstalled: $LABEL"
  exit 0
fi

if [ -z "$NODE_BIN" ]; then
  echo "error: node not found in PATH" >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/claude-bridge/index.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/claude-bridge.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/claude-bridge.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
# RunAtLoad is not always honored on bootstrap in recent macOS; force-start.
launchctl kickstart -k "gui/$(id -u)/$LABEL"
echo "installed and started: $PLIST"
echo "logs: $LOG_DIR/claude-bridge.log"
