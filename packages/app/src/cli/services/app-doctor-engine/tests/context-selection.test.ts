import {selectAppDoctorApp, selectAppDoctorConfiguration} from '../context/selection.js'
import {AppDoctorContextError} from '../context/types.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorConfiguration, AppDoctorDiscovery, AppDoctorSelectionOptions} from '../context/types.js'

const APP = '/repo/app'

const configuration = (
  fileName: string,
  overrides: Partial<Omit<AppDoctorConfiguration, 'fileName' | 'path'>> = {},
): AppDoctorConfiguration => ({
  path: `${APP}/${fileName}`,
  fileName,
  state: 'parsed',
  ...overrides,
})

const DEFAULT = configuration('shopify.app.toml', {clientId: 'default-id'})
const STAGING = configuration('shopify.app.staging.toml', {clientId: 'staging-id'})
const PRODUCTION = configuration('shopify.app.production.toml', {clientId: 'shared-id'})
const ALPHA = configuration('shopify.app.alpha.toml', {clientId: 'shared-id'})
const MALFORMED = configuration('shopify.app.broken.toml', {state: 'malformed'})
const UNLINKED = configuration('shopify.app.unlinked.toml')

const select = (configurations: AppDoctorConfiguration[], options: Partial<AppDoctorSelectionOptions> = {}) =>
  selectAppDoctorConfiguration(configurations, {interactive: false, ...options})

const expectError = (run: () => unknown, code: AppDoctorContextError['code']) => {
  expect(run).toThrowError(AppDoctorContextError)
  expect(run).toThrowError(expect.objectContaining({code}))
}

describe('selectAppDoctorApp', () => {
  const discovery = (directories: string[]): AppDoctorDiscovery => ({
    apps: directories.map((directory) => ({directory, configurationPaths: [`${directory}/shopify.app.toml`]})),
  })

  test('returns the only app without a choice', () => {
    expect(selectAppDoctorApp(discovery([APP])).directory).toBe(APP)
  })

  test('requires a choice when several apps were discovered', () => {
    expectError(() => selectAppDoctorApp(discovery(['/repo/a', '/repo/b'])), 'APP_SELECTION_REQUIRED')
    expect(() => selectAppDoctorApp(discovery(['/repo/a', '/repo/b']))).toThrowError(/\/repo\/a[\s\S]*\/repo\/b/)
  })

  test('honours a choice that names a discovered app', () => {
    expect(selectAppDoctorApp(discovery(['/repo/a', '/repo/b']), '/repo/b').directory).toBe('/repo/b')
  })

  test('rejects a choice outside the discovery', () => {
    expectError(() => selectAppDoctorApp(discovery(['/repo/a', '/repo/b']), '/repo/c'), 'INVALID_APP_SELECTION')
  })

  test('rejects an empty discovery', () => {
    expectError(() => selectAppDoctorApp({apps: []}), 'APP_NOT_FOUND')
  })
})

describe('selectAppDoctorConfiguration selectors', () => {
  test('rejects config name and client ID together', () => {
    expectError(() => select([DEFAULT], {configName: 'staging', clientId: 'default-id'}), 'SELECTOR_CONFLICT')
  })

  test('rejects blank selectors', () => {
    expectError(() => select([DEFAULT], {configName: '  '}), 'INVALID_SELECTOR')
    expectError(() => select([DEFAULT], {clientId: ''}), 'INVALID_SELECTOR')
  })

  test('resolves a shorthand or full config name', () => {
    expect(select([DEFAULT, STAGING], {configName: 'staging'})).toEqual({
      type: 'selected',
      selection: {configuration: STAGING, source: 'config'},
    })
    expect(select([DEFAULT, STAGING], {configName: 'shopify.app.staging.toml'})).toMatchObject({
      selection: {configuration: STAGING},
    })
  })

  test('errors on an unknown config name without falling back', () => {
    expectError(() => select([DEFAULT, STAGING], {configName: 'missing'}), 'CONFIGURATION_NOT_FOUND')
  })

  test('selects the parsed file whose client ID matches exactly', () => {
    expect(select([DEFAULT, STAGING], {clientId: 'staging-id'})).toEqual({
      type: 'selected',
      selection: {configuration: STAGING, source: 'client-id'},
    })
  })

  test('breaks client ID ties by lexicographically first file name', () => {
    expect(select([PRODUCTION, DEFAULT, ALPHA], {clientId: 'shared-id'})).toMatchObject({
      selection: {configuration: ALPHA},
    })
  })

  test('never matches client IDs loosely or from malformed files', () => {
    expectError(() => select([DEFAULT, MALFORMED], {clientId: 'DEFAULT-ID'}), 'CLIENT_ID_NOT_FOUND')
    expectError(() => select([DEFAULT, MALFORMED], {clientId: ' default-id'}), 'CLIENT_ID_NOT_FOUND')
    expectError(() => select([MALFORMED], {clientId: 'anything'}), 'CLIENT_ID_NOT_FOUND')
  })
})

