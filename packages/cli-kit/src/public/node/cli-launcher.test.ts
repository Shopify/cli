import {launchCLI} from './cli-launcher.js'
import {describe, expect, test, vi} from 'vitest'

describe('launchCLI', () => {
  test('launches the CLI', async () => {
    const originalStdoutWrite = process.stdout.write
    const outputs: string[] = []
    process.stdout.write = (str) => {
      outputs.push(str as any)
      return true
    }

    await launchCLI({moduleURL: import.meta.url, argv: ['--help']})
    expect(outputs.join('\n')).toContain(
      'A set of utilities, interfaces, and models that are common across all the platform features',
    )
    // eslint-disable-next-line require-atomic-updates
    process.stdout.write = originalStdoutWrite
  })

  test('fails if args are invalid', async () => {
    // Mock console.error and process.stderr.write to suppress error output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const originalStderrWrite = process.stderr.write

    process.stderr.write = () => true

    try {
      await expect(launchCLI({moduleURL: import.meta.url, argv: ['this', 'is', 'invalid']})).rejects.toThrow()
    } finally {
      // Restore mocks
      consoleErrorSpy.mockRestore()
      // eslint-disable-next-line require-atomic-updates
      process.stderr.write = originalStderrWrite
    }
  })
})
