@echo off
setlocal ENABLEDELAYEDEXPANSION

set NEWNODE=raft5

set LOGDIR=logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

set DATETIME=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATETIME=%DATETIME: =0%
set LOGFILE=%LOGDIR%\test5_new_node_join_%DATETIME%.log

echo [TC5] New node entering the system (late-joining Raft node)
echo [TC5] Using node: %NEWNODE%
echo [TC5] Log file: %LOGFILE%
echo [TC5] New node entering the system (late-joining Raft node)>>"%LOGFILE%"
echo [TC5] Using node: %NEWNODE%>>"%LOGFILE%"
echo [TC5] Log file: %LOGFILE%>>"%LOGFILE%"

echo.>>"%LOGFILE%"
echo [TC5] Stopping %NEWNODE% so it is OUT of the cluster...>>"%LOGFILE%"
echo [TC5] Stopping %NEWNODE% so it is OUT of the cluster...
docker compose stop %NEWNODE%>>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC5] Creating 3 polls while %NEWNODE% is down...>>"%LOGFILE%"
echo [TC5] Creating 3 polls while %NEWNODE% is down...

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC5: before %NEWNODE% join 1\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC5: before %NEWNODE% join 2\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

curl -X POST http://localhost:3005/polls ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"TC5: before %NEWNODE% join 3\",\"options\":[\"yes\",\"no\"]}" ^
  >>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC5] Starting %NEWNODE% back (late join)...>>"%LOGFILE%"
echo [TC5] Starting %NEWNODE% back (late join)...
docker compose start %NEWNODE%>>"%LOGFILE%" 2>&1

echo.>>"%LOGFILE%"
echo [TC5] Waiting 5 seconds for it to sync logs via AppendEntries...>>"%LOGFILE%"
echo [TC5] Waiting 5 seconds for it to sync logs via AppendEntries...
timeout /t 5 /nobreak >NUL

echo.>>"%LOGFILE%"
echo [TC5] Now manually run: docker compose logs %NEWNODE% --tail=100>>"%LOGFILE%"
echo [TC5] Look for: Applying log index=1..3 op=CREATE_POLL>>"%LOGFILE%"
echo [TC5] Test run stored in: %LOGFILE%

echo [TC5] Now manually check %NEWNODE% logs in another window.
pause
endlocal
