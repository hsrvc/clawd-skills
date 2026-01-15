#!/bin/bash
# save-and-send.sh - Save Gemini search result to markdown and send to Saved Messages
#
# Usage: save-and-send.sh <title> <content>

set -e

TITLE="$1"
CONTENT="$2"

if [ -z "$TITLE" ] || [ -z "$CONTENT" ]; then
    echo "Usage: save-and-send.sh <title> <content>"
    exit 1
fi

# Create output directory if not exists
OUTPUT_DIR="/Users/dydo/clawd/gemini-searches"
mkdir -p "$OUTPUT_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
# Sanitize title for filename (remove special chars, limit length)
SAFE_TITLE=$(echo "$TITLE" | sed 's/[^a-zA-Z0-9\u4e00-\u9fa5]/_/g' | cut -c 1-50)
FILENAME="${OUTPUT_DIR}/${TIMESTAMP}_${SAFE_TITLE}.md"

# Write content to file
cat > "$FILENAME" << EOF
# ${TITLE}

**生成時間：** $(date +"%Y-%m-%d %H:%M:%S")  
**來源：** Gemini Search

---

${CONTENT}

---

*Gemini Search + DyDo 整理*
EOF

echo "File saved to: $FILENAME"

# Send to Telegram Saved Messages
echo "Sending to Saved Messages..."
telegram send-file "me" "$FILENAME" "📋 ${TITLE}" 2>&1 | grep -v "TIMEOUT" || true

echo ""
echo "✅ Done! File saved and sent to Saved Messages."
echo "📁 Location: $FILENAME"
