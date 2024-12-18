import {migrateExtensionsToUIExtension} from './migrate-to-ui-extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    type: 'ui_extension',
    localIdentifier: 'my-extension',
    handle: 'my-extension',
    configuration: {
      name: 'my-extension',
    },
    ...attributes,
  } as unknown as LocalSource
}

function getRemoteExtension(attributes: Partial<RemoteSource> = {}) {
  return {
    uuid: '1234',
    type: 'CHECKOUT_UI_EXTENSION',
    title: 'a-different-extension',
    ...attributes,
  } as unknown as RemoteSource
}

describe('migrateExtensions()', () => {
  test('performs a graphQL mutation for each extension', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension()},
      {local: getLocalExtension(), remote: getRemoteExtension()},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => ({...remote, type: 'CHECKOUT_UI_EXTENSION'}))
    const developerPlatformClient = testDeveloperPlatformClient()

    // When
    await migrateExtensionsToUIExtension(extensionsToMigrate, appId, remoteExtensions, developerPlatformClient)

    // Then
    expect(developerPlatformClient.migrateToUiExtension).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(developerPlatformClient.migrateToUiExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
    })
    expect(developerPlatformClient.migrateToUiExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[1]!.remote.id,
    })
  })

  test('Returns updated remoteExensions', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension()},
      {local: getLocalExtension(), remote: getRemoteExtension()},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => ({...remote, type: 'CHECKOUT_UI_EXTENSION'}))

    // When
    const result = await migrateExtensionsToUIExtension(
      extensionsToMigrate,
      appId,
      remoteExtensions,
      testDeveloperPlatformClient(),
    )

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'UI_EXTENSION'})))
  })
})
