import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/lang/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'browser',
          pool: 'browser',
          testTimeout: 3000,
          include: ['src/ui/**/*.test.ts'],
          setupFiles: ['./src/test/setupBrowser.ts'],
          browser: {
            enabled: true,
            provider: playwright({
              contextOptions: {
                permissions: ['clipboard-read', 'clipboard-write']
              }
            }),
            instances: [{ browser: 'chromium' }],
            screenshotFailures: false
          }
        }
      }
    ]
  }
})
