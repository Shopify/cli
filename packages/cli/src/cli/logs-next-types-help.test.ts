import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('registers hidden type discovery alongside retrieval and legacy logs', async () => {
  const config = await loadConfig()
  const types = config.findCommand('app:logs-next:types')!

  expect(types.hidden).toBe(true)
  expect(types.flags).toHaveProperty('json')
  expect(types.flags).toHaveProperty('json-schema')
  expect(types.flags).toHaveProperty('no-input')
  expect(types.flags).not.toHaveProperty('client-id')
  expect(config.findCommand('app:logs-next')?.hidden).toBe(true)
  expect(config.findCommand('app:logs')?.hidden).toBe(true)
  expect(config.findCommand('app:logs:sources')).toBeUndefined()
  expect(config.findCommand('app:logs:types')).toBeUndefined()
})

test('normal app help omits hidden type discovery', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app'])
  const result = await helpService(await loadConfig(), ['app'])

  expect(log.mock.calls.flat().join('\n')).not.toContain('app logs-next types')
  expect(result.commands.some(({id}) => id === 'app:logs-next:types')).toBe(false)
})

test('direct text and JSON help find the types subcommand rather than legacy logs', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app', 'logs-next', 'types'])
  const result = await helpService(await loadConfig(), ['app', 'logs-next', 'types'])

  expect(log.mock.calls.flat().join('\n')).toContain('app logs-next types')
  expect(log.mock.calls.flat().join('\n')).not.toContain('App logs were removed')
  expect(result).toMatchObject({kind: 'command', command: {id: 'app:logs-next:types', hidden: true}})
})
