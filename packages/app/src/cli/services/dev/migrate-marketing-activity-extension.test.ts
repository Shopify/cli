import {
  getMarketingActivtyExtensionsToMigrate,
  migrateMarketingActivityExtensions,
} from './migrate-marketing-activity-extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    type: 'marketing_activity_extension_cli',
    localIdentifier: 'test-marketing',
    configuration: {
      name: 'test-marketing',
    },
    ...attributes,
  } as unknown as LocalSource
}

function getRemoteExtension(attributes: Partial<RemoteSource> = {}) {
  return {
    uuid: '1234',
    type: 'marketing_activity_extension',
    title: 'test-marketing-2',
    ...attributes,
  } as unknown as RemoteSource
}

describe('getExtensionsToMigrate()', () => {
  const defaultIds = {
    'test-marketing': '1234',
  }

  test('matching my remote title and localIdentifier', () => {
    // Given
    const title = 'test123'
    const localExtension = getLocalExtension({
      type: 'marketing_activity_extension_cli',
      localIdentifier: title,
    })
    const remoteExtension = getRemoteExtension({
      type: 'marketing_activity_extension',
      title,
      uuid: 'yy',
    })

    // When
    const toMigrate = getMarketingActivtyExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching my local and remote IDs', () => {
    // Given
    const localExtension = getLocalExtension({
      type: 'marketing_activity_extension_cli',
      localIdentifier: 'test-marketing',
    })
    const remoteExtension = getRemoteExtension({type: 'marketing_activity_extension', title: 'remote', uuid: '1234'})

    // When
    const toMigrate = getMarketingActivtyExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('does not return extensions where local.type is not marketing_activity_extension_cli', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'flow_action_definition'})

    // When
    const toMigrate = getMarketingActivtyExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return extensions where remote.type is not marketing_activity_extension', () => {
    // Given
    const localExtension = getLocalExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})
    const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})

    // When
    const toMigrate = getMarketingActivtyExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('if neither title/name or ids match, does not return any extensions', () => {
    // Given
    const localExtension = getLocalExtension({type: 'flow_action'})
    const remoteExtension = getRemoteExtension({
      type: 'flow_action_definition',
      uuid: '5678',
    })

    // When
    const toMigrate = getMarketingActivtyExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })
})

describe('migrateExtensions()', () => {
  test('performs a graphQL mutation for each extension', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2'})},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)
    const developerPlatformClient = testDeveloperPlatformClient()

    // When
    await migrateMarketingActivityExtensions(extensionsToMigrate, appId, remoteExtensions, developerPlatformClient)

    // Then
    expect(developerPlatformClient.migrateMarketingActivityExtension).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(developerPlatformClient.migrateMarketingActivityExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
    })
    expect(developerPlatformClient.migrateMarketingActivityExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[1]!.remote.id,
    })
  })

  test('Returns updated remoteExensions', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2'})},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)

    // When
    const result = await migrateMarketingActivityExtensions(
      extensionsToMigrate,
      appId,
      remoteExtensions,
      testDeveloperPlatformClient(),
    )

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'MARKETING_ACTIVITY'})))
  })
})
