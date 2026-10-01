import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173/quick-route/",
    viewport: { width: 320, height: 640 },
    hasTouch: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/quick-route/",
    reuseExistingServer: !process.env.CI,
  },
});
