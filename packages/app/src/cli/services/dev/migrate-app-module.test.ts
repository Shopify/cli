import {getModulesToMigrate, migrateAppModules} from './migrate-app-module.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {ClientName} from '../../utilities/developer-platform-client.js'
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
  subscription_link_extension: ['subscription_link'],
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
    const localExtensionC = getLocalExtension({type: 'subscription_link_extension', localIdentifier: 'module-C'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'module-A', uuid: 'yy'})
    const remoteExtensionB = getRemoteExtension({type: 'marketing_activity_extension', title: 'module-B', uuid: 'xx'})
    const remoteExtensionC = getRemoteExtension({type: 'subscription_link', title: 'module-C', uuid: 'zz'})

    // When
    const toMigrate = getModulesToMigrate(
      [localExtension, localExtensionB, localExtensionC],
      [remoteExtension, remoteExtensionB, remoteExtensionC],
      {},
      defaultMap,
    )

    // Then
    expect(toMigrate).toStrictEqual([
      {local: localExtension, remote: remoteExtension},
      {local: localExtensionB, remote: remoteExtensionB},
      {local: localExtensionC, remote: remoteExtensionC},
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
  test('uses registrationUuid for AppManagement client', async () => {
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1', uuid: 'uuid1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2', uuid: 'uuid2'})},
    ]
    const appId = '123abc'
    const type = 'payments_extension'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)
    const appManagementClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    const migrationClient = testDeveloperPlatformClient()

    await migrateAppModules({
      extensionsToMigrate,
      appId,
      type,
      remoteExtensions,
      migrationClient,
    })

    expect(migrationClient.migrateAppModule).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(migrationClient.migrateAppModule).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: undefined,
      registrationUuid: extensionsToMigrate[0]!.remote.uuid,
      type,
    })
    expect(migrationClient.migrateAppModule).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: undefined,
      registrationUuid: extensionsToMigrate[1]!.remote.uuid,
      type,
    })
  })

  test('Returns updated remoteExensions', async () => {
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension()},
      {local: getLocalExtension(), remote: getRemoteExtension()},
    ]
    const appId = '123abc'
    const type = 'payments_extension'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)

    const result = await migrateAppModules({
      extensionsToMigrate,
      appId,
      type,
      remoteExtensions,
      migrationClient: testDeveloperPlatformClient(),
    })

    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'PAYMENTS_EXTENSION'})))
  })
})
