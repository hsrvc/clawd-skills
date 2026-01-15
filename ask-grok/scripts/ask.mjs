#!/usr/bin/env node

import { chromium } from "playwright-core";

function usage() {
    console.error(`Usage: ask.mjs "query"`);
    process.exit(2);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "-h" || args[0] === "--help") usage();
const query = args[0];

const CDP_ENDPOINT = process.env.CDP_URL || "http://localhost:18800";

// Configuration
const POLL_INTERVAL_MS = 500;           // How often to check for new content
const STABLE_THRESHOLD = 6;             // Consecutive unchanged polls for fallback (3 seconds)
const MAX_WAIT_FOR_RESPONSE_MS = 60000; // Max time to wait for first response (1 min)
const MAX_TOTAL_TIME_MS = 600000;       // 10 minutes max total time

async function main() {
    let browser;
    let page;
    let progressInterval;

    try {
        browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (err) {
        console.error(`Failed to connect to Chrome at ${CDP_ENDPOINT}: ${err.message}`);
        console.error("Make sure Chrome is running with --remote-debugging-port=18800");
        process.exit(1);
    }

    const contexts = browser.contexts();
    if (contexts.length === 0) {
        console.error("No browser contexts found");
        await browser.close();
        process.exit(1);
    }

    const context = contexts[0];
    const pages = context.pages();

    // Look for an existing Grok tab
    for (const p of pages) {
        if (p.url().includes("grok.com")) {
            page = p;
            break;
        }
    }

    if (!page) {
        if (pages.length > 0) {
            page = pages[0];
        } else {
            page = await context.newPage();
        }
        await page.goto("https://grok.com/");
    } else {
        await page.bringToFront();
    }

    // Set reasonable timeout for individual operations
    page.setDefaultTimeout(15000);

    // Wait for input box
    const inputSelector = 'div.tiptap.ProseMirror[contenteditable="true"]';
    try {
        await page.waitForSelector(inputSelector, { timeout: 10000 });
    } catch (e) {
        console.error(`Could not find Grok input box. Are you logged in?`);
        process.exit(1);
    }

    // Get initial message count
    const initialMessageCount = await page.evaluate(() => {
        return document.querySelectorAll('.message-bubble').length;
    });

    // Type and send query
    await page.click(inputSelector);
    await page.click(inputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.keyboard.type(query);
    await page.keyboard.press("Enter");

    console.error("Question sent. Waiting for Grok response (this may take 1-5 minutes for complex queries)...");

    // Progress indicator to show we're still alive
    progressInterval = setInterval(() => {
        process.stderr.write(".");
    }, 10000);  // Print a dot every 10 seconds

    /**
     * Get the full response container text for the last Grok message.
     * This includes the message bubble content AND the action bar (timing, sources, suggestions).
     * Returns { content, hasCompletionIndicators, rawText }
     */
    const getLastGrokResponse = async () => {
        return await page.evaluate(() => {
            const messageBubbles = Array.from(document.querySelectorAll('.message-bubble'));
            // Filter out user messages (they have bg-surface-l1 class)
            const grokBubbles = messageBubbles.filter(m => !m.className.includes('bg-surface-l1'));

            if (grokBubbles.length === 0) return null;

            const lastBubble = grokBubbles[grokBubbles.length - 1];

            // Get the parent container that includes both message and action bar
            // The container has class like "relative group flex flex-col..."
            const container = lastBubble.parentElement;
            if (!container) return null;

            const rawText = container.innerText || '';

            // Extract just the message content (before action bar)
            // Action bar starts with timing pattern like "623ms"
            let content = lastBubble.innerText || '';

            // Check for completion indicators in the full container text
            // These appear AFTER the message content in the action bar
            const hasTimingInfo = /\n\d+m?s\n/.test(rawText) || /\n\d+m?s$/.test(rawText);
            const hasSourcesInfo = /\d+\s*sources?/i.test(rawText);
            const hasFollowUpSuggestions = container.querySelectorAll('button').length >= 5; // action buttons + suggestions

            // Grok shows "Thought for Xs" at the start during thinking, then actual content
            // When streaming is done, the action bar appears
            const hasCompletionIndicators = hasTimingInfo || hasSourcesInfo || hasFollowUpSuggestions;

            return {
                content: content.trim(),
                hasCompletionIndicators,
                hasTimingInfo,
                hasSourcesInfo,
                hasFollowUpSuggestions,
                rawTextLength: rawText.length
            };
        });
    };

    // Helper to check if a new response has appeared
    const hasNewResponse = async () => {
        const count = await page.evaluate(() => {
            return document.querySelectorAll('.message-bubble').length;
        });
        return count > initialMessageCount;
    };

    // Wait for response to appear
    const startTime = Date.now();
    while (Date.now() - startTime < MAX_WAIT_FOR_RESPONSE_MS) {
        if (await hasNewResponse()) break;
        await sleep(POLL_INTERVAL_MS);
    }

    if (!(await hasNewResponse())) {
        clearInterval(progressInterval);
        console.error("\nERROR: No response received within timeout");
        process.exit(1);
    }

    // Stream the response incrementally
    let lastPrintedLength = 0;
    let lastContentLength = 0;
    let stableCount = 0;
    let hasThinkingHeader = false;
    let completionDetected = false;

    while (Date.now() - startTime < MAX_TOTAL_TIME_MS) {
        const response = await getLastGrokResponse();

        if (response === null) {
            await sleep(POLL_INTERVAL_MS);
            continue;
        }

        const currentContent = response.content;

        // Check for "Thinking" indicator and print it once
        if (!hasThinkingHeader && currentContent.startsWith('Thought for')) {
            const thinkMatch = currentContent.match(/^Thought for \d+s\n/);
            if (thinkMatch) {
                process.stdout.write(thinkMatch[0]);
                hasThinkingHeader = true;
                lastPrintedLength = thinkMatch[0].length;
            }
        }

        // Print new content incrementally
        if (currentContent.length > lastPrintedLength) {
            const newContent = currentContent.slice(lastPrintedLength);
            process.stdout.write(newContent);
            lastPrintedLength = currentContent.length;
        }

        // Primary completion check: look for Grok's completion UI elements
        if (response.hasCompletionIndicators) {
            // Completion detected! Wait a bit more to capture any final content
            if (!completionDetected) {
                completionDetected = true;
                console.error("\n[Completion indicators detected, capturing final content...]");
            }

            // Give it 2 more seconds to stabilize
            await sleep(2000);

            // Capture any remaining content
            const finalResponse = await getLastGrokResponse();
            if (finalResponse && finalResponse.content.length > lastPrintedLength) {
                process.stdout.write(finalResponse.content.slice(lastPrintedLength));
            }
            break;
        }

        // Fallback: stability check (content unchanged for STABLE_THRESHOLD polls)
        if (currentContent.length === lastContentLength && currentContent.length > 0) {
            stableCount++;

            // After being stable for a while, check harder for completion
            if (stableCount >= STABLE_THRESHOLD) {
                // Re-check completion indicators
                const recheck = await getLastGrokResponse();
                if (recheck && recheck.hasCompletionIndicators) {
                    console.error("\n[Completion indicators found on recheck]");
                    if (recheck.content.length > lastPrintedLength) {
                        process.stdout.write(recheck.content.slice(lastPrintedLength));
                    }
                    break;
                }

                // If still no completion after extended stability, warn and exit
                if (stableCount >= STABLE_THRESHOLD * 4) {  // ~12 seconds of stability
                    console.error("\n[Warning: Response may be incomplete - no completion indicators found after extended wait]");
                    break;
                }
            }
        } else {
            stableCount = 0;
            lastContentLength = currentContent.length;
        }

        await sleep(POLL_INTERVAL_MS);
    }

    // Check for timeout
    if (Date.now() - startTime >= MAX_TOTAL_TIME_MS) {
        console.error("\n[Warning: Maximum time limit reached]");
    }

    // Clean up
    clearInterval(progressInterval);
    process.stderr.write("\n");
    process.stdout.write('\n');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
