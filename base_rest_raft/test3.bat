@echo off
setlocal ENABLEDELAYEDEXPANSION

set FOLLOWER=raft4

set LOGDIR=logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

set DATETIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set LOGFILE=%LOGDIR%\test3_follower_recovery_%DATETIME%.log

echo [TC3] Follower crash and recovery (log catch-up)
echo [TC3] Using follower service: %FOLLOWER%
echo [TC3] Log file: %LOGFILE%
echo [TC3] Follower crash and recovery (log catch-up)>>"%LOGFILE%"
echo [TC3] Using follower service: %FOLLOWER%>>"%LOGFILE%"
echo [TC3] Log file: %LOGFILE%>>"%LOGFILE%"

echo.>>"%LOGFILE%"
echo [TC3] Stopping follower: %FOLLOWER% ...>>"%LOGFILE%"
echo [TC3] Stopping follower: %FOLLOWER% ...
docker compose stop %FOLLOWER%>>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC3] Creating 2 polls while follower is DOWN...>>"%LOGFILE%"
echo [TC3] Creating 2 polls while follower is DOWN...

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC3: while %FOLLOWER% down 1\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC3: while %FOLLOWER% down 2\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC3] Starting follower again: %FOLLOWER% ...>>"%LOGFILE%"
echo [TC3] Starting follower again: %FOLLOWER% ...
docker compose start %FOLLOWER%>>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC3] Waiting 5 seconds for it to receive AppendEntries...>>"%LOGFILE%"
echo [TC3] Waiting 5 seconds for it to receive AppendEntries...
timeout /t 5 /nobreak >NUL

echo.>>"%LOGFILE%"
echo [TC3] Now manually run: docker compose logs %FOLLOWER% --tail=80>>"%LOGFILE%"
echo [TC3] Look for: Applying log index=... op=CREATE_POLL>>"%LOGFILE%"
echo [TC3] Test run stored in: %LOGFILE%
echo [TC3] Now manually run in another window:
echo   docker compose logs %FOLLOWER% --tail=80
pause
endlocal
