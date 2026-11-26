import {
  appClientSecret,
  clientSecretVariableHint,
  fetchRemoteAppClientSecret,
  missingClientSecretTryMessage,
} from './organization.js'
import {testDeveloperPlatformClient, testOrganizationApp} from './app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

function appWithRemoteSecrets(secrets: {secret: string}[]) {
  const appClientSecrets = vi.fn().mockResolvedValue(secrets)
  const remoteApp = testOrganizationApp({
    apiKey: 'api-key',
    apiSecretKeys: [],
    developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
  })
  return {remoteApp, appClientSecrets}
}

describe('fetchRemoteAppClientSecret', () => {
  test('returns an already loaded secret without asking the App Management API', async () => {
    // Given
    const appClientSecrets = vi.fn()
    const remoteApp = testOrganizationApp({
      apiSecretKeys: [{secret: ''}, {secret: 'secret-1'}],
      developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
    })

    // When
    const secret = await fetchRemoteAppClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('secret-1')
    expect(appClientSecrets).not.toHaveBeenCalled()
  })

  test('asks the App Management API for the secret when it is not loaded', async () => {
    // Given
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'secret-1'}, {secret: 'secret-2'}])

    // When
    const secret = await fetchRemoteAppClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('secret-1')
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  })

  test('returns undefined when the App Management API returns no secrets', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(fetchRemoteAppClientSecret(remoteApp)).resolves.toBeUndefined()
  })
})

describe('appClientSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns the secret the App Management API returns to an automation token', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp} = appWithRemoteSecrets([{secret: 'secret-1'}])

    // When / Then
    await expect(appClientSecret(remoteApp)).resolves.toEqual('secret-1')
  })

  test('throws an AbortError when a logged-in user gets no secret', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp)).rejects.toThrow(AbortError)
    await expect(appClientSecret(remoteApp)).rejects.toMatchObject({
      message: expect.stringContaining("didn't return one for your credentials"),
      tryMessage: expect.stringContaining('Developer Dashboard'),
    })
  })

  test('suggests logging in when an automation token gets no secret', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp)).rejects.toMatchObject({
      tryMessage: expect.stringContaining('shopify auth login'),
    })
  })

  test.each(['SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'SHOPIFY_APP_AUTOMATION_TOKEN', 'SHOPIFY_CLI_PARTNERS_TOKEN'])(
    'tells the user to unset %s before logging in, without showing its value',
    async (variable) => {
      // Given
      vi.stubEnv(variable, 'automation-token-value')

      // When
      const message = missingClientSecretTryMessage()

      // Then
      expect(message).toContain(`The token in ${variable} might not have access to the app's client secret.`)
      expect(message).toContain(`unset ${variable}, log in with \`shopify auth login\`, and run the command again`)
      expect(message).not.toContain('automation-token-value')
    },
  )

  test('names every automation token variable that is set', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'token-1')
    vi.stubEnv('SHOPIFY_CLI_PARTNERS_TOKEN', 'token-2')

    // When
    const message = missingClientSecretTryMessage()

    // Then
    expect(message).toContain('unset SHOPIFY_SERVICE_ACCOUNT_TOKEN and SHOPIFY_CLI_PARTNERS_TOKEN,')
  })

  test('links a logged-in user to the Developer Dashboard', () => {
    // When
    const message = missingClientSecretTryMessage()

    // Then
    expect(message).toContain('Developer Dashboard: https://dev.shopify.com')
  })

  test('uses the command-specific way to provide the secret', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp, 'Pass the secret with a flag.')).rejects.toMatchObject({
      tryMessage: `Pass the secret with a flag. ${clientSecretVariableHint()}`,
    })
  })

  test('uses the secret in SHOPIFY_CLI_APP_CLIENT_SECRET without asking the App Management API', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    vi.stubEnv('SHOPIFY_CLI_APP_CLIENT_SECRET', 'environment-secret')
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'remote-secret'}])

    // When
    const secret = await appClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('environment-secret')
    expect(appClientSecrets).not.toHaveBeenCalled()
  })

  test('logs that it uses SHOPIFY_CLI_APP_CLIENT_SECRET without logging its value', async () => {
    // Given
    vi.stubEnv('SHOPIFY_CLI_APP_CLIENT_SECRET', 'environment-secret')
    const output = mockAndCaptureOutput()
    output.clear()
    const {remoteApp} = appWithRemoteSecrets([])

    // When
    await appClientSecret(remoteApp)

    // Then
    expect(output.debug()).toContain("Using the app's client secret from SHOPIFY_CLI_APP_CLIENT_SECRET.")
    expect(output.debug()).not.toContain('environment-secret')
    output.clear()
  })

  test('asks the App Management API when SHOPIFY_CLI_APP_CLIENT_SECRET is empty', async () => {
    // Given
    vi.stubEnv('SHOPIFY_CLI_APP_CLIENT_SECRET', '')
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'remote-secret'}])

    // When
    const secret = await appClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('remote-secret')
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  })

  test('names SHOPIFY_CLI_APP_CLIENT_SECRET when there is no secret', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp)).rejects.toMatchObject({
      tryMessage: expect.stringContaining('set SHOPIFY_CLI_APP_CLIENT_SECRET'),
    })
  })
})

describe('fetchRemoteAppClientSecret with SHOPIFY_CLI_APP_CLIENT_SECRET', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('ignores the variable, so commands that show the secret never echo it', async () => {
    // Given
    vi.stubEnv('SHOPIFY_CLI_APP_CLIENT_SECRET', 'environment-secret')
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(fetchRemoteAppClientSecret(remoteApp)).resolves.toBeUndefined()
  })
})
