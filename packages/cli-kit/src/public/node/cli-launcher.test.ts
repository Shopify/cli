import {launchCLI} from './cli-launcher.js'
import {describe, expect, test} from 'vitest'

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
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['this', 'is', 'invalid']})).rejects.toThrow()
  })
})
