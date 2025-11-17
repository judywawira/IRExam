#!/bin/bash

# Script to kill process running on port 5000

PORT=5000

echo "Checking for process on port $PORT..."

# Find the process ID using lsof
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
    echo "No process found running on port $PORT"
    exit 0
fi

echo "Found process $PID running on port $PORT"
echo "Killing process..."

kill -9 $PID

if [ $? -eq 0 ]; then
    echo "Successfully killed process $PID"
    echo "Port $PORT is now free"
else
    echo "Failed to kill process $PID"
    exit 1
fi
