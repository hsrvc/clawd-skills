#!/bin/bash
# Sync skills from clawd to this repo and push

SOURCE="/Users/dydo/clawd/skills"
DEST="/Users/dydo/agent/clawd-skills"

# Sync each skill folder (excluding node_modules)
for skill in agent-browser ask-grok gemini-search idea; do
    rsync -av --exclude='node_modules' --exclude='.DS_Store' "$SOURCE/$skill/" "$DEST/$skill/"
done

# Commit and push if there are changes
cd "$DEST"
if [[ -n $(git status --porcelain) ]]; then
    git add .
    git commit -m "Sync skills from clawd"
    git push
    echo "✅ Changes synced and pushed"
else
    echo "✅ No changes to sync"
fi
