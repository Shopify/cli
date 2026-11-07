import AutocorrectStatus from './status.js'
import AutocorrectOn from './on.js'
import AutocorrectOff from './off.js'
import {isAutocorrectEnabled, setAutocorrect} from '../../../services/conf.js'
import {autocorrectJsonOutputSchema} from '../../../services/autocorrect/types.js'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, afterEach, expect, test, vi} from 'vitest'

vi.mock('../../../services/conf.js')

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const commands = [
  {name: 'status', command: AutocorrectStatus, enabled: false},
  {name: 'on', command: AutocorrectOn, enabled: true},
  {name: 'off', command: AutocorrectOff, enabled: false},
]

test.each(commands)('$name exposes the result schema and JSON flags in help', ({command}) => {
  expect(command.jsonOutputSchema).toBe(autocorrectJsonOutputSchema)
  expect(command.flags.json.char).toBe('j')
  expect(command.description).toContain('Output from `--json` conforms to the `AutocorrectResult` schema.')
  expect(command.description).toContain('"enabled"')
})

test.each(commands)('$name writes one JSON document through the launcher', async ({name, command, enabled}) => {
  vi.mocked(isAutocorrectEnabled).mockReturnValue(enabled)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
      argv: ['config', 'autocorrect', name, '--json'],
      lazyCommandLoader: async () => command,
    })

    expect(stdout()).toBe(`${JSON.stringify({enabled}, null, 2)}\n`)
    expect(stderr()).toBe('')
    if (name === 'status') {
      expect(setAutocorrect).not.toHaveBeenCalled()
    } else {
      expect(setAutocorrect).toHaveBeenCalledExactlyOnceWith(enabled)
    }
  })
})

test.each(commands)('$name discovers its schema without accessing configuration', async ({name, command}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
      argv: ['config', 'autocorrect', name, '--json-schema'],
      lazyCommandLoader: async () => command,
    })

    expect(JSON.parse(stdout()).definitions.Result).toMatchObject({
      type: 'object',
      properties: {enabled: {type: 'boolean'}},
      required: ['enabled'],
      additionalProperties: false,
    })
    expect(stderr()).toBe('')
    expect(setAutocorrect).not.toHaveBeenCalled()
    expect(isAutocorrectEnabled).not.toHaveBeenCalled()
  })
})

test.each([
  {args: ['-j'], json: true},
  {args: ['--json', '--no-input'], json: true},
  {args: ['--no-input'], json: false},
])('selects JSON independently from input policy for $args', async ({args, json}) => {
  vi.mocked(isAutocorrectEnabled).mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutocorrectStatus.run(args, import.meta.url)

    if (json) {
      expect(JSON.parse(stdout())).toEqual({enabled: true})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Autocorrect on.')
    }
  })
})

test('selects JSON from SHOPIFY_FLAG_JSON', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.mocked(isAutocorrectEnabled).mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutocorrectStatus.run([], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({enabled: true})
    expect(stderr()).toBe('')
  })
})

test.each(commands)(
  '$name emits a fatal error without a success result when configuration fails',
  async ({command, name}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    const error = new AbortError('Cannot access autocorrect preference.')
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    const operation = name === 'status' ? isAutocorrectEnabled : setAutocorrect
    vi.mocked(operation).mockImplementation(() => {
      throw error
    })

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await command.run(['--json'], import.meta.url)

      expect(JSON.parse(stdout())).toEqual({
        error: {type: 'abort', message: 'Cannot access autocorrect preference.'},
      })
      expect(stderr()).toBe('')
      expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    })
  },
)
