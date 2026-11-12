#!/usr/bin/env node
/**
 * Key routes against a running preview or dev server.
 * E2E_BASE_URL defaults to the production preview on 127.0.0.1:8081.
 */
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:8081";
const routes = [
  ["/", "Street Royalty"],
  ["/studio", "Build the piece"],
  ["/shop", "The rack"],
  ["/gallery", "Your rack"],
  ["/cart", "Cart"],
  ["/orders", "Orders"],
  ["/login", "Sign in"],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  for (const [path, text] of routes) {
    let response = null;
    try {
      response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_ABORTED")) throw error;
      response = await page.goto(`${base}${path}`, { waitUntil: "commit", timeout: 30_000 });
    }
    const status = response?.status() ?? 0;
    if (status >= 400) throw new Error(`${path} returned ${status}`);
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
    console.log(`ok ${path}`);
  }
  await page.goto(`${base}/studio`, { waitUntil: "domcontentloaded" });
  await page.getByText(/tee|hoodie|hat/i).first().waitFor({ timeout: 25_000 });
  console.log("ok studio catalog");

  await page.goto(`${base}/shop`, { waitUntil: "networkidle" });
  await page.getByLabel("Search the rack").fill("pink hoodie");
  await page.getByRole("button", { name: "Find" }).click();
  await page.getByText(/Matched with/).waitFor({ timeout: 20_000 });
  console.log("ok shop search");

  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
