import Profile from './profile.js'
import {themeProfileJsonOutputSchema, type ThemeProfileResult} from '../../services/profile/types.js'
import * as themeStorage from '../../services/local-storage.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {render} from '../../utilities/theme-environment/storefront-renderer.js'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, rmdir, tempDirectory} from '@shopify/cli-kit/node/fs'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-environment/storefront-renderer.js')
vi.mock('../../utilities/theme-environment/dev-server-session.js')
vi.mock('../../utilities/theme-environment/storefront-session.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system')

const profile: ThemeProfileResult = {
  $schema: 'https://www.speedscope.app/file-format-schema.json',
  shared: {frames: [{name: 'layout', file: 'layout/theme.liquid', line: 1, col: 0, extension: false}]},
  profiles: [
    {
      type: 'evented',
      name: 'Liquid',
      unit: 'microseconds',
      startValue: 0,
      endValue: 10,
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 10, frame: 0},
      ],
    },
  ],
  extension: {value: null},
}

test('exposes Speedscope evented and sampled profiles while retaining extension fields', () => {
  expect(JSON.parse(themeProfileJsonOutputSchema.encode(profile))).toEqual(profile)
  const sampled: ThemeProfileResult = {
    ...profile,
    profiles: [
      {type: 'sampled', name: 'Liquid', unit: 'none', startValue: 0, endValue: 10, samples: [[0]], weights: [10]},
    ],
  }
  expect(JSON.parse(themeProfileJsonOutputSchema.encode(sampled))).toEqual(sampled)
  expect(() => themeProfileJsonOutputSchema.validate({...profile, shared: {frames: [{name: 123}]}})).toThrow()
  expect(() =>
    themeProfileJsonOutputSchema.validate({...profile, profiles: [{...profile.profiles[0], unit: 'invalid'}]}),
  ).toThrow()
})

test.each(['profile', 'empty', 'unknown location', 'fractional location', 'failure', 'invalid result'])(
  'keeps %s JSON on stdout and progress events on stderr',
  async (mode) => {
    const {default: StreamProfile} = await import('./profile.js')
    const {findOrSelectTheme} = await import('../../utilities/theme-selector.js')
    const {render} = await import('../../utilities/theme-environment/storefront-renderer.js')
    const {ensureAuthenticatedThemes} = await import('@shopify/cli-kit/node/session')
    const {openURL} = await import('@shopify/cli-kit/node/system')
    const {runWithCommandEventsForCommand} = await import('@shopify/cli-kit/node/command-events')
    const {Config} = await import('@oclif/core')
    const config = new Config({root: __dirname})
    await config.load()
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'shop.myshopify.com', token: 'token'})
    vi.mocked(findOrSelectTheme).mockResolvedValue({
      id: 1,
      name: 'Dawn',
      role: 'live',
      processing: false,
      createdAtRuntime: false,
    })
    let result = profile
    if (mode === 'empty') result = {...profile, profiles: [], shared: {frames: []}}
    if (mode === 'unknown location' || mode === 'fractional location') {
      const position = mode === 'unknown location' ? -1 : 0.5
      result = {...profile, shared: {frames: [{name: 'layout', line: position, col: position}]}}
    }
    // Keep unusual whitespace and upstream field order to catch accidental reserialization.
    const source = mode === 'invalid result' ? '{"profiles":false}' : ` ${JSON.stringify(result, null, 4)}\n`
    vi.mocked(render).mockResolvedValue(new Response(source, {status: 200}))
    if (mode === 'failure') vi.mocked(render).mockRejectedValue(new Error('Network error'))
    await inTemporaryDirectory(async (directory) => {
      const storage = new LocalStorage<themeStorage.ThemeLocalStorageSchema>({cwd: directory})
      const {getThemeStore, setThemeStore} = themeStorage
      const getStore = vi.spyOn(themeStorage, 'getThemeStore').mockImplementation(() => getThemeStore(storage))
      const setStore = vi
        .spyOn(themeStorage, 'setThemeStore')
        .mockImplementation((store) => setThemeStore(store, storage))
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const operation = runWithCommandEventsForCommand(['--json'], () =>
            new StreamProfile(['--store=shop.myshopify.com', '--json'], config).run(),
          )
          if (mode === 'failure') await expect(operation).rejects.toThrow('Network error')
          else if (mode === 'invalid result') await expect(operation).rejects.toThrow()
          else await operation
          expect(openURL).not.toHaveBeenCalled()
          const failed = mode === 'failure' || mode === 'invalid result'
          expect(stdout()).toBe(failed ? '' : `${source}\n`)
          if (!failed) expect(JSON.parse(stdout())).toEqual(result)
          const events = stderr()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
          expect(events.map((event) => event.status)).toEqual(failed ? ['started', 'failed'] : ['started', 'completed'])
          expect(events.every((event) => event.type === 'progress')).toBe(true)
        })
        expect(storage.get('themeStore')).toBe('shop.myshopify.com')
      } finally {
        getStore.mockRestore()
        setStore.mockRestore()
      }
    })
  },
)

