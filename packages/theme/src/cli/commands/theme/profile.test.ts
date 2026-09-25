import Profile from './profile.js'
import {themeProfileJsonOutputSchema, type ThemeProfileResult} from '../../services/profile/types.js'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

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
  expect(Profile.jsonOutputSchema).toBe(themeProfileJsonOutputSchema)
  expect(Profile.flags.json).toBeDefined()
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

test.each(['profile', 'empty', 'failure', 'invalid result'])(
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
    const result = mode === 'empty' ? {...profile, profiles: [], shared: {frames: []}} : profile
    // Keep unusual whitespace and upstream field order to catch accidental reserialization.
    const source = mode === 'invalid result' ? '{"profiles":false}' : ` ${JSON.stringify(result, null, 4)}\n`
    vi.mocked(render).mockResolvedValue(new Response(source, {status: 200}))
    if (mode === 'failure') vi.mocked(render).mockRejectedValue(new Error('Network error'))
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
      expect(events.map((event) => event.status)).toEqual(failed ? ['started'] : ['started', 'completed'])
      expect(events.every((event) => event.type === 'progress')).toBe(true)
    })
  },
)
