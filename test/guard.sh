#!/bin/bash
# 运行命令并在可用内存过低时杀掉 chrome
( while sleep 0.5; do a=$(awk '/MemAvailable/{print $2}' /proc/meminfo); if [ "$a" -lt 450000 ]; then pkill -9 -f chrome-headless; echo "OOM-GUARD killed chrome (avail ${a}k)"; fi; done ) &
GUARD_PID=$!
"$@"
kill $GUARD_PID 2>/dev/null
pkill -9 -f chrome-headless 2>/dev/null
exit 0
