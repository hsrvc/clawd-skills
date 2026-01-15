#!/usr/bin/env node

import { chromium } from "playwright-core";

const CDP_ENDPOINT = process.env.CDP_URL || "http://localhost:18800";

async function main() {
    let browser;

    try {
        browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (err) {
        console.error(`Failed to connect to Chrome at ${CDP_ENDPOINT}: ${err.message}`);
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

    let page;
    for (const p of pages) {
        if (p.url().includes("grok.com")) {
            page = p;
            break;
        }
    }

    if (!page) {
        console.error("No Grok tab found. Please open grok.com first.");
        process.exit(1);
    }

    await page.bringToFront();

    console.log("=== Grok DOM Structure Analysis ===\n");
    
    // Find all message containers
    const messages = await page.evaluate(() => {
        const results = [];
        
        // Try different possible selectors for messages
        const selectors = [
            'div[data-testid*="message"]',
            'div[class*="message"]',
            'div[class*="Message"]',
            'article',
            '[role="article"]',
            'div[class*="chat"]',
            'div[class*="Chat"]'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                results.push({
                    selector: selector,
                    count: elements.length,
                    samples: Array.from(elements).slice(-3).map(el => ({
                        classes: el.className,
                        textPreview: el.innerText?.substring(0, 100),
                        children: el.children.length,
                        attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`)
                    }))
                });
            }
        }
        
        return results;
    });
    
    console.log("Message container candidates:");
    console.log(JSON.stringify(messages, null, 2));
    
    console.log("\n=== Input Element ===\n");
    
    const inputInfo = await page.evaluate(() => {
        const input = document.querySelector('div.tiptap.ProseMirror[contenteditable="true"]');
        if (!input) return null;
        
        return {
            classes: input.className,
            parent: input.parentElement?.className,
            grandparent: input.parentElement?.parentElement?.className,
            attributes: Array.from(input.attributes).map(a => `${a.name}="${a.value}"`)
        };
    });
    
    console.log(JSON.stringify(inputInfo, null, 2));
    
    console.log("\n=== Overall Structure ===\n");
    
    const structure = await page.evaluate(() => {
        const body = document.body;
        const mainContainers = Array.from(document.querySelectorAll('body > *')).map(el => ({
            tag: el.tagName,
            id: el.id,
            classes: el.className,
            childCount: el.children.length
        }));
        
        return {
            title: document.title,
            mainContainers,
            hasReactRoot: !!document.querySelector('#__next, [data-reactroot], #root')
        };
    });
    
    console.log(JSON.stringify(structure, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
