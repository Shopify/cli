import {helpService} from './index.js'
import {describe, expect, test, vi} from 'vitest'
import type {Command, Interfaces} from '@oclif/core'

function fixtureConfig() {
  const command: Command.Loadable = {
    id: 'app:example',
    description: 'Example command.\nMore details.',
    hidden: false,
    hiddenAliases: ['app:legacy'],
    enableJsonFlag: false,
    hasDynamicHelp: false,
    pluginName: '@shopify/example',
    pluginType: 'core',
    aliases: ['app:alias'],
    args: {name: {name: 'name', description: 'App name.', required: true}},
    flags: {
      format: {
        name: 'format',
        type: 'option',
        description: 'Output format.',
        env: 'SHOPIFY_FLAG_FORMAT',
        options: ['short', 'long'],
        default: 'short',
      },
      secret: {name: 'secret', type: 'boolean', hidden: true, allowNo: false},
    },
    load: vi.fn(),
  }
  const commands = [command, {...command, id: 'version'}, {...command, id: 'hidden', hidden: true}]
  const topics = [{name: 'app', description: 'Build apps.'}, {name: 'app:example'}]
  const config = {
    commands,
    topics,
    topicSeparator: ' ',
    commandIDs: commands.flatMap((item) => [item.id, ...item.aliases]),
    pjson: {oclif: {}},
    findCommand: (id: string) => commands.find((item) => item.id === id || item.aliases.includes(id)),
    findTopic: (name: string) => topics.find((topic) => topic.name === name),
  } as unknown as Interfaces.Config
  return {config, command}
}

describe('helpService', () => {
  test('returns sorted, visible root commands and topics without loading commands', async () => {
    const {config, command} = fixtureConfig()

    await expect(helpService(config, [])).resolves.toEqual({
      kind: 'root',
      commands: [{id: 'version', summary: 'Example command.', hidden: false}],
      topics: [{name: 'app', description: 'Build apps.', hidden: false}],
    })
    expect(command.load).not.toHaveBeenCalled()
  })

  test('includes nested and hidden commands when requested', async () => {
    const {config} = fixtureConfig()

    const result = await helpService(config, [], true)

    expect(result.commands.map((command) => command.id)).toEqual(['app:example', 'hidden', 'version'])
  })

  test('returns a topic and its immediate child commands', async () => {
    const {config} = fixtureConfig()

    const result = await helpService(config, ['app'])

    expect(result).toMatchObject({
      kind: 'topic',
      topic: {name: 'app', description: 'Build apps.'},
      commands: [{id: 'app:example'}],
      topics: [],
    })
  })

  test.each([['app', 'example'], ['app:example'], ['app', 'alias']])('resolves %j using oclif', async (...argv) => {
    const {config, command} = fixtureConfig()

    const result = await helpService(config, argv)

    expect(result.kind).toBe('command')
    if (result.kind !== 'command') throw new Error('Expected command help')
    expect(result.command).toEqual({
      id: 'app:example',
      description: 'Example command.\nMore details.',
      hidden: false,
      aliases: ['app:alias'],
      strict: true,
      args: {name: {name: 'name', description: 'App name.', required: true, hidden: false}},
      flags: {
        format: {
          name: 'format',
          type: 'option',
          description: 'Output format.',
          env: 'SHOPIFY_FLAG_FORMAT',
          options: ['short', 'long'],
          default: 'short',
          required: false,
          hidden: false,
        },
      },
    })
    expect(command.load).not.toHaveBeenCalled()
  })

  test('includes hidden flags when requested', async () => {
    const {config} = fixtureConfig()

    const result = await helpService(config, ['app:example'], true)

    expect(result).toMatchObject({kind: 'command', command: {flags: {secret: {hidden: true, type: 'boolean'}}}})
  })

  test('preserves unknown-command errors', async () => {
    const {config} = fixtureConfig()

    await expect(helpService(config, ['missing'])).rejects.toThrow('Command missing not found.')
  })
})
