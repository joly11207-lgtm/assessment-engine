import { access, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";

const browserCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
];
const executablePath = await findBrowser();
const browserServer = await chromium.launchServer({ executablePath, headless: true });
const browser = await chromium.connect(browserServer.wsEndpoint());
const outputDirectory = resolve("artifacts", "screenshots");
const fixtures = ["demo-personality", "demo-ranking", "demo-relationship"];
const widths = [360, 375, 390, 430, 768, 1280];
const expectedShareSizes = {
  "demo-personality": { width: 1080, height: 1440 },
  "demo-ranking": { width: 1080, height: 1080 },
  "demo-relationship": { width: 1080, height: 1920 }
};

await mkdir(outputDirectory, { recursive: true });

let completed = false;
try {
  await captureProductFlow();

  for (const fixture of fixtures) {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await completeAssessment(page, fixture);

    await assertNoHorizontalOverflow(page, fixture);

    await page.setViewportSize({ width: 390, height: 844 });
    if (fixture !== "demo-ranking") {
      const radar = page.locator(".recharts-surface");
      await radar.waitFor({ state: "visible" });
      const box = await radar.boundingBox();
      if (!box || box.width < 200 || box.height < 200) {
        throw new Error(`${fixture} radar chart did not render at a readable size`);
      }
    }

    const blockOrder = await page.locator("[data-block-type]").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-block-type"))
    );
    if (fixture === "demo-relationship") {
      await page.screenshot({
        fullPage: true,
        path: resolve(outputDirectory, "compatibility-pair-selector-mobile.png")
      });
      await selectCompatibilityTarget(page, "steady-harbor", "91%");
      await page.screenshot({
        fullPage: true,
        path: resolve(outputDirectory, "compatibility-high-mobile.png")
      });
      await selectCompatibilityTarget(page, "open-trail", "59%");
      await page.screenshot({
        fullPage: true,
        path: resolve(outputDirectory, "compatibility-low-mobile.png")
      });
      await selectCompatibilityTarget(page, "steady-harbor", "91%");
    }
    await page.screenshot({
      fullPage: true,
      path: resolve(outputDirectory, `${fixture}-mobile.png`)
    });
    const shareCard = page.locator("[data-share-card]");
    await shareCard.waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("[data-share-card] img")).every((image) => image.complete)
    );
    await shareCard.screenshot({
      path: resolve(outputDirectory, `${fixture}-share-card.png`)
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator(".share-export-button").click();
    const download = await downloadPromise;
    const exportedPath = resolve(outputDirectory, `${fixture}-exported-share-card.png`);
    await download.saveAs(exportedPath);
    const actualSize = await readPngSize(exportedPath);
    const expectedSize = expectedShareSizes[fixture];
    if (actualSize.width !== expectedSize.width || actualSize.height !== expectedSize.height) {
      throw new Error(
        `${fixture} exported ${actualSize.width}x${actualSize.height}, expected ${expectedSize.width}x${expectedSize.height}`
      );
    }
    if (fixture === "demo-relationship") {
      const compatibilityDownloadPromise = page.waitForEvent("download");
      await page.locator(".share-export-button").click();
      const compatibilityDownload = await compatibilityDownloadPromise;
      await compatibilityDownload.saveAs(resolve(outputDirectory, "compatibility-exported-share-card.png"));
    }
    console.log(`PASS ${fixture}: ${blockOrder.join(" -> ")}`);
    await context.close();
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce"
  });
  const reducedPage = await reducedContext.newPage();
  await completeAssessment(reducedPage, "demo-personality");
  const reducedMotionState = await reducedPage.evaluate(() => ({
    requested: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    visibleCards: Array.from(document.querySelectorAll("[data-block-type]")).every(
      (element) => getComputedStyle(element).opacity === "1"
    )
  }));
  if (!reducedMotionState.requested || !reducedMotionState.visibleCards) {
    throw new Error("Reduced-motion result content was not immediately visible");
  }
  console.log("PASS reduced motion");
  await reducedContext.close();
  completed = true;
} finally {
  const browserProcess = browserServer.process();
  if (process.platform === "win32" && browserProcess.pid) {
    spawnSync("taskkill", ["/PID", String(browserProcess.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    browserProcess.kill("SIGKILL");
  }
  if (completed) {
    process.exit(0);
  }
}

async function completeAssessment(page, fixture) {
  await page.goto(`http://127.0.0.1:5173/test/${fixture}/run`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
  await completeCurrentAssessment(page);
}

async function completeCurrentAssessment(page) {
  for (let question = 0; question < 100; question += 1) {
    if (await page.locator(".result-page").isVisible()) {
      await page.locator("[data-block-type]").first().waitFor({ state: "visible" });
      return;
    }

    const options = page.locator('input[type="radio"]');
    if ((await options.count()) === 0) {
      await page.waitForTimeout(50);
      continue;
    }
    await options.first().check();

    const submit = page.getByRole("button", { name: "查看结果" });
    if (await submit.isVisible()) {
      await submit.click();
      await page.waitForFunction(() => document.querySelector(".result-page"), null, { timeout: 60000 });
      await page.locator(".result-page").waitFor({ state: "visible", timeout: 10000 });
      await page.waitForTimeout(800);
      return;
    }

    await page.locator(".runner-actions button:not([disabled])").last().click();
  }

  throw new Error("Could not complete assessment");
}

async function captureProductFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "轻测一下" }).waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(page, "homepage");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ fullPage: true, path: resolve(outputDirectory, "homepage-mobile.png") });

  await page.goto("http://127.0.0.1:5173/test/demo-personality", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "人格光谱小测" }).waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(page, "test landing");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ fullPage: true, path: resolve(outputDirectory, "demo-personality-landing-mobile.png") });

  await page.goto("http://127.0.0.1:5173/test/demo-personality/run", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="radio"]').first().waitFor({ state: "attached" });
  await assertNoHorizontalOverflow(page, "runner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ fullPage: true, path: resolve(outputDirectory, "runner-mobile.png") });

  await page.goto("http://127.0.0.1:5173/test/demo-relationship?pair=steady-harbor", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
  assertNoPrivateInviteData(page.url(), "invite landing URL");
  await assertNoHorizontalOverflow(page, "invite landing");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ fullPage: true, path: resolve(outputDirectory, "compatibility-invite-landing-mobile.png") });
  await page.locator(".button").last().click();
  assertNoPrivateInviteData(page.url(), "invite runner URL");
  await completeCurrentAssessment(page);
  await page.getByText("91%").first().waitFor({ state: "visible" });
  const inviteResultText = await page.locator(".result-page").innerText();
  if (!inviteResultText.includes("稳定港湾") || !inviteResultText.includes("温柔建筑师")) {
    throw new Error("Invite flow did not preserve source result and render Person B target result");
  }
  await page.locator("[data-share-card]").waitFor({ state: "visible" });
  assertNoPrivateInviteData(page.url(), "invite result URL");
  await page.screenshot({ fullPage: true, path: resolve(outputDirectory, "compatibility-invite-result-mobile.png") });

  await context.close();
}

async function selectCompatibilityTarget(page, targetId, expectedText) {
  const selector = page.locator("[data-compatibility-selector] select");
  await selector.waitFor({ state: "visible" });
  await selector.selectOption(targetId);
  await page.getByText(expectedText).first().waitFor({ state: "visible" });
  await page.waitForTimeout(250);
}

function assertNoPrivateInviteData(url, label) {
  for (const forbidden of ["answers", "localStorage", "session", "history", "user", "token", "q01"]) {
    if (url.includes(forbidden)) {
      throw new Error(`${label} exposes private data marker "${forbidden}"`);
    }
  }
}

async function assertNoHorizontalOverflow(page, label) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    if (layout.scrollWidth > layout.clientWidth) {
      throw new Error(`${label} overflows horizontally at ${width}px (${layout.scrollWidth}px content)`);
    }
  }
}

async function readPngSize(filePath) {
  const buffer = await readFile(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser candidate.
    }
  }
  throw new Error("No supported local Chromium browser was found");
}
