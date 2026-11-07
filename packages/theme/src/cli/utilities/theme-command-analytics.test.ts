import ThemeCommand from './theme-command.js'
import {Config, Flags} from '@oclif/core'
import {compileData} from '@shopify/cli-kit/node/analytics'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/metadata')

test.each(
  ['compile', 'public metadata', 'sensitive metadata'].flatMap((failure) =>
    [false, true].map((commandFails) => ({failure, commandFails})),
  ),
)('preserves the command outcome when $failure fails, commandFails=$commandFails', async ({failure, commandFails}) => {
  const commandError = new Error('Command failed')
  const telemetryError = new Error('Telemetry failed')
  class TestCommand extends ThemeCommand {
    static flags = {
      store: Flags.string({env: 'SHOPIFY_FLAG_STORE'}),
      password: Flags.string({env: 'SHOPIFY_FLAG_PASSWORD'}),
    }

    static multiEnvironmentsFlags = ['store']

    command = vi.fn(async () => {
      if (commandFails) throw commandError
    })
  }

  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'example.myshopify.com', token: 'token'})
  vi.mocked(compileData).mockImplementation(() => {
    if (failure === 'compile') throw telemetryError
    return {timings: {}, errors: {}, retries: {}, events: {}} as ReturnType<typeof compileData>
  })
  vi.mocked(addPublicMetadata).mockImplementation(async (metadata) => {
    if (failure === 'public metadata' && 'cmd_theme_timings' in (await metadata())) throw telemetryError
  })
  if (failure === 'sensitive metadata') vi.mocked(addSensitiveMetadata).mockRejectedValue(telemetryError)
  const config = new Config({root: __dirname})
  await config.load()
  const command = new TestCommand(['--store', 'example.myshopify.com', '--password', 'token'], config)

  if (commandFails) {
    await expect(command.run()).rejects.toBe(commandError)
  } else {
    await expect(command.run()).resolves.toBeUndefined()
  }
  expect(command.command).toHaveBeenCalledOnce()
})
