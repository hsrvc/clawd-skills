---
name: gemini-search
description: Use Google's Gemini API for web searches, current events, and real-time information beyond your training data.
homepage: https://github.com/google-gemini/gemini-cli
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["gemini"]}}}
---

# Gemini Search

Use Google's Gemini API for web searches, current events, and information that requires up-to-date knowledge beyond your training data. This saves tokens and reduces message clutter by delegating appropriate queries to Gemini.

## When to Use

### Automatic Triggers (You Decide)
- Questions about current events, news, or recent developments
- Web searches or "what's happening now" queries
- Information that requires real-time data (weather, stock prices, etc.)
- Questions outside your knowledge cutoff

### Explicit Triggers (User Request)
- User says "ask gemini: ..."
- User says "gemini search for ..."
- User says "search: ..." (when context suggests web search)

### When NOT to Use
- Code analysis/debugging (you're better at this)
- Tasks requiring file system access
- Personal memory/context questions (use your memory files)
- Creative writing or reasoning tasks (your core strength)

## Usage

### Basic Query
```bash
gemini -p "your question here"
```

### Follow-up Questions (Session Resume)
```bash
# Resume most recent session
gemini --resume latest -p "follow-up question"

# Resume specific session
gemini --resume 3 -p "follow-up question"
```

### Session Management
```bash
# List available sessions
gemini --list-sessions

# Delete a session
gemini --delete-session 3
```

### Key Flags
- `-p, --prompt`: Prompt text (one-shot mode)
- `-i, --prompt-interactive`: Execute prompt then enter interactive mode
- `-y, --yolo`: Auto-approve all actions (use with caution)
- `--approval-mode`: Control approval (default, auto_edit, yolo)
- `-r, --resume`: Resume session by index or "latest"

## Guidelines

### Detection & Routing
```
User message → Analyze intent:
  ├─ Needs current/web info? → Use Gemini
  ├─ Code/file task? → Handle yourself
  └─ Ambiguous? → Ask user or default to yourself
```

### Session Context Tracking
- **Auto-resume rule:** If last message involved Gemini AND current message is a follow-up → use `--resume latest`
- **New session trigger:** User says "new gemini session" OR topic change detected
- **Context window:** Track last 3-5 messages to determine if follow-up

### Response Format

**Standard format:**
```
[🔍 Gemini Search]

<gemini's response here>

---
[Session: latest | Tokens: ~X]
```

**With commentary (only if helpful):**
```
[🔍 Gemini Search]

<gemini's response>

---
💡 My take: <brief comment if you have valuable insight to add>
```

### Error Handling
- If Gemini fails → try once more, then handle yourself
- If session resume fails → start new session
- Always inform user if Gemini was unavailable

## Best Practices

### Token Efficiency
- ✅ Use Gemini for info retrieval → saves your context window
- ✅ Keep Gemini queries focused and specific
- ⚠️ Don't use Gemini for tasks you can handle better

### Conversation Flow
- Track whether you're in a "Gemini conversation" vs normal chat
- Clear session boundaries to avoid confusion
- Let user know when switching between you and Gemini

### Quality Control
- If Gemini's answer seems wrong/outdated → say so
- You can fact-check or add context to Gemini results
- Don't blindly trust Gemini (or yourself)

## Examples

### Example 1: Current Events
```
User: "What's the latest news on Taiwan's tech sector?"
You: [Detect: current events → use Gemini]

[🔍 Gemini Search]
<calls: gemini -p "Latest news on Taiwan's tech sector">
<returns result>
```

### Example 2: Follow-up
```
User: "What about semiconductor exports?"
You: [Detect: follow-up to previous Gemini query]

[🔍 Gemini Search - Continued]
<calls: gemini --resume latest -p "What about Taiwan's semiconductor exports?">
<returns result>
```

### Example 3: Hybrid Response
```
User: "Compare Python and Rust for systems programming"
You: [Detect: this is YOUR strength, not a web search]
<provide detailed analysis yourself>
<optionally: "Would you like me to check Gemini for recent benchmarks or articles?">
```

### Example 4: Explicit Request
```
User: "Ask Gemini: 台北明天天氣如何？"
You: [Explicit trigger → always use Gemini]

[🔍 Gemini Search]
<calls: gemini -p "台北明天天氣預報">
<returns result>
```

## Google Search Grounding

Gemini CLI includes built-in `google_web_search` tool that automatically grounds responses with real-time web data:
- Gemini decides when to use it based on query context
- Returns synthesized answers with citations
- To explicitly trigger: ask Gemini to "search the web for..." or "look up..."

This is automatic - no special flags needed.

## Saving and Sharing Search Results

When user requests to save or share Gemini search results as a markdown file:

### Workflow
1. Organize the Gemini response into a well-structured markdown document
2. Save to `/Users/dydo/clawd/gemini-searches/` with descriptive filename
3. Send to user's Telegram Saved Messages

### Manual Method
```bash
# 1. Create markdown file
cat > /Users/dydo/clawd/gemini-searches/YYYY-MM-DD_topic.md << 'EOF'
# Title
[content here]
EOF

# 2. Send to Saved Messages
telegram send-file "me" "/path/to/file.md" "📋 Title"
```

### Using the Script
```bash
# Use the helper script (if content is in a variable)
~/clawd/skills/gemini-search/scripts/save-and-send.sh "Title" "$CONTENT"
```

### Important Notes
- **Filename format:** `YYYY-MM-DD_HHMM_descriptive-title.md` or `YYYY-MM-DD_topic.md`
- **Storage location:** `/Users/dydo/clawd/gemini-searches/` (create if needed)
- **Telegram command:** Use `telegram send-file "me" <path> <caption>` (NOT `send document`)
- **Known issue:** TIMEOUT error after send is normal - file is successfully sent (check for "sent file id")

### Example
```
User: "可以幫我把剛剛的建議做成markdown檔傳給我嗎"
You:
1. Create structured markdown with the Gemini response
2. Save to /Users/dydo/clawd/gemini-searches/2026-01-12_北海道交通方案.md
3. Run: telegram send-file "me" "/Users/dydo/clawd/gemini-searches/2026-01-12_北海道交通方案.md" "📋 北海道交通方案"
4. Confirm to user (ignore TIMEOUT in output if "sent file id" appears)
```

## Configuration

See `~/clawd/TOOLS.md` for environment-specific settings:
- Preferred model (default: Gemini 2.0 Flash Thinking)
- Auto-approve settings
- Session cleanup preferences

---

**Version:** 2.2  
**Last updated:** 2026-01-12  
**Status:** Active — follows Claude Code skill format
