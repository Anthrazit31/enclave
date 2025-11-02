#!/bin/bash

# Phoenix Industries - Package for Local Download
echo "📦 Packaging Phoenix Industries for local deployment..."

# Create package directory
PACKAGE_DIR="phoenix-industries-local"
rm -rf $PACKAGE_DIR
mkdir $PACKAGE_DIR

# Copy all necessary files and folders
echo "📁 Copying project files..."
cp -r assets $PACKAGE_DIR/
cp -r server $PACKAGE_DIR/
cp -r prisma $PACKAGE_DIR/
cp -r community $PACKAGE_DIR/
cp -r communityleaders $PACKAGE_DIR/
cp -r drones $PACKAGE_DIR/
cp *.html $PACKAGE_DIR/
cp *.json $PACKAGE_DIR/
cp *.md $PACKAGE_DIR/
cp .env.example $PACKAGE_DIR/

# Create README with setup instructions
cat > $PACKAGE_DIR/README.md << 'EOF'
# Phoenix Industries Terminal System

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
```

### 3. Start Servers

**Backend (Terminal 1):**
```bash
npm run dev
```

**Frontend (Terminal 2):**
```bash
# Windows
python -m http.server 8000

# macOS/Linux
python3 -m http.server 8000
```

### 4. Access
Open browser: http://localhost:8000

## Login Credentials
- **admin / admin123** (System Administrator)
- **military / military123** (Military Personnel)
- **researcher / researcher123** (Research Personnel)
- **hybrid / hybrid123** (Military + Research)

## Legacy Access Codes
- enclave, arastirma, fppwjfucxymwi22mwfzzrg0bvmt6yu8svu0mb1fc, 1561, 1603

## Requirements
- Node.js 18+
- Python 3+
- Modern web browser

Enjoy your Phoenix Industries terminal system! 🚀
EOF

# Create package.json if it doesn't exist
if [ ! -f $PACKAGE_DIR/package.json ]; then
    cp package.json $PACKAGE_DIR/
fi

# Create start script
cat > $PACKAGE_DIR/start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Phoenix Industries Terminal System"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup database
echo "🗄️ Setting up database..."
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js

# Start servers
echo "🌐 Starting servers..."
echo "Backend server: http://localhost:3000"
echo "Frontend server: http://localhost:8000"
echo ""
echo "Open http://localhost:8000 in your browser"
echo "Press Ctrl+C to stop servers"

# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend in background
python3 -m http.server 8000 &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF

chmod +x $PACKAGE_DIR/start.sh

# Create Windows start script
cat > $PACKAGE_DIR/start.bat << 'EOF'
@echo off
echo 🚀 Starting Phoenix Industries Terminal System

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Setup database
echo 🗄️ Setting up database...
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js

REM Start servers
echo 🌐 Starting servers...
echo Backend server: http://localhost:3000
echo Frontend server: http://localhost:8000
echo.
echo Open http://localhost:8000 in your browser
echo Press Ctrl+C to stop servers
echo.

REM Start backend
start /B npm run dev

REM Wait for backend
timeout /t 5 /nobreak >nul

REM Start frontend
start /B python -m http.server 8000

REM Keep script running
pause
EOF

echo "✅ Package created: $PACKAGE_DIR/"
echo ""
echo "📥 Download the '$PACKAGE_DIR' folder to your computer"
echo "📖 Follow the instructions in README.md"
echo "🚀 Or run the start script (start.sh for Unix/Mac, start.bat for Windows)"
echo ""
echo "Package contains:"
echo "  ✅ Complete backend server"
echo "  ✅ Frontend files and assets"
echo "  ✅ Database with default users"
echo "  ✅ Setup scripts and instructions"
echo "  ✅ All access codes and credentials"