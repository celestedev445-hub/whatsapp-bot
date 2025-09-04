@echo off
echo 🚀 Démarrage du Bot WhatsApp Entreprise
echo.

echo 🧹 Nettoyage des processus existants...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
    echo Arrêt du processus %%a sur le port 3002...
    taskkill /f /pid %%a >nul 2>&1
)

echo ⏳ Attente de 2 secondes...
timeout /t 2 /nobreak > nul

echo 📡 Démarrage du serveur API (port 3002)...
start "API Server" cmd /k "node server-api-only.js"

echo ⏳ Attente de 3 secondes pour que l'API démarre...
timeout /t 3 /nobreak > nul

echo 🌐 Démarrage du frontend (port 3001)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Les deux serveurs sont en cours de démarrage :
echo    - API Backend : http://localhost:3002
echo    - Frontend    : http://localhost:3001
echo.
echo Appuyez sur une touche pour fermer cette fenêtre...
pause > nul
