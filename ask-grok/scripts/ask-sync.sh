#!/bin/bash
# Synchronous wrapper for ask-grok that handles its own timeout
# This script runs the node script directly without any external timeout
# It will run for up to 5 minutes (the internal script timeout)

set -e

if [ -z "$1" ]; then
    echo "Usage: ask-sync.sh \"Your question here\"" >&2
    exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run node directly - the script has its own 5 minute timeout
# No timeout wrapper needed here
exec node "$SCRIPT_DIR/ask.mjs" "$1"
