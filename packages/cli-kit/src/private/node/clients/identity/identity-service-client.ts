import {IdentityClient} from './identity-client.js'
import {IdentityToken} from '../../session/schema.js'
import {
  buildIdentityToken,
  exchangeDeviceCodeForAccessToken,
  tokenRequestErrorHandler,
  TokenRequestResult,
} from '../../session/exchange.js'
import {outputContent, outputDebug, outputInfo, outputToken} from '../../../../public/node/output.js'
import {AbortError, BugError} from '../../../../public/node/error.js'
import {identityFqdn} from '../../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../../public/node/http.js'
import {isCI, openURL} from '../../../../public/node/system.js'
import {isCloudEnvironment} from '../../../../public/node/context/local.js'
import {isTTY, keypress} from '../../../../public/node/ui.js'
import {
  buildAuthorizationParseErrorMessage,
  convertRequestToParams,
  type DeviceAuthorizationResponse,
} from '../../session/device-authorization.js'
import {err, ok, Result} from '../../../../public/node/result.js'
import {Environment, serviceEnvironment} from '../../context/service.js'

export class IdentityServiceClient extends IdentityClient {
  async requestAccessToken(scopes: string[]): Promise<IdentityToken> {
    // Request a device code to authorize without a browser redirect.
    outputDebug(outputContent`Requesting device authorization code...`)
    const deviceAuth = await this.requestDeviceAuthorization(scopes)

    // Poll for the identity token
    outputDebug(outputContent`Starting polling for the identity token...`)
    const identityToken = await this.pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)
    return identityToken
  }

  async tokenRequest(params: {
    [key: string]: string
  }): Promise<Result<TokenRequestResult, {error: string; store?: string}>> {
    const fqdn = await identityFqdn()
    const url = new URL(`https://${fqdn}/oauth/token`)
    url.search = new URLSearchParams(Object.entries(params)).toString()

    const res = await shopifyFetch(url.href, {method: 'POST'})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = await res.json()

    if (res.ok) return ok(payload)

    return err({error: payload.error, store: params.store})
  }

  async refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
    const clientId = this.clientId()
    const params = {
      grant_type: 'refresh_token',
      access_token: currentToken.accessToken,
      refresh_token: currentToken.refreshToken,
      client_id: clientId,
    }
    const tokenResult = await this.tokenRequest(params)
    const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
    return buildIdentityToken(value, currentToken.userId, currentToken.alias)
  }

  clientId(): string {
    const environment = serviceEnvironment()
    if (environment === Environment.Local) {
      return 'e5380e02-312a-7408-5718-e07017e9cf52'
    } else if (environment === Environment.Production) {
      return 'fbdb2649-e327-4907-8f67-908d24cfd7e3'
    } else {
      return 'e5380e02-312a-7408-5718-e07017e9cf52'
    }
  }

  /**
   * ========================
   * Private Instance Methods
   * ========================
   */

  /**
   * Initiate a device authorization flow.
   * This will return a DeviceAuthorizationResponse containing the URL where user
   * should go to authorize the device without the need of a callback to the CLI.
   *
   * Also returns a `deviceCode` used for polling the token endpoint in the next step.
   *
   * @param scopes - The scopes to request
   * @returns An object with the device authorization response.
   */
  private async requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse> {
    const fqdn = await identityFqdn()
    const identityClientId = this.clientId()
    const queryParams = {client_id: identityClientId, scope: scopes.join(' ')}
    const url = `https://${fqdn}/oauth/device_authorization`

    const response = await shopifyFetch(url, {
      method: 'POST',
      headers: {'Content-type': 'application/x-www-form-urlencoded'},
      body: convertRequestToParams(queryParams),
    })

    // First read the response body as text so we have it for debugging
    let responseText: string
    try {
      responseText = await response.text()
    } catch (error) {
      throw new BugError(
        `Failed to read response from authorization service (HTTP ${response.status}). Network or streaming error occurred.`,
        'Check your network connection and try again.',
      )
    }

    // Now try to parse the text as JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jsonResult: any
    try {
      jsonResult = JSON.parse(responseText)
    } catch {
      // JSON.parse failed, handle the parsing error
      const errorMessage = buildAuthorizationParseErrorMessage(response, responseText)
      throw new BugError(errorMessage)
    }

    outputDebug(outputContent`Received device authorization code: ${outputToken.json(jsonResult)}`)
    if (!jsonResult.device_code || !jsonResult.verification_uri_complete) {
      throw new BugError('Failed to start authorization process')
    }

    outputInfo('\nTo run this command, log in to Shopify.')

    if (isCI()) {
      throw new AbortError(
        'Authorization is required to continue, but the current environment does not support interactive prompts.',
        'To resolve this, specify credentials in your environment, or run the command in an interactive environment such as your local terminal.',
      )
    }

    outputInfo(outputContent`User verification code: ${jsonResult.user_code}`)
    const linkToken = outputToken.link(jsonResult.verification_uri_complete)

    const cloudMessage = () => {
      outputInfo(outputContent`👉 Open this link to start the auth process: ${linkToken}`)
    }

    if (isCloudEnvironment() || !isTTY()) {
      cloudMessage()
    } else {
      outputInfo('👉 Press any key to open the login page on your browser')
      await keypress()
      const opened = await openURL(jsonResult.verification_uri_complete)
      if (opened) {
        outputInfo(outputContent`Opened link to start the auth process: ${linkToken}`)
      } else {
        cloudMessage()
      }
    }

    return {
      deviceCode: jsonResult.device_code,
      userCode: jsonResult.user_code,
      verificationUri: jsonResult.verification_uri,
      expiresIn: jsonResult.expires_in,
      verificationUriComplete: jsonResult.verification_uri_complete,
      interval: jsonResult.interval,
    }
  }

  /**
   * Poll the Oauth token endpoint with the device code obtained from a DeviceAuthorizationResponse.
   * The endpoint will return `authorization_pending` until the user completes the auth flow in the browser.
   * Once the user completes the auth flow, the endpoint will return the identity token.
   *
   * Timeout for the polling is defined by the server and is around 600 seconds.
   *
   * @param code - The device code obtained after starting a device identity flow
   * @param interval - The interval to poll the token endpoint
   * @returns The identity token
   */
  private async pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
    let currentIntervalInSeconds = interval

    return new Promise<IdentityToken>((resolve, reject) => {
      const onPoll = async () => {
        const result = await exchangeDeviceCodeForAccessToken(code)
        if (!result.isErr()) {
          resolve(result.value)
          return
        }

        const error = result.error ?? 'unknown_failure'

        outputDebug(outputContent`Polling for device authorization... status: ${error}`)
        switch (error) {
          case 'authorization_pending': {
            startPolling()
            return
          }
          case 'slow_down':
            currentIntervalInSeconds += 5
            startPolling()
            return
          case 'access_denied':
          case 'expired_token':
          case 'unknown_failure': {
            reject(new Error(`Device authorization failed: ${error}`))
          }
        }
      }

      const startPolling = () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(onPoll, currentIntervalInSeconds * 1000)
      }

      startPolling()
    })
  }
}
