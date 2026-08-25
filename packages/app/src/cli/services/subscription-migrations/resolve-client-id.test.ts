import {resolveSubscriptionMigrationClientId} from './resolve-client-id.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {getAppConfigurationContext as GetAppConfigurationContext} from '../../models/app/loader.js'

type AppConfigurationContext = Awaited<ReturnType<typeof GetAppConfigurationContext>>

function configurationContext({
  clientId,
  errors = [],
}: {
  clientId?: unknown
  errors?: {message: string}[]
}): AppConfigurationContext {
  return {
    project: {},
    activeConfig: {
      file: {
        content: {client_id: clientId},
        errors,
      },
    },
  } as unknown as AppConfigurationContext
}

describe('resolveSubscriptionMigrationClientId', () => {
  test('returns an explicit Client ID without loading an app project', async () => {
    const getAppConfigurationContext = vi.fn()

    await expect(
      resolveSubscriptionMigrationClientId(
        {clientId: 'override-client-id', directory: '/app', configName: 'staging'},
        {getAppConfigurationContext},
      ),
    ).resolves.toBe('override-client-id')
    expect(getAppConfigurationContext).not.toHaveBeenCalled()
  })

  test('returns the Client ID from the active app configuration', async () => {
    const getAppConfigurationContext = vi
      .fn()
      .mockResolvedValue(configurationContext({clientId: 'configured-client-id'}))

    await expect(
      resolveSubscriptionMigrationClientId(
        {clientId: undefined, directory: '/app', configName: undefined},
        {getAppConfigurationContext},
      ),
    ).resolves.toBe('configured-client-id')
  })

  test('forwards the selected directory and configuration name', async () => {
    const getAppConfigurationContext = vi.fn().mockResolvedValue(configurationContext({clientId: 'client-id'}))

    await resolveSubscriptionMigrationClientId(
      {clientId: undefined, directory: '/selected/app', configName: 'production'},
      {getAppConfigurationContext},
    )

    expect(getAppConfigurationContext).toHaveBeenCalledWith('/selected/app', 'production')
  })

  test('raises an AbortError containing active configuration parse errors', async () => {
    const getAppConfigurationContext = vi.fn().mockResolvedValue(
      configurationContext({
        errors: [{message: 'Unexpected character at row 2'}, {message: 'Expected a string for client_id'}],
      }),
    )
    const promise = resolveSubscriptionMigrationClientId(
      {clientId: undefined, directory: '/app', configName: undefined},
      {getAppConfigurationContext},
    )

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Unexpected character at row 2\nExpected a string for client_id')
  })

  test.each([undefined, '', '   '])(
    'raises an actionable AbortError when the active Client ID is %j',
    async (clientId) => {
      const getAppConfigurationContext = vi.fn().mockResolvedValue(configurationContext({clientId}))
      const promise = resolveSubscriptionMigrationClientId(
        {clientId: undefined, directory: '/app', configName: undefined},
        {getAppConfigurationContext},
      )

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toThrow('No Client ID found in the active app configuration.')
      await expect(promise).rejects.toThrow('shopify app config link')
      await expect(promise).rejects.toThrow('--client-id')
    },
  )
})
