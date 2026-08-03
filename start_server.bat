@echo off
chcp 65001 >nul
title 球斗竞技场 · 静态服务器
echo ============================================
echo   球斗竞技场 ORB ARENA - 本地静态服务器
echo ============================================
echo.
echo   [本机访问]  http://localhost:8080
echo   [手机访问]  http://你的电脑IP:8080  （手机和电脑连同一个WiFi）
echo.
echo   关闭本窗口即停止服务器。
echo.
cd /d "%~dp0"
python -m http.server 8080
pause
