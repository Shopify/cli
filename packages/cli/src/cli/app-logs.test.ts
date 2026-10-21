import ShopifyHelp from './help.js'
import {Config, run, ux} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

describe('removed app logs command discovery', () => {
  test.each([
    {argv: ['--store', 'example.myshopify.com', '--status', 'failure']},
    {argv: ['sources']},
    {argv: ['sources', '--json']},
  ])('routes app logs $argv to the hidden stub', async ({argv}) => {
    const config = await loadConfig()
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
    const runCommand = vi.spyOn(config, 'runCommand').mockResolvedValue(undefined)

    await run(['app', 'logs', ...argv], config)

    expect(runCommand).toHaveBeenCalledExactlyOnceWith(
      'app:logs',
      argv,
      expect.objectContaining({id: 'app:logs', hidden: true}),
    )
    expect(config.findCommand('app:logs:sources')).toBeUndefined()
  })

  test('omits app logs from app help', async () => {
    const help = new ShopifyHelp(await loadConfig(), {stripAnsi: true})
    const stdout = vi.spyOn(ux, 'stdout').mockImplementation(() => {})
    try {
      await help.showHelp(['app'])

      const output = stdout.mock.calls.flat().join('\n')
      expect(output).toContain('app dev')
      expect(output).not.toContain('app logs')
    } finally {
      stdout.mockRestore()
    }
  })
})
