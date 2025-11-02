# Phoenix Industries - Local Setup Instructions

## Prerequisites
- Node.js 18+ (download from https://nodejs.org)
- Python 3+ (for simple HTTP server)
- Git (optional, for cloning)

## Step 1: Get the Files
Copy all files from the enclave directory to your local machine.

## Step 2: Install Dependencies
```bash
cd phoenix-industries
npm install
```

## Step 3: Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file (optional - default values work for local development)
```

## Step 4: Initialize Database
```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# Seed database with default users
node prisma/seed.js
```

## Step 5: Start the Servers

### Backend Server (Port 3000)
```bash
npm run dev
```

### Frontend Server (Port 8000) - Open new terminal window
```bash
# For Windows
python -m http.server 8000

# For macOS/Linux
python3 -m http.server 8000
```

## Step 6: Access Your Site
Open browser and go to: http://localhost:8000

## Default Login Credentials
- Admin: admin/admin123
- Military: military/military123
- Researcher: researcher/researcher123
- Hybrid: hybrid/hybrid123

## Legacy Access Codes (still work)
- enclave
- arastirma
- fppwjfucxymwi22mwfzzrg0bvmt6yu8svu0mb1fc
- 1561
- 1603

## Troubleshooting
- If backend fails: Check if Node.js is installed and ports 3000/8000 are free
- If frontend fails: Try different port (8080, 9000) for the HTTP server
- Database issues: Delete `dev.db` and re-run `npm run db:init`

## File Structure
```
phoenix-industries/
├── server/           # Backend Node.js server
├── prisma/           # Database schema and migrations
├── assets/           # Frontend assets (CSS, JS, sounds)
├── *.html            # Frontend HTML files
├── package.json      # Node.js dependencies
├── .env              # Environment variables
└── dev.db            # SQLite database (created automatically)
```