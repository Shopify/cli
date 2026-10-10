import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config, ux} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

test('normal app help keeps streaming logs visible and omits the preview', async () => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(['app'])
  const output = log.mock.calls.flat().join('\n')
  const result = await helpService(await loadConfig(), ['app'])

  expect(output).toContain('app logs')
  expect(output).not.toContain('logs-next')
  expect(result.commands).toContainEqual(expect.objectContaining({id: 'app:logs', hidden: false}))
  expect(result.commands.some(({id}) => id.startsWith('app:logs-next'))).toBe(false)
  expect(result.topics.some(({name}) => name.startsWith('app:logs-next'))).toBe(false)
})

test.each(['app:logs-next'])('direct text and JSON help remain available for %s', async (id) => {
  const config = await loadConfig()
  const help = new ShopifyHelp(config, {stripAnsi: true})
  const log = vi.spyOn(ux, 'stdout').mockImplementation(() => {})

  await help.showHelp(id.split(':'))
  const result = await helpService(await loadConfig(), id.split(':'))

  expect(log.mock.calls.flat().join('\n')).toContain(id.replaceAll(':', ' '))
  expect(result).toMatchObject({kind: 'command', command: {id, hidden: true}})
})

test('legacy logs help retains streaming flags and source discovery', async () => {
  const config = await loadConfig()

  await expect(helpService(config, ['app', 'logs'])).resolves.toMatchObject({
    kind: 'command',
    command: {id: 'app:logs', hidden: false, flags: {source: {name: 'source'}}},
    commands: [expect.objectContaining({id: 'app:logs:sources', hidden: false})],
  })
  await expect(helpService(config, ['app', 'logs', 'sources'])).resolves.toMatchObject({
    kind: 'command',
    command: {id: 'app:logs:sources', hidden: false},
  })
})
