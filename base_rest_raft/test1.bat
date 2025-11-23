@echo off
setlocal ENABLEDELAYEDEXPANSION

set LOGDIR=logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

set DATETIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set LOGFILE=%LOGDIR%\test1_normal_%DATETIME%.log

echo [TC1] Normal Raft operation: leader election + create poll
echo [TC1] Log file: %LOGFILE%
echo [TC1] Normal Raft operation: leader election + create poll>>"%LOGFILE%"
echo [TC1] Log file: %LOGFILE%>>"%LOGFILE%"

echo.>>"%LOGFILE%"
echo [TC1] Creating poll via load balancer on :3005...>>"%LOGFILE%"
echo [TC1] Creating poll via load balancer on :3005...
echo curl -X POST http://localhost:3005/polls -H "Content-Type: application/json" -d "{\"question\":\"TC1: normal?\",\"options\":[\"yes\",\"no\"]}">>"%LOGFILE%"

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC1: normal?\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo. 
echo [TC1] Done. Check logs for leader election and log application.>>"%LOGFILE%"
echo [TC1] Now you can run:>>"%LOGFILE%"
echo   docker compose logs api1 --tail=40>>"%LOGFILE%"
echo   docker compose logs raft3 --tail=80>>"%LOGFILE%"

echo [TC1] Done. Check %LOGFILE% for full output.
pause
endlocal
