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
  test('uses registrationUuid for AppManagement client', async () => {
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1', uuid: 'uuid1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2', uuid: 'uuid2'})},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)
    const migrationClient = testDeveloperPlatformClient()

    await migrateFlowExtensions({
      extensionsToMigrate,
      appId,
      remoteExtensions,
      migrationClient,
    })

    expect(migrationClient.migrateFlowExtension).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(migrationClient.migrateFlowExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: undefined,
      registrationUuid: extensionsToMigrate[0]!.remote.uuid,
    })
    expect(migrationClient.migrateFlowExtension).toHaveBeenCalledWith({
      apiKey: appId,
      registrationId: undefined,
      registrationUuid: extensionsToMigrate[1]!.remote.uuid,
    })
  })

  test('Returns updated remoteExensions', async () => {
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension()},
      {local: getLocalExtension(), remote: getRemoteExtension()},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)

    const result = await migrateFlowExtensions({
      extensionsToMigrate,
      appId,
      remoteExtensions,
      migrationClient: testDeveloperPlatformClient(),
    })

    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'FLOW_ACTION'})))
  })
})
