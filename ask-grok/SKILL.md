---
name: ask-grok
description: Ask a question to Grok (grok.com) via an attached browser session.
metadata: { "clawdbot": { "emoji": "🐾", "requires": { "bins": ["node"], "env": [] } } }
---

# Ask Grok

Uses Playwright to connect to an existing Chrome instance (via CDP) and ask Grok a question.
Requires a running Chrome instance with remote debugging enabled, logged into grok.com.

## Usage

```bash
node /Users/dydo/clawd/skills/ask-grok/scripts/ask.mjs "Your question here"
```

## Setup

### One-time Setup

1. Install dependencies:
   ```bash
   cd /Users/dydo/clawd/skills/ask-grok
   npm install
   ```

2. Ensure Chrome is running with remote debugging:
   ```bash
   # This should already be running at PID 88175
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
3. Waits for input field to be ready
4. Types the question and submits
5. Waits for response to stabilize (streaming complete)
6. Extracts the last Grok message using `.message-bubble` selector
7. Outputs the response and exits (browser stays open)

## Utilities

- `inspect.mjs`: DOM structure inspector for debugging selectors

## Technical Details

- **Message selector**: `.message-bubble`
- **User message filter**: Messages with `bg-surface-l1` class are filtered out
- **Stability detection**: Response is considered complete after 1.5s of no changes
- **Timeout**: 60 seconds max wait for response generation
