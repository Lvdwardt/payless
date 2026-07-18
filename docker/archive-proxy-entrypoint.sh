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

# Screen → VNC on loopback :5900 only. No VNC password: access is gated one layer
# up by the proxy, which serves noVNC same-origin and only opens the websocket for
# a live, app-initiated solve token. x11vnc + websockify never bind a public port.
x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 -bg -o /var/log/x11vnc.log

# noVNC static + VNC→websocket bridge, bound to loopback. The proxy reverse-proxies
# /vnc/* to it; it is NOT exposed through Coolify/Traefik.
websockify --web=/usr/share/novnc 127.0.0.1:6080 localhost:5900 &

exec bun run server/archive-proxy.ts
