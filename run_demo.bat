@echo off
title Noctis Demo Launcher
echo ========================================================
echo               NOCTIS DEMO LAUNCHER
echo ========================================================
echo.
echo Starting Noctis FastAPI Backend Server on port 8000...
start "Noctis Backend" cmd /c "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo Starting Noctis React Frontend Server on port 5173...
start "Noctis Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo Both servers are launching in separate native windows!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo ========================================================
echo.
pause
