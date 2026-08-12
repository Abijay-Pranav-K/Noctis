@echo off
title Noctis Workspace Launcher
echo ========================================================
echo             NOCTIS WORKSPACE LAUNCHER
echo ========================================================
echo.
echo Starting Noctis backend and company activity connector on port 8000...
start "Noctis Backend" cmd /c "cd /d %~dp0 && backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo Starting the unified Noctis workspace on port 5173...
start "Noctis Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo The local Noctis workspace is launching in separate native windows!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo ========================================================
echo.
pause
