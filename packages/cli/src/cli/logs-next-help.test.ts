import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('registers hidden retrieval alongside the legacy logs migration command', async () => {
  const config = await loadConfig()
  const next = config.findCommand('app:logs-next')!
  const logs = config.findCommand('app:logs')!
  const sources = config.findCommand('app:logs:sources')

  expect(next.hidden).toBe(true)
  expect(next.flags).toHaveProperty('since')
  expect(next.flags).toHaveProperty('limit')
  expect(next.flags.type).toMatchObject({
    options: ['webhook', 'graphql', 'function', 'app-event', 'app-billing-event', 'rest', 'sidekick'],
  })
  expect(next.flags['function-handle']).toMatchObject({env: 'SHOPIFY_FLAG_FUNCTION_HANDLE'})
  expect(next.flags.target).toMatchObject({
    env: 'SHOPIFY_FLAG_TARGET',
    description: 'Exact Function execution or Sidekick event target; excludes other record types.',
  })
  expect(next.flags['event-handle']).toMatchObject({env: 'SHOPIFY_FLAG_EVENT_HANDLE'})
  expect(next.flags.method).toMatchObject({env: 'SHOPIFY_FLAG_METHOD'})
  expect(next.flags['request-path']).toMatchObject({env: 'SHOPIFY_FLAG_REQUEST_PATH'})
  expect(next.flags['request-id']).toMatchObject({
    description: 'Exact GraphQL or REST request ID; excludes other record types.',
  })
  expect(next.flags['status-code']).toMatchObject({
    description: 'Exact webhook or REST HTTP status code (100–599); no status classes.',
  })
  expect(next.flags).not.toHaveProperty('source')
  expect(logs.hidden).toBe(true)
  expect(sources).toBeUndefined()
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
  expect(result.commands.some(({id}) => id === 'app:logs')).toBe(false)
})

test('direct text and JSON help remain available for the hidden command', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app', 'logs-next'])
  const result = await helpService(await loadConfig(), ['app', 'logs-next'])

  expect(log.mock.calls.flat().join('\n')).toContain('app logs-next')
  expect(log.mock.calls.flat().join('\n')).toContain('--function-handle')
  expect(log.mock.calls.flat().join('\n')).toContain('--event-handle')
  expect(log.mock.calls.flat().join('\n')).toContain('--method')
  expect(log.mock.calls.flat().join('\n')).toContain('--request-path')
  expect(log.mock.calls.flat().join('\n')).toContain('app-billing-event')
  expect(log.mock.calls.flat().join('\n')).toContain('Exact app event or app billing event handle')
  expect(log.mock.calls.flat().join('\n')).toContain('sidekick')
  expect(log.mock.calls.flat().join('\n')).toContain('Exact Function execution or Sidekick event target')
  expect(log.mock.calls.flat().join('\n')).toContain("Sorting isn't needed to establish completeness.")
  expect(result).toMatchObject({kind: 'command', command: {id: 'app:logs-next', hidden: true}})
})