describe('selectAppDoctorConfiguration with an explicit file', () => {
  test('selects exactly that file even when a sibling is cached or default', () => {
    expect(
      select([DEFAULT, STAGING, UNLINKED], {
        explicitConfigurationPath: UNLINKED.path,
        cachedConfigName: STAGING.fileName,
      }),
    ).toEqual({type: 'selected', selection: {configuration: UNLINKED, source: 'file'}})
  })

  test('allows malformed files to be selected explicitly', () => {
    expect(select([DEFAULT, MALFORMED], {explicitConfigurationPath: MALFORMED.path})).toMatchObject({
      selection: {configuration: MALFORMED, source: 'file'},
    })
  })

  test('accepts a config name that resolves to the same file and rejects any other', () => {
    expect(select([DEFAULT, STAGING], {explicitConfigurationPath: STAGING.path, configName: 'staging'})).toMatchObject({
      selection: {configuration: STAGING, source: 'file'},
    })
    expectError(
      () => select([DEFAULT, STAGING], {explicitConfigurationPath: STAGING.path, configName: 'production'}),
      'SELECTOR_CONFLICT',
    )
  })

  test('accepts a client ID that matches the explicit file and rejects any other', () => {
    expect(select([DEFAULT, STAGING], {explicitConfigurationPath: STAGING.path, clientId: 'staging-id'})).toMatchObject(
      {selection: {configuration: STAGING, source: 'file'}},
    )
    expectError(
      () => select([DEFAULT, STAGING], {explicitConfigurationPath: STAGING.path, clientId: 'default-id'}),
      'SELECTOR_CONFLICT',
    )
    expectError(
      () => select([DEFAULT, MALFORMED], {explicitConfigurationPath: MALFORMED.path, clientId: 'default-id'}),
      'SELECTOR_CONFLICT',
    )
  })

  test('rejects an explicit file that is not one of the inspected configurations', () => {
    expectError(
      () => select([DEFAULT], {explicitConfigurationPath: `${APP}/shopify.app.other.toml`}),
      'INVALID_CONFIGURATION_SELECTION',
    )
  })
})

describe('selectAppDoctorConfiguration cache and default', () => {
  test('prefers a cached configuration that still exists', () => {
    expect(select([DEFAULT, STAGING], {cachedConfigName: STAGING.fileName})).toEqual({
      type: 'selected',
      selection: {configuration: STAGING, source: 'cached'},
    })
  })

  test('falls back to shopify.app.toml without a selector or cache', () => {
    expect(select([STAGING, DEFAULT])).toEqual({
      type: 'selected',
      selection: {configuration: DEFAULT, source: 'default'},
    })
  })

  test('does not fall back to a lone named configuration when the default is missing', () => {
    expectError(() => select([STAGING]), 'CONFIGURATION_NOT_FOUND')
  })

  test('ignores a stale cache when an explicit selector is present', () => {
    expect(
      select([DEFAULT, STAGING], {cachedConfigName: 'shopify.app.gone.toml', configName: 'staging'}),
    ).toMatchObject({selection: {configuration: STAGING, source: 'config'}})
    expect(
      select([DEFAULT, STAGING], {cachedConfigName: 'shopify.app.gone.toml', clientId: 'default-id'}),
    ).toMatchObject({selection: {configuration: DEFAULT, source: 'client-id'}})
    expect(
      select([DEFAULT, STAGING], {cachedConfigName: 'shopify.app.gone.toml', explicitConfigurationPath: STAGING.path}),
    ).toMatchObject({selection: {configuration: STAGING, source: 'file'}})
  })

  test('interactive stale cache with one remaining configuration selects it silently', () => {
    expect(select([STAGING], {cachedConfigName: 'shopify.app.gone.toml', interactive: true})).toEqual({
      type: 'selected',
      selection: {configuration: STAGING, source: 'stale-cache-replacement'},
    })
  })

  test('interactive stale cache with several configurations requires a choice', () => {
    expect(select([DEFAULT, STAGING], {cachedConfigName: 'shopify.app.gone.toml', interactive: true})).toEqual({
      type: 'selection-required',
      reason: 'stale-cache',
      configurations: [DEFAULT, STAGING],
    })
  })

  test('non-interactive stale cache uses the default or errors when it is absent', () => {
    expect(select([DEFAULT, STAGING], {cachedConfigName: 'shopify.app.gone.toml'})).toMatchObject({
      selection: {configuration: DEFAULT, source: 'default'},
    })
    expectError(() => select([STAGING], {cachedConfigName: 'shopify.app.gone.toml'}), 'CONFIGURATION_NOT_FOUND')
  })
})
