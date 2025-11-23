@echo off
setlocal ENABLEDELAYEDEXPANSION

set LOGDIR=logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

set DATETIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set LOGFILE=%LOGDIR%\test4_concurrent_%DATETIME%.log

echo [TC4] Multiple back-to-back client polls (log ordering test)
echo [TC4] Log file: %LOGFILE%
echo [TC4] Multiple back-to-back client polls (log ordering test)>>"%LOGFILE%"
echo [TC4] Log file: %LOGFILE%>>"%LOGFILE%"

for /L %%i in (1,1,5) do (
  echo.>>"%LOGFILE%"
  echo [TC4] Creating poll %%i ...>>"%LOGFILE%"
  echo [TC4] Creating poll %%i ...
  curl -X POST http://localhost:3005/polls ^
    -H "Content-Type: application/json" ^
    -d "{\"question\":\"TC4: poll %%i?\",\"options\":[\"yes\",\"no\"]}" ^
    >>"%LOGFILE%" 2>&1
)

echo.>>"%LOGFILE%"
echo [TC4] Now check logs on leader and follower for sequential log indexes.>>"%LOGFILE%"
echo [TC4] Example:>>"%LOGFILE%"
echo   docker compose logs raft3 --tail=80>>"%LOGFILE%"
echo   docker compose logs raft4 --tail=80>>"%LOGFILE%"

echo [TC4] Test run stored in: %LOGFILE%
echo [TC4] Now manually check raft node logs in another window.
pause
endlocal
