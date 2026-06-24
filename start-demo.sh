#!/bin/bash
# Start the QA Tools showcase with auto-loading demo data.
# Runs a local server on port 8765 so iframe injection works.

cd "$(dirname "$0")"

# Kill any existing server on the port
lsof -ti:8765 | xargs kill -9 2>/dev/null

# Start Python HTTP server in the background
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!

echo "Server started (PID $SERVER_PID) at http://localhost:8765"
echo "Opening browser..."

sleep 0.4
open "http://localhost:8765/index.html"

echo "Press Ctrl+C to stop the server."
wait $SERVER_PID
