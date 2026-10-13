import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "",
    },
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"], locale: "en-US" } },
    { name: "iphone", use: { ...devices["iPhone 14"], locale: "en-US" } },
    { name: "pixel", use: { ...devices["Pixel 7"], locale: "en-US" } },
  ],
});
