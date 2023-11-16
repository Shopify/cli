import {getFlowExtensionsToMigrate, migrateFlowExtensions} from './migrate-flow-extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {MigrateFlowExtensionMutation} from '../../api/graphql/extension_migrate_flow_extension.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')

function getLocalExtension(attributes: Partial<LocalSource> = {}) {
  return {
    type: 'flow_action',
    localIdentifier: 'my-action',
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

describe('getExtensionsToMigrate()', () => {
  const defaultIds = {
    'my-action': '1234',
    'my-trigger': '5678',
  }

  test('matching my remote title and localIdentifier', () => {
    // Given
    const localExtension = getLocalExtension({type: 'flow_action', localIdentifier: 'my-action'})
    const localExtensionB = getLocalExtension({type: 'flow_trigger', localIdentifier: 'my-trigger'})
    const remoteExtension = getRemoteExtension({type: 'flow_action_definition', title: 'my-action', uuid: 'yy'})
    const remoteExtensionB = getRemoteExtension({type: 'flow_trigger_definition', title: 'my-trigger', uuid: 'xx'})

    // When
    const toMigrate = getFlowExtensionsToMigrate(
      [localExtension, localExtensionB],
      [remoteExtension, remoteExtensionB],
      defaultIds,
    )

    // Then
    expect(toMigrate).toStrictEqual([
      {local: localExtension, remote: remoteExtension},
      {local: localExtensionB, remote: remoteExtensionB},
    ])
  })

  test('matching my local and remote IDs', () => {
    // Given
    const localExtension = getLocalExtension({type: 'flow_action', localIdentifier: 'my-action'})
    const localExtensionB = getLocalExtension({type: 'flow_trigger', localIdentifier: 'my-trigger'})
    const remoteExtension = getRemoteExtension({type: 'flow_action_definition', title: 'remote', uuid: '1234'})
    const remoteExtensionB = getRemoteExtension({type: 'flow_trigger_definition', title: 'remote', uuid: '5678'})

    // When
    const toMigrate = getFlowExtensionsToMigrate(
      [localExtension, localExtensionB],
      [remoteExtension, remoteExtensionB],
      defaultIds,
    )

    // Then
    expect(toMigrate).toStrictEqual([
      {local: localExtension, remote: remoteExtension},
      {local: localExtensionB, remote: remoteExtensionB},
    ])
  })

  test('does not return extensions where local.type is not flow_action or flow_trigger', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'flow_action_definition'})

    // When
    const toMigrate = getFlowExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return extensions where remote.type is not flow_action_definition', () => {
    // Given
    const localExtension = getLocalExtension({type: 'flow_action'})
    const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})

    // When
    const toMigrate = getFlowExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

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
    const toMigrate = getFlowExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })
})

describe('migrateExtensions()', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('mockToken')
    vi.mocked(partnersRequest).mockResolvedValue({
      migrateFlowExtension: {userErrors: null, migratedFlowExtension: true},
    })
  })

  test('performs a graphQL mutation for each extension', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id1'})},
      {local: getLocalExtension(), remote: getRemoteExtension({id: 'id2'})},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => remote)

    // When
    await migrateFlowExtensions(extensionsToMigrate, appId, remoteExtensions)

    // Then
    expect(partnersRequest).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(partnersRequest).toHaveBeenCalledWith(MigrateFlowExtensionMutation, 'mockToken', {
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
    })
    expect(partnersRequest).toHaveBeenCalledWith(MigrateFlowExtensionMutation, 'mockToken', {
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
    const result = await migrateFlowExtensions(extensionsToMigrate, appId, remoteExtensions)

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'FLOW_ACTION'})))
  })
})
