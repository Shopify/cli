import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('registers historical retrieval as app logs', async () => {
  const config = await loadConfig()
  const logs = config.findCommand('app:logs')!

  expect(logs.hidden).toBeFalsy()
  expect(logs.flags).toHaveProperty('since')
  expect(logs.flags).toHaveProperty('limit')
  expect(logs.flags.type).toMatchObject({
    options: ['webhook', 'graphql', 'function', 'app-event', 'app-billing-event', 'rest', 'sidekick', 'ui-extension'],
  })
  expect(logs.flags['function-handle']).toMatchObject({env: 'SHOPIFY_FLAG_FUNCTION_HANDLE'})
  expect(logs.flags.target).toMatchObject({
    env: 'SHOPIFY_FLAG_TARGET',
    description: 'Exact Function execution, Sidekick event, or UI extension target; excludes other record types.',
  })
  expect(logs.flags['request-id']).toMatchObject({
    description: 'Exact GraphQL or REST request ID; excludes other record types.',
  })
  expect(logs.flags).not.toHaveProperty('source')
  expect(config.findCommand('app:logs-next')).toBeUndefined()
  expect(config.findCommand('app:logs:sources')).toBeUndefined()
})

test('app help lists app logs', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app'])
  const result = await helpService(await loadConfig(), ['app'])

  expect(log.mock.calls.flat().join('\n')).toContain('app logs')
  expect(result.commands).toContainEqual(expect.objectContaining({id: 'app:logs', hidden: false}))
})

test('command help groups the flags and lists the log types', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app', 'logs'])
  const output = log.mock.calls.flat().join('\n')
  const result = await helpService(await loadConfig(), ['app', 'logs'])

  expect(output).toContain('FILTER FLAGS')
  expect(output).toContain('QUERY FLAGS')
  expect(output).toContain('--event-handle')
  expect(output).toContain('Exact Function execution, Sidekick event, or UI extension target')
  expect(output).toContain("Sorting isn't needed to establish completeness.")
  expect(output).toContain('Log types and the filters that apply to each.')
  expect(output).toContain('- rest: REST API requests.')
  expect(result).toMatchObject({kind: 'command', command: {id: 'app:logs', hidden: false}})
})
