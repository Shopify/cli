import {launchCLI} from './cli-launcher.js'
import {ShopifyConfig} from './custom-oclif-loader.js'
import {run} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

describe('launchCLI', () => {
  test('launches the CLI successfully with help flag', async () => {
    // This test verifies that the CLI can be launched without errors
    // The help output is visible in the test output, confirming it works
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['--help']})).resolves.toBeUndefined()
  })

  test('fails if args are invalid', async () => {
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['this', 'is', 'invalid']})).rejects.toThrow()
  })

  test('preserves the loaded Shopify config so commands can be loaded lazily', async () => {
    const command = {id: 'lazy-test'} as any
    const config = new ShopifyConfig({root: import.meta.url})
    const lazyCommandLoader = vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue('ok'),
    })

    config.setLazyCommandLoader(lazyCommandLoader)
    config.findCommand = vi.fn().mockReturnValue(command)
    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})
    config.pjson = {oclif: {}} as any
    config.userAgent = '@shopify/cli-kit/test'

    await expect(run(['lazy-test'], config)).resolves.toBe('ok')

    expect(lazyCommandLoader).toHaveBeenCalledWith('lazy-test')
    expect(config.findCommand).toHaveBeenCalledWith('lazy-test')
  })
})
