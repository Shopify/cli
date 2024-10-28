import {
  getFlowExtensionsToMigrate,
  getMarketingActivityExtensionsToMigrate,
  getPaymentModulesToMigrate,
  getUIExtensionsToMigrate,
  migrateAppModules,
} from './migrate-app-module.js'
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

describe('getPaymentsExtensionsToMigrate()', () => {
  const defaultIds = {
    'my-action': '1234',
  }

  test('matching my remote title and localIdentifier', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'my-action'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'my-action', uuid: 'yy'})

    // When
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching my remote title and localIdentifier by truncating the title', () => {
    // Given
    const localExtension = getLocalExtension({
      type: 'payments_extension',
      localIdentifier: 'ten-chars-ten-chars-ten-chars-ten-chars-ten-123456',
    })
    const remoteExtension = getRemoteExtension({
      type: 'payments_app_credit_card',
      title: 'Ten Chars Ten Chars Ten Chars Ten Chars Ten 123456789',
      uuid: 'yy',
    })

    // When
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching my local and remote IDs', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension', localIdentifier: 'my-action'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card', title: 'remote', uuid: '1234'})

    // When
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('does not return extensions where local.type is not payments_extension', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'payments_app_credit_card'})

    // When
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return extensions where remote.type is not payments_app_credit_card', () => {
    // Given
    const localExtension = getLocalExtension({type: 'payments_extension'})
    const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})

    // When
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

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
    const toMigrate = getPaymentModulesToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })
})

describe('getMarketingActivityExtensionsToMigrate()', () => {
  const defaultIds = {
    'test-marketing': '1234',
  }

  test('matching my remote title and localIdentifier', () => {
    // Given
    const title = 'test123'
    const localExtension = getLocalExtension({
      type: 'marketing_activity',
      localIdentifier: title,
    })
    const remoteExtension = getRemoteExtension({
      type: 'marketing_activity_extension',
      title,
      uuid: 'yy',
    })

    // When
    const toMigrate = getMarketingActivityExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('matching my local and remote IDs', () => {
    // Given
    const localExtension = getLocalExtension({
      type: 'marketing_activity',
      localIdentifier: 'test-marketing',
    })
    const remoteExtension = getRemoteExtension({type: 'marketing_activity_extension', title: 'remote', uuid: '1234'})

    // When
    const toMigrate = getMarketingActivityExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
  })

  test('does not return extensions where local.type is not marketing_activity', () => {
    // Given
    const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
    const remoteExtension = getRemoteExtension({type: 'flow_action_definition'})

    // When
    const toMigrate = getMarketingActivityExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })

  test('does not return extensions where remote.type is not marketing_activity_extension', () => {
    // Given
    const localExtension = getLocalExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})
    const remoteExtension = getRemoteExtension({type: 'PRODUCT_SUBSCRIPTION_UI_EXTENSION'})

    // When
    const toMigrate = getMarketingActivityExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

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
    const toMigrate = getMarketingActivityExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

    // Then
    expect(toMigrate).toStrictEqual([])
  })
})

describe('getFlowExtensionsToMigrate()', () => {
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

describe('getExtensionsToMigrate()', () => {
  const defaultIds = {
    'my-action': '1234',
  }

  describe('if local.id matches remote.id', () => {
    test('returns extensions where local.type is ui_extension but remote.type is POS_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'POS_UI_EXTENSION'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([{local: localExtension, remote: remoteExtension}])
    })

    test('returns extensions where local.type is ui_extension but remote.type is CHECKOUT_UI_EXTENSION', () => {
      // Given
      const localExtension = getLocalExtension({type: 'ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION'})

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

    test('does not return extensions where remote.type is not CHECKOUT_UI_EXTENSION or POS_UI_EXTENSION', () => {
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

    test('does not return extensions where local.type is not ui_extension', () => {
      // Given
      const localExtension = getLocalExtension({type: 'checkout_ui_extension'})
      const remoteExtension = getRemoteExtension({type: 'CHECKOUT_UI_EXTENSION', title: 'my-extension'})

      // When
      const toMigrate = getUIExtensionsToMigrate([localExtension], [remoteExtension], defaultIds)

      // Then
      expect(toMigrate).toStrictEqual([])
    })

    test('does not return extensions where remote.type is not CHECKOUT_UI_EXTENSION', () => {
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
