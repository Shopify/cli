import SandboxPreview from './sandbox-preview.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {Config} from '@oclif/core'
import {describe, vi, expect, test, beforeEach} from 'vitest'

vi.mock('../../services/dev-override.js')

const CommandConfig = new Config({root: __dirname})

describe('SandboxPreview', () => {
  beforeEach(() => {
    vi.mocked(devWithOverrideFile).mockResolvedValue(undefined)
  })

  async function run(argv: string[]) {
    await CommandConfig.load()
    const command = new SandboxPreview(argv, CommandConfig)
    await command.run()
  }

  test('calls devWithOverrideFile in authless mock.shop mode', async () => {
    await run(['--overrides=/path/to/overrides.json'])

    expect(devWithOverrideFile).toHaveBeenCalledWith({
      overrideJson: '/path/to/overrides.json',
      open: true,
      mockShop: true,
      mockShopStorefrontUrl: undefined,
    })
  })

  test('passes through --no-open when provided', async () => {
    await run(['--overrides=/path/to/overrides.json', '--no-open'])

    expect(devWithOverrideFile).toHaveBeenCalledWith({
      overrideJson: '/path/to/overrides.json',
      open: false,
      mockShop: true,
      mockShopStorefrontUrl: undefined,
    })
  })

  test('passes through a custom storefront URL when provided', async () => {
    await run(['--overrides=/path/to/overrides.json', '--storefront-url=http://localhost:3000'])

    expect(devWithOverrideFile).toHaveBeenCalledWith({
      overrideJson: '/path/to/overrides.json',
      open: true,
      mockShop: true,
      mockShopStorefrontUrl: 'http://localhost:3000',
    })
  })
})
