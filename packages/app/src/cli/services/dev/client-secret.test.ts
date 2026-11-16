import {devClientSecret} from './client-secret.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

function appWithRemoteSecrets(secrets: {secret: string}[]) {
  const appClientSecrets = vi.fn().mockResolvedValue(secrets)
  const remoteApp = testOrganizationApp({
    apiSecretKeys: [],
    developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
  })
  return {remoteApp, appClientSecrets}
}

describe('devClientSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    mockAndCaptureOutput().clear()
  })

  test('fetches the secret for an app with webs when an automation token can read it', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'fetched-secret'}])

    // When
    const secret = await devClientSecret({remoteApp, hasWebs: true, graphiqlEnabled: true})

    // Then
    expect(secret).toEqual('fetched-secret')
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  })

  test('fails for an app with webs when the App Management API returns no secret', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp} = appWithRemoteSecrets([])

    // When
    const secret = devClientSecret({remoteApp, hasWebs: true, graphiqlEnabled: false})

    // Then
    await expect(secret).rejects.toThrow(AbortError)
    await expect(secret).rejects.toMatchObject({tryMessage: expect.stringContaining('shopify auth login')})
  })

  test('warns and continues without GraphiQL for an extension-only app without a secret', async () => {
    // Given
    const output = mockAndCaptureOutput()
    const {remoteApp} = appWithRemoteSecrets([])

    // When
    const secret = await devClientSecret({remoteApp, hasWebs: false, graphiqlEnabled: true})

    // Then
    expect(secret).toBeUndefined()
    expect(output.warn()).toContain("GraphiQL isn't available")
  })

  test("doesn't ask for the secret for an extension-only app with GraphiQL disabled", async () => {
    // Given
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'fetched-secret'}])

    // When
    const secret = await devClientSecret({remoteApp, hasWebs: false, graphiqlEnabled: false})

    // Then
    expect(secret).toBeUndefined()
    expect(appClientSecrets).not.toHaveBeenCalled()
  })
})
