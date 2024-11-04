import {getModulesToMigrate, migrateAppModules} from './migrate-app-module.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    localIdentifier: 'my-action',
    configuration: {
      name: 'my-action',
    },
    ...attributes,
  } as unknown as LocalSource
}

function getRemoteExtension(attributes: Partial<RemoteSource> = {}) {
  return {
    uuid: '1234',
    title: 'a-different-extension',
    ...attributes,
  } as unknown as RemoteSource
}
const defaultMap = {
  payments_extension: [
    'payments_app',
    'payments_app_credit_card',
    'payments_app_custom_credit_card',
    'payments_app_custom_onsite',
    'payments_app_redeemable',
  ],
  marketing_activity: ['marketing_activity_extension'],
}

const defaultIdentifiers = {
  'module-A': '1234',
  'module-B': '',
}

describe('getModulesToMigrate()', () => {
  test('returns an empty array if no extensions are provided', () => {
    const toMigrate = getModulesToMigrate([], [], {}, defaultMap)
    expect(toMigrate).toStrictEqual([])
  })

  test('matching by remote title and localIdentifier, without defaultIdentifiers', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'module-A'})
    const localExtensionB = getLocalExtension({type: 'marketing_activity', localIdentifier: 'module-B'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'module-A', uuid: 'yy'})
    const remoteExtensionB = getRemoteExtension({type: 'marketing_activity_extension', title: 'module-B', uuid: 'xx'})

    // When
    const toMigrate = getModulesToMigrate(
      [localExtension, localExtensionB],
      [remoteExtension, remoteExtensionB],
      {},
      defaultMap,
    )

    // Then
    expect(toMigrate).toStrictEqual([
      {local: localExtension, remote: remoteExtension},
      {local: localExtensionB, remote: remoteExtensionB},
    ])
  })

  test('matching by truncated remote title and localIdentifier, without defaultIdentifiers', () => {
    // Given
    const localExtension = getLocalExtension({
      type: 'payments_extension',
      localIdentifier: 'ten-chars-ten-chars-ten-chars-ten-chars-ten-123456',
    })
    const remoteExtension = getRemoteExtension({
      type: 'payments_app_credit_card',
      title: 'Ten Chars Ten Chars Ten Chars Ten Chars Ten 123456789',
    })

    // When
    const toMigrate = getModulesToMigrate([localExtension], [remoteExtension], {}, defaultMap)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching different title and localIdentifier, using uuid', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'module-A'})
    const remoteExtension = getRemoteExtension({
      type: 'payments_app_credit_card',
      title: 'random-title',
      uuid: defaultIdentifiers['module-A'],
    })

    // When
    const toMigrate = getModulesToMigrate([localExtension], [remoteExtension], defaultIdentifiers, defaultMap)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('does not return modules where local.type is not included in defaultMap', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card'})

    // When
    const toMigrate = getModulesToMigrate([localExtension], [remoteExtension], defaultIdentifiers, defaultMap)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return modules where remote.type is not included in defaultMap', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension'})
    const remoteExtension = getRemoteExtension({type: 'marketing_activity_extension'})

    // When
    const toMigrate = getModulesToMigrate([localExtension], [remoteExtension], defaultIdentifiers, defaultMap)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('if neither title/name or ids match, does not return any extensions', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'module-A'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'doesnt-match', uuid: '0000'})

    // When
    const toMigrate = getModulesToMigrate([localExtension], [remoteExtension], defaultIdentifiers, defaultMap)

    // Then
    expect(toMigrate).toStrictEqual([])
  })
})

describe('migrateAppModules()', () => {
  test('performs a graphQL mutation for each extension', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2'})},
    ]
    const appId = '123abc'
    const type = 'payments_extension'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)
    const developerPlatformClient = testDeveloperPlatformClient()

    // When
    await migrateAppModules(extensionsToMigrate, appId, type, remoteExtensions, developerPlatformClient)

    // Then
    expect(developerPlatformClient.migrateAppModule).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(developerPlatformClient.migrateAppModule).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
      type,
    })
    expect(developerPlatformClient.migrateAppModule).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[1]!.remote.id,
      type,
    })
  })

  test('Returns updated remoteExensions', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2'})},
    ]
    const appId = '123abc'
    const type = 'payments_extension'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)

    // When
    const result = await migrateAppModules(
      extensionsToMigrate,
      appId,
      type,
      remoteExtensions,
      testDeveloperPlatformClient(),
    )

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'PAYMENTS_EXTENSION'})))
  })
})
