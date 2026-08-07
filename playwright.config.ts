import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (existsSync(systemChrome) ? systemChrome : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 3,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath
      ? {
        launchOptions: {
            executablePath,
            args: ['--disable-extensions', '--disable-gpu'],
          },
        }
      : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    // Use a narrow desktop context so the suite also works with an installed system browser.
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
