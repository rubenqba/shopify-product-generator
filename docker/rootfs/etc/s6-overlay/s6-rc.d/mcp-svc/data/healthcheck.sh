#!/usr/bin/with-contenv bash

if [[ $(curl -sL "http://localhost:${PORT:-5080}/api/v1/health" | jq -r '.status' 2>/dev/null) = "ok" ]]; then
    exit 0
else
    exit 1
fi
