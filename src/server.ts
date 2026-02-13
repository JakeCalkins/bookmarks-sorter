import express from "express";
import path from "path";
import net from "node:net";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const rootDir = path.resolve(__dirname, "..");

app.use(
  "/vendor/angular",
  express.static(path.join(rootDir, "node_modules", "angular"))
);
app.use(express.static(path.join(rootDir, "public")));
app.use(express.json({ limit: "128kb" }));

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }
  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 127) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    return true;
  }

  const ipType = net.isIP(normalized);
  if (ipType === 4) {
    return isPrivateIpv4(normalized);
  }
  if (ipType === 6) {
    if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    if (normalized.startsWith("fe80")) {
      return true;
    }
  }

  return false;
}

function validatePreviewUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("URL target is blocked for safety.");
  }

  return parsed;
}

type PreviewProvider = "local_playwright" | "local_puppeteer" | "thumio" | "wordpress_mshots";

function buildRemotePreviewCandidates(url: URL): { providers: PreviewProvider[]; urls: string[] } {
  const normalized = url.toString();
  return {
    providers: ["thumio", "wordpress_mshots"],
    urls: [
      `https://image.thum.io/get/width/1200/noanimate/${normalized}`,
      `https://s.wordpress.com/mshots/v1/${encodeURIComponent(normalized)}?w=1200`
    ]
  };
}

type OptionalHeadlessModule = {
  kind: "playwright" | "puppeteer";
  module: any;
};

let cachedHeadlessModule: OptionalHeadlessModule | null | undefined;

function resolveHeadlessModule(): OptionalHeadlessModule | null {
  if (cachedHeadlessModule !== undefined) {
    return cachedHeadlessModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const playwright = require("playwright");
    if (playwright?.chromium?.launch) {
      cachedHeadlessModule = { kind: "playwright", module: playwright };
      return cachedHeadlessModule;
    }
  } catch {
    // continue to puppeteer
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require("puppeteer");
    if (puppeteer?.launch) {
      cachedHeadlessModule = { kind: "puppeteer", module: puppeteer };
      return cachedHeadlessModule;
    }
  } catch {
    // no local renderer available
  }

  cachedHeadlessModule = null;
  return cachedHeadlessModule;
}

async function renderLocalPreviewImage(url: URL): Promise<{
  imageUrl?: string;
  provider: PreviewProvider;
}> {
  const renderer = resolveHeadlessModule();
  if (!renderer) {
    return {
      provider: "local_playwright"
    };
  }

  try {
    if (renderer.kind === "playwright") {
      const browser = await renderer.module.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 8000 });
        await page.waitForTimeout(400);
        const buffer = (await page.screenshot({
          type: "jpeg",
          quality: 70,
          fullPage: false
        })) as Buffer;
        return {
          imageUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          provider: "local_playwright"
        };
      } finally {
        await browser.close();
      }
    }

    const browser = await renderer.module.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 8000 });
      await new Promise((resolve) => setTimeout(resolve, 400));
      const buffer = (await page.screenshot({
        type: "jpeg",
        quality: 70,
        fullPage: false
      })) as Buffer;
      return {
        imageUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
        provider: "local_puppeteer"
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_local_preview_error";
    console.error("[server.preview.local]", message);
    return {
      provider: renderer.kind === "playwright" ? "local_playwright" : "local_puppeteer"
    };
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/preview", async (req, res) => {
  const rawUrl = String(req.query.url || "");
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url query parameter." });
    return;
  }

  try {
    const validated = validatePreviewUrl(rawUrl);
    const localResult = await renderLocalPreviewImage(validated);
    if (localResult.imageUrl) {
      res.json({
        imageUrl: localResult.imageUrl,
        fallbackImageUrls: []
      });
      return;
    }

    const candidates = buildRemotePreviewCandidates(validated);
    res.json({
      imageUrl: candidates.urls[0],
      fallbackImageUrls: candidates.urls.slice(1)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid preview URL.";
    console.error("[server.preview.validation]", message);
    res.status(400).json({ error: message });
  }
});

process.on("uncaughtException", (error) => {
  console.error("[server.uncaughtException]", error?.stack || error?.message || "Unknown server exception");
  console.error(error);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error("[server.unhandledRejection]", message);
  console.error(reason);
});

app.listen(port, () => {
  console.log(`Bookmark sorter running at http://localhost:${port}`);
});
