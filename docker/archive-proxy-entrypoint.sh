#!/usr/bin/env bash
# Boot the virtual display + VNC stack, then the proxy.
set -euo pipefail

export DISPLAY=":99"

# Fresh virtual display.
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp &
until xdpyinfo -display :99 >/dev/null 2>&1; do sleep 0.2; done

# Minimal window manager so the Chromium window is placed + focusable.
fluxbox >/dev/null 2>&1 &

# Screen → VNC on :5900. Password strongly recommended: without VNC_PASSWORD,
# anyone who reaches the noVNC URL can drive this browser.
mkdir -p /root/.vnc
if [ -n "${VNC_PASSWORD:-}" ]; then
  x11vnc -storepasswd "$VNC_PASSWORD" /root/.vnc/passwd >/dev/null 2>&1
  x11vnc -display :99 -forever -shared -rfbauth /root/.vnc/passwd -rfbport 5900 -bg -o /var/log/x11vnc.log
else
  echo "[entrypoint] WARNING: VNC_PASSWORD unset — noVNC is unauthenticated." >&2
  x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -bg -o /var/log/x11vnc.log
fi

# VNC → browser (noVNC static + websocket bridge) on :6080.
websockify --web=/usr/share/novnc 6080 localhost:5900 &

exec bun run server/archive-proxy.ts
