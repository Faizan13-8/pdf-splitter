@echo off
title PDF Splitter Pro - Offline Server
echo ========================================================
echo         PDF Splitter Pro (100%% Offline)
echo ========================================================
echo Starting local offline server...
start http://localhost:3000
npm run dev
pause
