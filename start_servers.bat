@echo off
echo Phoenix Industries - Sunucu Başlatma Aracı
echo ========================================
echo.
echo Backend ve frontend sunucuları başlatılıyor...
echo.

:: Backend sunucusunu başlat (yeni bir pencerede)
start cmd /k "cd %~dp0 && echo Backend sunucusu başlatılıyor... && npm run dev"

:: 2 saniye bekle
timeout /t 2 /nobreak > nul

:: Frontend sunucusunu başlat (yeni bir pencerede)
start cmd /k "cd %~dp0 && echo Frontend sunucusu başlatılıyor... && python -m http.server 8000"

echo.
echo Sunucular başlatıldı!
echo - Backend: http://localhost:3000
echo - Frontend: http://localhost:8000
echo.
echo Çıkmak için herhangi bir tuşa basın...
pause > nul