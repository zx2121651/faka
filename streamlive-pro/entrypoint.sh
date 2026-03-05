#!/bin/bash
set -e

# Setup display
export DISPLAY=:99
export RESOLUTION="1920x1080x24"

# Remove any existing X11 lock files
rm -rf /tmp/.X99-lock
rm -rf /tmp/.X11-unix/X99

echo "Starting Xvfb..."
Xvfb $DISPLAY -ac -screen 0 $RESOLUTION -nolisten tcp &
sleep 2

echo "Starting Fluxbox window manager..."
fluxbox &
sleep 1

echo "Starting x11vnc..."
x11vnc -display $DISPLAY -forever -shared -nopw -quiet -xkb &
sleep 2

echo "Starting noVNC websockify..."
websockify --web /usr/share/novnc 8080 localhost:5900 &
sleep 2

echo "Installing node dependencies if missing..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/electron" ]; then
    echo "Running npm install..."
    npm install
    # Install playwright browsers again in case dependencies changed
    npx playwright install chromium
fi

echo "----------------------------------------"
echo " noVNC is running at: http://localhost:8080/vnc.html"
echo " Starting StreamLive Pro in development mode..."
echo "----------------------------------------"

# Run the dev command
exec npm run dev:docker
