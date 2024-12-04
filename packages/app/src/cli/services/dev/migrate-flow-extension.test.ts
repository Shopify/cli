import {migrateFlowExtensions} from './migrate-flow-extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    type: 'flow_action',
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
    type: 'flow_action_definition',
    title: 'a-different-extension',
    ...attributes,
  } as unknown as RemoteSource
}

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
    await migrateFlowExtensions(extensionsToMigrate, appId, remoteExtensions, developerPlatformClient)

    // Then
    expect(developerPlatformClient.migrateFlowExtension).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(developerPlatformClient.migrateFlowExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
    })
    expect(developerPlatformClient.migrateFlowExtension).toHaveBeenCalledWith({
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
    const result = await migrateFlowExtensions(
      extensionsToMigrate,
      appId,
      remoteExtensions,
      testDeveloperPlatformClient(),
    )

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'FLOW_ACTION'})))
  })
})
