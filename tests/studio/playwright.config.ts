import { defineConfig } from '@playwright/test';

if (!process.env.VIEWER_URL) throw new Error('Set VIEWER_URL to the retained Project Shelf published-song preview; tests never launch an unmanaged server.');
export default defineConfig({
  testDir: '.', testMatch: '**/*.spec.ts', workers: 1,
  use: { baseURL: process.env.VIEWER_URL, headless: true, launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] } },
  reporter: [['list']], outputDir: '../../test-results',
});
