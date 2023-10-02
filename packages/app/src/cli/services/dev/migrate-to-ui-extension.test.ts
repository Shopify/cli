import {getUIExtensionsToMigrate, migrateExtensionsToUIExtension} from './migrate-to-ui-extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {ExtensionMigrateToUiExtensionQuery} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')

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

describe('getExtensionsToMigrate()', () => {
  const defaultIds = {
    'my-extension': '1234',
  }

  describe('if local.id matches remote.id', () => {
    test('returns extensions where local.type is ui_extension but remote.type is CHECKOUT_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
    })

    test('returns extensions where local.type is ui_extension but remote.type is CUSTOMER_ACCOUNTS_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CUSTOMER_ACCOUNTS_UI_EXTENSION'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
    })

    test('does not return extensions where local.type is not ui_extension', () => {
      // Given
      const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })

    test('does not return extensions where remote.type is not CHECKOUT_UI_EXTENSION or CUSTOMER_ACCOUNTS_UI_EXTENSION', () => {
      // Given
      const localExtension = {...getLocalExtension(), type: 'ui_extension'}
      const remoteExtension = {...getRemoteExtension(), type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'}

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })
  })

  describe('if local.configuration.name matches remote.title', () => {
    test('returns extensions where local.type is ui_extension but remote.type is CHECKOUT_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION', title: 'my-extension'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
    })

    test('returns extensions where local.type is ui_extension but remote.type is CUSTOMER_ACCOUNTS_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CUSTOMER_ACCOUNTS_UI_EXTENSION', title: 'my-extension'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
    })

    test('does not return extensions where local.type is not ui_extension', () => {
      // Given
      const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION', title: 'my-extension'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })

    test('does not return extensions where remote.type is not CHECKOUT_UI_EXTENSION or CUSTOMER_ACCOUNTS_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION', title: 'my-extension'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })
  })

  describe('if neither title/name or ids match', () => {
    test('does not return any extensions', () => {
      // Given
      const localExtension = getLocalExtension({
        type: 'ui_extension',
        handle: 'a-different-extension',
      })
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION', title: 'does-not-match', uuid: '5678'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })
  })
})

describe('migrateExtensions()', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('mockToken')
    vi.mocked(partnersRequest).mockResolvedValue({
      migrateToUiExtension: {userErrors: null, migratedToUiExtension: true},
    })
  })

  test('performs a graphQL mutation for each extension', async () => {
    // Given
    const extensionsToMigrate = [
      {local: getLocalExtension(), remote: getRemoteExtension()},
      {local: getLocalExtension(), remote: getRemoteExtension()},
    ]
    const appId = '123abc'
    const remoteExtensions = extensionsToMigrate.map(({remote}) => ({...remote, type: 'CHECKOUT_UI_EXTENSION'}))

    // When
    await migrateExtensionsToUIExtension(extensionsToMigrate, appId, remoteExtensions)

    // Then
    expect(partnersRequest).toHaveBeenCalledTimes(extensionsToMigrate.length)
    expect(partnersRequest).toHaveBeenCalledWith(ExtensionMigrateToUiExtensionQuery, 'mockToken', {
      apiKey: appId,
      registrationId: extensionsToMigrate[0]!.remote.id,
    })
    expect(partnersRequest).toHaveBeenCalledWith(ExtensionMigrateToUiExtensionQuery, 'mockToken', {
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
    const result = await migrateExtensionsToUIExtension(extensionsToMigrate, appId, remoteExtensions)

    // Then
    expect(result).toStrictEqual(remoteExtensions.map((remote) => ({...remote, type: 'UI_EXTENSION'})))
  })
})
