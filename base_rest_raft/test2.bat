@echo off
setlocal ENABLEDELAYEDEXPANSION

set LEADER=raft3

set LOGDIR=logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

set DATETIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set LOGFILE=%LOGDIR%\test2_leader_crash_%DATETIME%.log

echo [TC2] Leader crash and re-election test
echo [TC2] Using assumed leader service: %LEADER%
echo [TC2] Log file: %LOGFILE%
echo [TC2] Leader crash and re-election test>>"%LOGFILE%"
echo [TC2] Using assumed leader service: %LEADER%>>"%LOGFILE%"
echo [TC2] Log file: %LOGFILE%>>"%LOGFILE%"

echo.>>"%LOGFILE%"
echo [TC2] Stopping leader container: %LEADER% ...>>"%LOGFILE%"
echo [TC2] Stopping leader container: %LEADER% ...
docker compose stop %LEADER%>>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC2] Immediately trying to create a poll (may fail or be rejected)...>>"%LOGFILE%"
echo [TC2] Immediately trying to create a poll (may fail or be rejected)...
echo curl -X POST http://localhost:3005/polls ...>>"%LOGFILE%"

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC2: after leader crash?\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC2] Waiting 5 seconds for re-election...>>"%LOGFILE%"
echo [TC2] Waiting 5 seconds for re-election...
timeout /t 5 /nobreak >NUL

echo.>>"%LOGFILE%"
echo [TC2] Trying again after re-election...>>"%LOGFILE%"
echo [TC2] Trying again after re-election...
curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC2: after re-election?\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC2] Now check raft node logs for a new leader being elected.>>"%LOGFILE%"
echo [TC2] Now check raft node logs for a new leader being elected.
echo [TC2] Full run stored in: %LOGFILE%
pause
endlocal
