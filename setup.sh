#!/bin/bash
# A2UI Studio — One-click Setup & Launch
# Works on any macOS/Linux machine with Node.js

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "⚡ A2UI Studio Setup"
echo "===================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required."; exit 1; }

# Step 1: Configure API Key
if [ ! -f "$HOME/.a2ui.env" ]; then
    echo ""
    echo "🔑 Enter your DeepSeek API Key (get from https://platform.deepseek.com):"
    read -s API_KEY
    echo "DEEPSEEK_API_KEY=$API_KEY" > "$HOME/.a2ui.env"
    echo "✅ Key saved to ~/.a2ui.env"
fi
source "$HOME/.a2ui.env"

if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ DEEPSEEK_API_KEY not set. Please add it to ~/.a2ui.env"
    exit 1
fi

# Step 2: Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd "$DIR"
if [ ! -d "node_modules" ]; then
    npm install 2>/dev/null || {
        echo "No package.json found, using system node modules..."
    }
fi

# Step 3: Install frontend dependencies
echo "📦 Installing frontend dependencies..."
FRONTEND_DIR="$HOME/projects/a2ui-official"
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    [ ! -d "node_modules" ] && npm install
fi

# Step 4: Start backend
echo ""
echo "🚀 Starting backend on port 3456..."
cd "$DIR"
DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY node server/server.js &
BACKEND_PID=$!
sleep 2

# Step 5: Start frontend
echo "🚀 Starting frontend on port 3333..."
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    npx vite --port 3333 &
    FRONTEND_PID=$!
fi

sleep 2

echo ""
echo "✅ A2UI Studio is running!"
echo ""
echo "   🌐 Web:    http://localhost:3333/app.html"
echo "   🔧 API:    http://localhost:3456/a2ui/generate"
echo ""
echo "   Press Ctrl+C to stop all services"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '👋 Stopped'" EXIT
wait
