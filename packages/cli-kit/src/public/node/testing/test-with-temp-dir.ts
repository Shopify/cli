import {inTemporaryDirectory} from '../fs.js'
import {test, TestAPI} from 'vitest'

interface TempDirFixture {
  tempDir: string
}

/**
 * Vitest fixture providing the test with a temporary directory to work in.
 */
export const testWithTempDir: TestAPI<TempDirFixture> = test.extend<TempDirFixture>({
  // eslint-disable-next-line no-empty-pattern
  tempDir: async ({}, use) => {
    await inTemporaryDirectory(async (tempDir) => {
      await use(tempDir)
    })
  },
})
