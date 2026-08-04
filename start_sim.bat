@echo off
chcp 65001 >nul
title 球斗竞技场 · 胜率模拟器
cd /d "%~dp0"

rem 检查 8080 端口是否已被占用（start_server.bat / start_editor.bat 已在跑就直接打开）
netstat -an | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:8080/sim.html"
  exit /b
)

rem 未占用则起本地服务并打开模拟器
start "" cmd /c "python -m http.server 8080 >nul 2>&1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/sim.html"