test('wraps requested environment results while preserving the native profile payload', () => {
  const result = {environments: [{environment: 'development', result: profile}]}
  expect(JSON.parse(themeProfileJsonOutputSchema.encode(result))).toEqual(result)
  expect(() =>
    themeProfileJsonOutputSchema.validate({
      environments: [{environment: 'development', result: profile, unexpected: true}],
    }),
  ).toThrow()
})

const profileStore = 'shop.myshopify.com'
const profileSession = {storeFqdn: profileStore, token: 'token'}
const profileTask = `Generating Liquid profile for ${profileStore} /`

describeJsonCommand({
  command: Profile,
  commandId: 'theme:profile',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', profileStore],
  expectedResult: profile,
  expectedEvents: [
    {type: 'progress', status: 'started', message: profileTask},
    {type: 'progress', status: 'completed', message: profileTask, current: 1, total: 1},
  ],
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    // Keep the remembered theme store out of the user's configuration.
    const directory = tempDirectory()
    const storage = new LocalStorage<themeStorage.ThemeLocalStorageSchema>({cwd: directory})
    const {getThemeStore, setThemeStore} = themeStorage
    const getStore = vi.spyOn(themeStorage, 'getThemeStore').mockImplementation(() => getThemeStore(storage))
    const setStore = vi
      .spyOn(themeStorage, 'setThemeStore')
      .mockImplementation((store) => setThemeStore(store, storage))
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(profileSession)
    vi.mocked(findOrSelectTheme).mockResolvedValue({
      id: 1,
      name: 'Dawn',
      role: 'live',
      processing: false,
      createdAtRuntime: false,
    })
    vi.mocked(render).mockImplementation(async () => new Response(JSON.stringify(profile, null, 2), {status: 200}))
    return async () => {
      getStore.mockRestore()
      setStore.mockRestore()
      await rmdir(directory)
    }
  },
  assertExecuted: (format) => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(profileStore, undefined)
    expect(findOrSelectTheme).toHaveBeenCalledExactlyOnceWith(profileSession, {filter: {live: true}})
    expect(render).toHaveBeenCalledOnce()
    if (format === 'json') {
      expect(openURL).not.toHaveBeenCalled()
    } else {
      expect(openURL).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^file:\/\/.+\.html$/))
    }
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  },
  // Text mode opens the profile in the browser and renders task progress on stderr.
  textOutput: ({stdout}) => expect(stdout).toBe(''),
  failure: {
    setup: () => {
      vi.mocked(render).mockRejectedValue(new AbortError('Network error.'))
    },
    expectedError: {error: {type: 'abort', message: 'Network error.'}},
    expectedEvents: [
      {type: 'progress', status: 'started', message: profileTask},
      {type: 'progress', status: 'failed', message: profileTask},
    ],
    exitCode: 1,
  },
})
