import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results.json" }]],
  webServer: {
    command: "npx vite --port 5173 --host 127.0.0.1",
    url: "http://127.0.0.1:5173/",
    reuseExistingServer: true,
    timeout: 30000,
    cwd: "/Users/yangbo/Documents/Projects/AiWriter",
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    screenshot: "on",
    video: "off",
    trace: "off",
    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--allow-insecure-localhost",
        "--ignore-certificate-errors",
        "--disable-features=NetworkService,NetworkServiceInProcess",
        "--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1,http://localhost",
        "--disable-gpu",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
