import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('registers hidden retrieval alongside the existing streaming commands', async () => {
  const config = await loadConfig()
  const next = config.findCommand('app:logs-next')!
  const logs = config.findCommand('app:logs')!
  const sources = config.findCommand('app:logs:sources')

  expect(next.hidden).toBe(true)
  expect(next.flags).toHaveProperty('since')
  expect(next.flags).toHaveProperty('limit')
  expect(next.flags).not.toHaveProperty('source')
  expect(logs.flags).toHaveProperty('source')
  expect(sources).toBeDefined()
})

test('normal app help omits the hidden retrieval command', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app'])
  const result = await helpService(await loadConfig(), ['app'])

  expect(log.mock.calls.flat().join('\n')).not.toContain('logs-next')
  expect(result.commands.some(({id}) => id === 'app:logs-next')).toBe(false)
  expect(result.topics.some(({name}) => name === 'app:logs-next')).toBe(false)
  expect(result.commands).toContainEqual(expect.objectContaining({id: 'app:logs', hidden: false}))
})

test('direct text and JSON help remain available for the hidden command', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app', 'logs-next'])
  const result = await helpService(await loadConfig(), ['app', 'logs-next'])

  expect(log.mock.calls.flat().join('\n')).toContain('app logs-next')
  expect(result).toMatchObject({kind: 'command', command: {id: 'app:logs-next', hidden: true}})
})
