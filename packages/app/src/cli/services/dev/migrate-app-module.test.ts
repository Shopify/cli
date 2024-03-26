import {getPaymentsExtensionsToMigrate, migrateAppModules} from './migrate-app-module.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    type: 'payments_extension',
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
    type: 'payments_app_credit_card',
    title: 'a-different-extension',
    ...attributes,
  } as unknown as RemoteSource
}

describe('getPaymentsExtensionsToMigrate()', () => {
  const defaultIds = {
    'my-action': '1234',
  }

  test('matching my remote title and localIdentifier', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'my-action'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'my-action', uuid: 'yy'})

    // When
    const toMigrate = getPaymentsExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching my local and remote IDs', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'my-action'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'remote', uuid: '1234'})

    // When
    const toMigrate = getPaymentsExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('does not return extensions where local.type is not payments_extension', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card'})

    // When
    const toMigrate = getPaymentsExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return extensions where remote.type is not payments_app_credit_card', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension'})
    const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})

    // When
    const toMigrate = getPaymentsExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('if neither title/name or ids match, does not return any extensions', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension'})
    const remoteExtension = getRemoteExtension({
      type: 'payments_app_credit_card',
      uuid: '5678',
    })

    // When
    const toMigrate = getPaymentsExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

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
