import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('registers hidden filter discovery only under logs-next', async () => {
  const config = await loadConfig()
  const filters = config.findCommand('app:logs-next:filters')!

  expect(filters.hidden).toBe(true)
  expect(filters.flags.type).toMatchObject({multiple: true, options: ['webhook', 'graphql']})
  expect(filters.flags).toHaveProperty('json')
  expect(filters.flags).toHaveProperty('json-schema')
  expect(filters.flags).toHaveProperty('no-input')
  expect(filters.flags).not.toHaveProperty('client-id')
  expect(config.findCommand('app:logs:filters')).toBeUndefined()
  expect(config.findCommand('app:logs-next:types')?.hidden).toBe(true)
  expect(config.findCommand('app:logs-next')?.hidden).toBe(true)
})

test('normal app help omits hidden filter discovery', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app'])
  const result = await helpService(await loadConfig(), ['app'])

  expect(log.mock.calls.flat().join('\n')).not.toContain('app logs-next filters')
  expect(result.commands.some(({id}) => id === 'app:logs-next:filters')).toBe(false)
})

test('direct text and JSON help resolve the filters subcommand', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app', 'logs-next', 'filters'])
  const result = await helpService(await loadConfig(), ['app', 'logs-next', 'filters'])

  expect(log.mock.calls.flat().join('\n')).toContain('app logs-next filters')
  expect(result).toMatchObject({kind: 'command', command: {id: 'app:logs-next:filters', hidden: true}})
})
