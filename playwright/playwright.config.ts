"import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test configuration file location
  fullyParallel: true,
  /* reporter: 'list', */
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  
  // Base URL for the tests (assuming local development server)
  use: {
    baseURL: 'http://localhost:3000', // Change to your actual dev URL if different
    trace: 'on', // Useful for debugging failing tests
    viewport: { width: 1280, height: 720 },
    browserName: 'chromium',
  },

  // Project configuration to support different environments
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});"
