#!/usr/bin/env node

import { chromium } from "playwright";
import { parseArgs } from "node:util";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// Prevent Playwright from stalling on document.fonts.ready in Linux/WSL environments
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";

function printHelp() {
  console.log(`
Universal PR Screenshot Tool (HeimspielRadar)
Captures paired desktop (1280x800) and mobile (390x844) screenshots for PR visual evidence.

Usage:
  node scripts/capture-pr-screenshot.mjs [options]
  npm run screenshot -- [options]

Options:
  --name, -n <filename>     Base filename for screenshots (default: "pr-preview")
  --port, -p <number>       Dev server port (default: auto-detected from env/scan)
  --path <url-path>         Target URL path (default: "/")
  --click, -c <selector>    CSS selector to click before taking screenshot (optional)
  --wait, -w <ms>           Wait time in milliseconds after load/click (default: 1000)
  --output-dir, -o <dir>    Output directory (default: "test-results")
  --help, -h                Show this help message

Examples:
  npm run screenshot -- --name featured-match
  npm run screenshot -- --name search-modal --click "[data-testid='search-button']"
  npm run screenshot -- --port 42173 --path "/matches" --name matches-view
`);
}

function pingPort(port, timeoutMs = 200) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve(port);
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });

    req.on("error", () => {
      resolve(null);
    });
  });
}

function detectWorktreePort() {
  const cwd = process.cwd();
  const match = cwd.match(/issue-(\d+)/);

  if (match) {
    return parseInt(`42${match[1]}`, 10);
  }

  return null;
}

async function resolvePort(portArg) {
  // 1. Explicit CLI parameter
  if (portArg) {
    const parsed = parseInt(portArg, 10);

    if (!Number.isNaN(parsed) && parsed > 0) {
      console.log(`[screenshot] Using specified port: ${parsed}`);

      return parsed;
    }
  }

  // 2. Environment variables
  const envPort = process.env.PORT || process.env.VITE_PORT || process.env.PLAYWRIGHT_PORT;

  if (envPort) {
    const parsed = parseInt(envPort, 10);

    if (!Number.isNaN(parsed) && parsed > 0) {
      console.log(`[screenshot] Using port from environment: ${parsed}`);

      return parsed;
    }
  }

  // 3. Automatic scan: common ports (42000-42300, 3000, 5173)
  console.log("[screenshot] Auto-scanning active dev server ports...");
  const candidatePorts = [];
  const worktreePort = detectWorktreePort();

  if (worktreePort) {
    candidatePorts.push(worktreePort);
  }

  candidatePorts.push(3000, 5173);

  for (let p = 42000; p <= 42300; p++) {
    if (!candidatePorts.includes(p)) {
      candidatePorts.push(p);
    }
  }

  const pingResults = await Promise.all(candidatePorts.map((p) => pingPort(p, 200)));
  const respondingPort = pingResults.find((p) => p !== null);

  if (respondingPort) {
    console.log(`[screenshot] Discovered active server on port: ${respondingPort}`);

    return respondingPort;
  }

  // 4. Fallback port
  console.warn("[screenshot] No active dev server detected on scanned ports. Falling back to port 3000.");

  return 3000;
}

async function captureView(browser, {
  viewport,
  isMobile = false,
  hasTouch = false,
  url,
  clickSelector,
  waitMs,
  outputPath,
}) {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch,
  });

  try {
    const page = await context.newPage();

    // Hard 5-second timeout for navigation
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    if (clickSelector) {
      const locator = page.locator(clickSelector).first();
      await locator.waitFor({ state: "attached", timeout: 5000 });

      // Robust dispatch click for headless Linux/WSL environments without display compositor
      await locator.dispatchEvent("click");

      if (waitMs > 0) {
        await page.waitForTimeout(waitMs);
      }
    }

    await page.screenshot({
      path: outputPath,
      animations: 'disabled',
      timeout: 10000,
    });
  } finally {
    await context.close();
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string", short: "n", default: "pr-preview" },
      port: { type: "string", short: "p" },
      click: { type: "string", short: "c" },
      wait: { type: "string", short: "w", default: "1000" },
      path: { type: "string", default: "/" },
      "output-dir": { type: "string", short: "o", default: "test-results" },
      outputDir: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: false,
  });

  if (values.help) {
    printHelp();

    return;
  }

  const port = await resolvePort(values.port);
  const targetPath = values.path ? (values.path.startsWith("/") ? values.path : `/${values.path}`) : "/";
  const url = `http://127.0.0.1:${port}${targetPath}`;
  const waitMs = parseInt(values.wait || "1000", 10) || 1000;
  const clickSelector = values.click || null;

  const rawOutputDir = values["output-dir"] || values.outputDir || "test-results";
  const outputDir = path.resolve(process.cwd(), rawOutputDir);
  const baseName = (values.name || "pr-preview").replace(/\.png$/i, "");

  const desktopPath = path.join(outputDir, `${baseName}-desktop.png`);
  const mobilePath = path.join(outputDir, `${baseName}-mobile.png`);

  fs.mkdirSync(path.dirname(desktopPath), { recursive: true });

  console.log(`[screenshot] Target URL: ${url}`);

  if (clickSelector) {
    console.log(`[screenshot] Click selector: "${clickSelector}"`);
  }

  console.log(`[screenshot] Wait time: ${waitMs}ms`);

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    console.log(`[screenshot] Capturing Desktop view (1280x800)...`);
    await captureView(browser, {
      viewport: { width: 1280, height: 800 },
      isMobile: false,
      hasTouch: false,
      url,
      clickSelector,
      waitMs,
      outputPath: desktopPath,
    });

    console.log(`[screenshot] Capturing Mobile view (390x844)...`);
    await captureView(browser, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      url,
      clickSelector,
      waitMs,
      outputPath: mobilePath,
    });

    console.log("\n[screenshot] Done! Generated screenshot pair:");
    console.log(`- Desktop: ${desktopPath}`);
    console.log(`- Mobile:  ${mobilePath}`);
  } catch (err) {
    const winChromePath = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";

    if (fs.existsSync(winChromePath)) {
      console.log("[screenshot] Playwright snapshot stalled in WSL; falling back to host Chrome CLI snapshot...");

      try {
        const { execFileSync, execSync } = await import("node:child_process");
        const deskWin = execSync(`wslpath -w "${desktopPath}"`).toString().trim();
        const mobWin = execSync(`wslpath -w "${mobilePath}"`).toString().trim();

        execFileSync(winChromePath, [
          "--headless=new",
          `--screenshot=${deskWin}`,
          "--window-size=1280,800",
          url,
        ]);
        execFileSync(winChromePath, [
          "--headless=new",
          `--screenshot=${mobWin}`,
          "--window-size=390,844",
          '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          url,
        ]);

        console.log("\n[screenshot] Done! Generated screenshot pair via host Chrome:");
        console.log(`- Desktop: ${desktopPath}`);
        console.log(`- Mobile:  ${mobilePath}`);
        process.exitCode = 0;

        return;
      } catch (fallbackErr) {
        console.error(`[screenshot] Host Chrome fallback error: ${fallbackErr.message}`);
      }
    }

    console.error(`\n[screenshot] Error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((err) => {
  console.error(`[screenshot] Fatal error: ${err.message}`);
  process.exit(1);
});
