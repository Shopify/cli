import ShopifyHelp from './help.js'
import {helpService} from './services/commands/help/index.js'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

const commandNames = ['cancel', 'list', 'schedule', 'status', 'unschedule']
const topic = 'app:subscription-migrations'

async function loadConfig() {
  return Config.load({root: fileURLToPath(new URL('../../', import.meta.url)), userPlugins: false, devPlugins: false})
}

describe('subscription migration help discovery', () => {
  test.each([['app'], ['app', 'subscription-migrations']])('text help lists migrations for %j', async (...argv) => {
    const config = await loadConfig()
    const help = new ShopifyHelp(config, {stripAnsi: true})
    const log = vi.spyOn(help, 'log').mockImplementation(() => {})

    await help.showHelp(argv)

    const output = log.mock.calls.flat().join('\n')
    if (argv.length === 1) {
      expect(output).toContain('app subscription-migrations')
    } else {
      for (const name of commandNames) expect(output).toContain(`app subscription-migrations ${name}`)
    }
  })

  test('recursive text root help lists every migration command', async () => {
    const help = new ShopifyHelp(await loadConfig(), {all: true, stripAnsi: true})
    const log = vi.spyOn(help, 'log').mockImplementation(() => {})

    await help.showHelp([])

    const output = log.mock.calls.flat().join('\n')
    for (const name of commandNames) expect(output).toContain(`app subscription-migrations ${name}`)
  })

  test('JSON app help lists the migration topic', async () => {
    const result = await helpService(await loadConfig(), ['app'])

    expect(result.topics).toEqual(expect.arrayContaining([expect.objectContaining({name: topic})]))
  })

  test('JSON topic help lists every migration command', async () => {
    const result = await helpService(await loadConfig(), ['app', 'subscription-migrations'])

    expect(result.commands.map((command) => command.id)).toEqual(commandNames.map((name) => `${topic}:${name}`))
  })

  test('recursive JSON root help lists every migration command as visible', async () => {
    const result = await helpService(await loadConfig(), [], true)

    for (const name of commandNames) {
      expect(result.commands).toContainEqual(expect.objectContaining({id: `${topic}:${name}`, hidden: false}))
    }
  })
})
