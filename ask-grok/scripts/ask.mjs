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

async function main() {
    let browser;
    let page;

    try {
        // Connect to existing Chrome instance via CDP
        browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (err) {
        console.error(`Failed to connect to Chrome at ${CDP_ENDPOINT}: ${err.message}`);
        console.error("Make sure Chrome is running with --remote-debugging-port=18800");
        process.exit(1);
    }

    // Get the default context
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
        // Use the first page if available or create new
        if (pages.length > 0) {
            page = pages[0];
        } else {
            page = await context.newPage();
        }
        await page.goto("https://grok.com/");
    } else {
        await page.bringToFront();
    }

    // Increase default timeout for long Grok responses (2 minutes)
    page.setDefaultTimeout(120000);

    // Wait for input
    const inputSelector = 'div.tiptap.ProseMirror[contenteditable="true"]';
    try {
        await page.waitForSelector(inputSelector, { timeout: 10000 });
    } catch (e) {
        console.error(`Could not find Grok input box (${inputSelector}). Are you logged in?`);
        console.error("Please login to Grok in the browser and try again.");
        process.exit(1);
    }

    // Get initial message count
    const initialMessageCount = await page.evaluate(() => {
        return document.querySelectorAll('.message-bubble').length;
    });

    // Type query
    await page.click(inputSelector);

    // Clear existing text just in case
    await page.click(inputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');

    await page.keyboard.type(query);
    await page.keyboard.press("Enter");

    console.error("Question sent. Waiting for response...");

    // Wait for new message to appear and stabilize
    const responseText = await page.evaluate(async (startCount) => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        // 1. Wait for new message to appear (max 10 seconds)
        let checks = 0;
        while (checks < 100) {
            const currentCount = document.querySelectorAll('.message-bubble').length;
            if (currentCount > startCount) break;
            await sleep(100);
            checks++;
        }

        if (checks >= 100) {
            return "ERROR: No response received within 10 seconds";
        }

        // 2. Wait for message content to stabilize (streaming end)
        let stableCount = 0;
        let lastText = '';

        // Get all messages
        const getLastGrokMessage = () => {
            const messages = Array.from(document.querySelectorAll('.message-bubble'));
            // Filter out user messages (they have bg-surface-l1 class)
            const grokMessages = messages.filter(m => !m.className.includes('bg-surface-l1'));
            if (grokMessages.length === 0) return null;
            return grokMessages[grokMessages.length - 1].innerText;
        };

        // Wait max 60s for answer generation to stabilize
        for (let i = 0; i < 600; i++) {
            await sleep(100);
            const currentText = getLastGrokMessage();
            
            if (currentText === lastText && currentText && currentText.length > 0) {
                stableCount++;
            } else {
                stableCount = 0;
                lastText = currentText;
            }

            // If stable for 1.5 seconds, assume done
            if (stableCount > 15) break;
        }

        return lastText || "ERROR: Could not extract response";
    }, initialMessageCount);

    console.log(responseText);

    // Don't close the browser - we're just connecting to it
    // The browser instance remains open for future use
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
