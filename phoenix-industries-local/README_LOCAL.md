# Phoenix Industries Terminal System 🚀

A fully functional cyberpunk-themed terminal system with real backend authentication and live terminal processing.

## ✨ Features
- **Real Authentication**: JWT-based user accounts with multiple access levels
- **Live Terminal Sessions**: Real-time command processing with database persistence
- **Security Monitoring**: Comprehensive logging and admin dashboard
- **Legacy Compatibility**: Original access codes still work!
- **SQLite Database**: Zero-installation database that just works
- **Multiple Terminal Types**: Military, Researcher, Filesystem, Emergency

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (download from https://nodejs.org)
- **Python 3+** (for simple HTTP server)
- **Modern web browser**

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

**Backend Server (Terminal 1):**
```bash
npm run dev
```

**Frontend Server (Terminal 2):**
```bash
# Windows
python -m http.server 8000

# macOS/Linux
python3 -m http.server 8000
```

### 4. Access Your System
🌐 **Open your browser and go to:** `http://localhost:8000`

## 🔐 Login Credentials

### New Backend Users
- **Admin**: `admin` / `admin123` (Full system access)
- **Military**: `military` / `military123` (Military terminal)
- **Researcher**: `researcher` / `researcher123` (Research terminal)
- **Hybrid**: `hybrid` / `hybrid123` (Military + Research)

### Legacy Access Codes (Still Work!)
- `enclave` - Military personnel
- `arastirma` - Researcher
- `fppwjfucxymwi22mwfzzrg0bvmt6yu8svu0mb1fc` - Military researcher
- `1561` - Researcher (Michael Schofield)
- `1603` - Researcher (John Smith)

## 🎮 What You Can Do

1. **🔐 Authenticate** with real user accounts or legacy codes
2. **💻 Access Different Terminals** based on your access level
3. **⚡ Execute Live Commands** processed by the backend
4. **📊 Monitor Security** (admin only)
5. **👥 Manage Users** (admin only)
6. **💾 Persistent Sessions** - your terminal sessions save to database

## 🗂️ File Structure
```
phoenix-industries-local/
├── server/           # Backend Node.js server
├── prisma/           # Database schema and migrations
├── assets/           # Frontend assets (CSS, JS, sounds)
├── community/        # Community profile pages
├── communityleaders/ # Community leader pages
├── drones/           # Drone information pages
├── *.html            # All frontend HTML files
├── package.json      # Node.js dependencies
└── .env.example      # Environment template
```

## 🔧 Advanced Usage

### Admin Dashboard
Access admin features with `admin/admin123`:
- User management
- Security monitoring
- Session tracking
- System statistics

### API Endpoints
- `GET /api/security/stats` - Security statistics
- `GET /api/users` - User management (admin only)
- `POST /api/terminal/sessions` - Create terminal sessions

### Database
- SQLite database (`dev.db`) created automatically
- All data persists between sessions
- View with `npx prisma studio`

## 🐛 Troubleshooting

**Port conflicts?**
- Backend: Change PORT in `.env` file
- Frontend: Use different port (`8080`, `9000`)

**Database issues?**
```bash
rm dev.db
npx prisma migrate dev --name init
node prisma/seed.js
```

**Backend won't start?**
```bash
npm install
npx prisma generate
```

**Frontend not loading?**
- Check if ports 3000 and 8000 are free
- Try different ports if needed

## 🛡️ Security Features
- JWT token authentication with refresh tokens
- Rate limiting on sensitive endpoints
- IP monitoring and attack detection
- Comprehensive security logging
- Session management and tracking

## 📱 Mobile Support
- Progressive Web App (PWA) ready
- Responsive design
- Works on tablets and mobile devices

## 🎨 Customization
- Edit CSS in `assets/css/` for styling
- Modify terminal commands in `server/services/terminalService.js`
- Add new users via admin dashboard or database
- Customize access levels and permissions

## 📞 Support
- Check server logs for errors
- Test with `test-backend.html` for API connectivity
- All original features preserved with new backend power

Enjoy your fully functional Phoenix Industries terminal system! 🎉

---

*Built with Node.js, Express, Prisma, SQLite, Socket.io, and cyberpunk aesthetic*