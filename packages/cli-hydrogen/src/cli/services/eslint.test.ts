import {describe, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'

describe('addEslint', () => {
  it("throws an error if the configuration file doesn't exist", async () => {
    await temporary.directory(async (tmpDir) => {
      const app = {
        directory: tmpDir,
      }
      // When
      await addESLint({app})

      // Then
      await expect(file.read(path.join(tmpDir, '.eslintrc'))).resolves.toBe(true)
    })
  })
})
