---
name: ask-grok
description: Ask a question to Grok (grok.com) via an attached browser session.
metadata: { "clawdbot": { "emoji": "🐾", "requires": { "bins": ["node"], "env": [] } } }
---

# Ask Grok

Uses Playwright to connect to an existing Chrome instance (via CDP) and ask Grok a question.
Requires a running Chrome instance with remote debugging enabled, logged into grok.com.

## ⚠️ CRITICAL: Execution Requirements

**This script takes 1-5 MINUTES to complete** because Grok has a "thinking" phase that can take 60-180 seconds.

### REQUIRED: Use background mode

You MUST use `background: true` to avoid SIGKILL timeout:

```
bash(command: "node /Users/dydo/clawd/skills/ask-grok/scripts/ask.mjs \"YOUR_QUESTION\"", background: true)
```

Then poll for completion:
```
process(action: "poll", sessionId: "THE_SESSION_ID")
```

### ❌ DO NOT DO THIS:
```
bash(command: "node .../ask.mjs \"question\"", timeout: 120)  // WILL GET SIGKILL!
```

### ✅ CORRECT PATTERN:

1. **Start in background:**
   ```
   bash(command: "node /Users/dydo/clawd/skills/ask-grok/scripts/ask.mjs \"What is the meaning of life?\"", background: true)
   ```
   Returns: `{ "sessionId": "abc123", "status": "running" }`

2. **Poll every 15-30 seconds:**
   ```
   process(action: "poll", sessionId: "abc123")
   ```
   - While running: `{ "status": "running", "stdout": "partial output..." }`
   - When done: `{ "status": "exited", "exitCode": 0, "stdout": "full response" }`

3. **Return the stdout content** to the user when status is "exited" with exitCode 0.

## Setup

### One-time Setup

1. Install dependencies:
   ```bash
   cd /Users/dydo/clawd/skills/ask-grok && npm install
   ```

2. Chrome must be running with remote debugging:
   ```bash
   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome \
     --remote-debugging-port=18800 \
     --user-data-dir=/Users/dydo/.clawdbot/browser/clawd/user-data
   ```

3. First time: Open https://grok.com in the browser and login manually

### Environment Variables

- `CDP_URL`: CDP endpoint (default: `http://localhost:18800`)

## How It Works

1. Connects to existing Chrome instance via CDP (port 18800)
2. Finds or creates a Grok tab
3. Types the question and submits
4. Prints progress dots every 10 seconds while waiting
5. Streams response incrementally to stdout as it arrives
6. Detects completion when response stabilizes (no changes for 1.5s)
7. Exits with code 0 on success (browser stays open)

## Technical Details

- **Thinking phase**: Grok may "think" for 60-180+ seconds before responding
- **Internal timeout**: 5 minutes max total time (300 seconds)
- **Streaming**: Output is written incrementally to stdout
- **Progress**: Dots printed to stderr every 10 seconds
