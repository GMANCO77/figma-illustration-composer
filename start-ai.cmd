@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
"C:\Program Files\nodejs\node.exe" server\index.js
pause
