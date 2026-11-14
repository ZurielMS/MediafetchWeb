@echo off
title MediaFetch Web - Servidor Local
chcp 65001 > nul
echo ============================================================
echo   🎵 MEDIAFETCH WEB - INICIANDO SERVIDOR LOCAL
echo ============================================================
echo.
echo  [1/2] Verificando dependencias y motor yt-dlp...
start "" "http://localhost:3000"
echo  [2/2] Abriendo tu navegador web...
echo.
npm start
pause
