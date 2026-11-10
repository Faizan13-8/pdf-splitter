@echo off
title PDF Splitter - Cloud APK Builder
echo ========================================================
echo        PDF Splitter Pro - Cloud APK Builder
echo ========================================================
echo.
echo Is script ke through GitHub free cloud servers par aapki
echo exact .apk (app-debug.apk) file compile kar ke de dega!
echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/Faizan13-8/pdf-splitter.git): "

if "%REPO_URL%"=="" (
    echo Error: Repository URL cannot be empty!
    pause
    exit /b
)

echo.
echo [1/3] Adding remote origin...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [2/3] Renaming branch to main...
git branch -M main

echo [3/3] Uploading project to GitHub to trigger APK build...
git push -u origin main --force

echo.
echo ========================================================
echo   SUCCESS! GitHub Actions me APK build start ho gayi hai!
echo ========================================================
echo 1. Apni repository open karein: %REPO_URL%
echo 2. "Actions" tab par click karein.
echo 3. 2 minute me build complete ho jayegi.
echo 4. "Artifacts" section se "PDF-Splitter-Pro-Debug-APK" (.apk) download kar lein!
echo.
pause
