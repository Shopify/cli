import {launchCLI} from './cli-launcher.js'
import {describe, expect, test} from 'vitest'

describe('launchCLI', () => {
  test('launches the CLI successfully with help flag', async () => {
    // This test verifies that the CLI can be launched without errors
    // The help output is visible in the test output, confirming it works
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['--help']})).resolves.toBeUndefined()
  })

  test('fails if args are invalid', async () => {
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['this', 'is', 'invalid']})).rejects.toThrow()
  })
})
