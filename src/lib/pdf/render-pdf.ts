import type { Browser } from "puppeteer-core";

/**
 * Render a page of the app to a PDF buffer using headless Chromium.
 *
 * Production (Vercel) uses @sparticuz/chromium's bundled binary; locally it
 * falls back to a system Chrome (set CHROME_PATH to override). Auth is carried
 * by forwarding the caller's Cookie header so the headless browser loads the
 * page as the signed-in user.
 */
export async function renderPagePdf(opts: {
  url: string;
  cookie: string | null;
}): Promise<Buffer> {
  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer-core") as typeof import("puppeteer-core");

  let browser: Browser | null = null;
  try {
    if (isServerless) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chromium = require("@sparticuz/chromium").default as typeof import("@sparticuz/chromium").default;
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 1696 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const executablePath =
        process.env.CHROME_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      browser = await puppeteer.launch({
        defaultViewport: { width: 1280, height: 1696 },
        executablePath,
        headless: true,
      });
    }

    const page = await browser.newPage();
    if (opts.cookie) {
      await page.setExtraHTTPHeaders({ cookie: opts.cookie });
    }
    // Print media so Tailwind `print:hidden` strips nav/chrome.
    await page.emulateMediaType("print");
    await page.goto(opts.url, { waitUntil: "networkidle0", timeout: 45_000 });
    // Let client charts (Recharts) finish their entry render.
    await new Promise((r) => setTimeout(r, 1500));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser?.close();
  }
}
