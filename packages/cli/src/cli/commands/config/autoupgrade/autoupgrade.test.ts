import AutoupgradeOn from './on.js'
import AutoupgradeOff from './off.js'
import AutoupgradeStatus from './status.js'
import {autoUpgradeJsonOutputSchema} from '../../../services/commands/config/autoupgrade/types.js'
import {getAutoUpgradeEnabled, setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

const commands = [
  {name: 'status', command: AutoupgradeStatus, enabled: false},
  {name: 'on', command: AutoupgradeOn, enabled: true},
  {name: 'off', command: AutoupgradeOff, enabled: false},
]

test.each(commands)('$name exposes the result schema and JSON flags in help', ({command}) => {
  expect(command.jsonOutputSchema).toBe(autoUpgradeJsonOutputSchema)
  expect(command.flags.json.char).toBe('j')
  expect(command.description).toContain('Output from `--json` conforms to the `AutoUpgradeResult` schema.')
  expect(command.description).toContain('"enabled"')
})

test.each(commands)('$name writes one JSON document through the real launcher', async ({name, command, enabled}) => {
  vi.mocked(getAutoUpgradeEnabled).mockReturnValue(enabled)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['config', 'autoupgrade', name, '--json'],
      lazyCommandLoader: async () => command,
    })

    expect(stdout()).toBe(`${JSON.stringify({enabled}, null, 2)}\n`)
    expect(JSON.parse(stdout())).toEqual({enabled})
    expect(stderr()).toBe('')
    if (name === 'status') {
      expect(setAutoUpgradeEnabled).not.toHaveBeenCalled()
    } else {
      expect(setAutoUpgradeEnabled).toHaveBeenCalledExactlyOnceWith(enabled)
    }
  })
})

test.each(commands)('$name discovers the schema without changing configuration', async ({name, command}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['config', 'autoupgrade', name, '--json-schema'],
      lazyCommandLoader: async () => command,
    })

    expect(JSON.parse(stdout()).definitions.Result).toMatchObject({
      type: 'object',
      properties: {enabled: {type: 'boolean'}},
      required: ['enabled'],
      additionalProperties: false,
    })
    expect(stderr()).toBe('')
    expect(setAutoUpgradeEnabled).not.toHaveBeenCalled()
    expect(getAutoUpgradeEnabled).not.toHaveBeenCalled()
  })
})

test.each([
  {args: ['-j'], json: true},
  {args: ['--json', '--no-input'], json: true},
  {args: ['--no-input'], json: false},
])('selects JSON independently from input policy for $args', async ({args, json}) => {
  vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutoupgradeStatus.run(args, import.meta.url)

    if (json) {
      expect(JSON.parse(stdout())).toEqual({enabled: true})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Auto-upgrade on.')
    }
  })
})

test('selects JSON from SHOPIFY_FLAG_JSON', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutoupgradeStatus.run([], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({enabled: true})
    expect(stderr()).toBe('')
  })
})

test('keeps diagnostic events on stderr and out of the final result', async () => {
  vi.mocked(getAutoUpgradeEnabled).mockImplementation(() => {
    outputWarn('Configuration diagnostic')
    return false
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutoupgradeStatus.run(['--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({enabled: false})
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'warning',
      message: 'Configuration diagnostic',
    })
  })
})

test.each(commands)('$name uses the standard fatal error output without a success result', async ({command, name}) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const error = new AbortError('Cannot access auto-upgrade preference.')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  const operation = name === 'status' ? getAutoUpgradeEnabled : setAutoUpgradeEnabled
  vi.mocked(operation).mockImplementation(() => {
    throw error
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await command.run(['--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({
      error: {type: 'abort', message: 'Cannot access auto-upgrade preference.'},
    })
    expect(stderr()).toBe('')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })
})
