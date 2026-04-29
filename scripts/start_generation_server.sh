#!/bin/bash
cd /home/claudeuser/guidian
exec python3 -m uvicorn scripts.generation_server:app --host 127.0.0.1 --port 8765 --workers 1
