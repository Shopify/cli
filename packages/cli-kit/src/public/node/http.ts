import {dirname} from './path.js'
import {createFileWriteStream, fileExistsSync, mkdirSync, unlinkFileSync} from './fs.js'
import {runWithTimer} from './metadata.js'
import {maxRequestTimeForNetworkCallsMs, skipNetworkLevelRetry} from './environment.js'
import {outputContent, outputDebug, outputToken} from './output.js'
import {sanitizeURL} from '../../private/node/api/urls.js'
import {sanitizedHeadersOutput} from '../../private/node/api/headers.js'
import {NetworkRetryBehaviour, simpleRequestWithDebugLog} from '../../private/node/api.js'
import {DEFAULT_MAX_TIME_MS} from '../../private/node/sleep-with-backoff.js'

import {fetch as undiciFetch, EnvHttpProxyAgent, FormData, Response} from 'undici'
import {pipeline} from 'stream/promises'
import type {Dispatcher, RequestInfo, RequestInit} from 'undici'

export {FormData, Request, Response} from 'undici'

/**
 * Create a new FormData object.
 *
 * @returns A FormData object.
 */
export function formData(): FormData {
  return new FormData()
}

type AbortSignal = RequestInit['signal']

type PresetFetchBehaviour = 'default' | 'non-blocking' | 'slow-request'

type AutomaticCancellationBehaviour =
  | {
      useAbortSignal: true
      timeoutMs: number
    }
  | {
      useAbortSignal: false
    }
  | {
      useAbortSignal: AbortSignal | (() => AbortSignal)
    }

export type RequestBehaviour = NetworkRetryBehaviour & AutomaticCancellationBehaviour

export type RequestModeInput = PresetFetchBehaviour | RequestBehaviour

/**
 * Specify the behaviour of a network request.
 *
 * - default: Requests are automatically retried, and are subject to automatic cancellation if they're taking too long.
 * This is generally desirable.
 * - non-blocking: Requests are not retried if they fail with a network error, and are automatically cancelled if
 * they're taking too long. This is good for throwaway requests, like polling or tracking.
 * - slow-request: Requests are not retried if they fail with a network error, and are not automatically cancelled.
 * This is good for slow requests that should be give the chance to complete, and are unlikely to be safe to retry.
 *
 * Some request behaviours may be de-activated by the environment, and this function takes care of that concern. You
 * can also provide a customised request behaviour.
 *
 * @param preset - The preset to use.
 * @param env - Process environment variables.
 * @returns A request behaviour object.
 */
export function requestMode(
  preset: RequestModeInput = 'default',
  env: NodeJS.ProcessEnv = process.env,
): RequestBehaviour {
  const networkLevelRetryIsSupported = !skipNetworkLevelRetry(env)
  switch (preset) {
    case 'default':
      return {
        useNetworkLevelRetry: networkLevelRetryIsSupported,
        maxRetryTimeMs: DEFAULT_MAX_TIME_MS,
        useAbortSignal: true,
        timeoutMs: maxRequestTimeForNetworkCallsMs(env),
      }
    case 'non-blocking':
      return {
        useNetworkLevelRetry: false,
        useAbortSignal: true,
        timeoutMs: maxRequestTimeForNetworkCallsMs(env),
      }
    case 'slow-request':
      return {
        useNetworkLevelRetry: false,
        useAbortSignal: false,
      }
  }
  return {
    ...preset,
    useNetworkLevelRetry: networkLevelRetryIsSupported && preset.useNetworkLevelRetry,
  } as RequestBehaviour
}

interface FetchOptions {
  url: RequestInfo
  behaviour: RequestBehaviour
  init?: RequestInit
  logRequest: boolean
}

let proxyDispatcher: Dispatcher | undefined
let proxyDispatcherComputed = false

/**
 * Returns a dispatcher that routes requests through the proxy configured with the
 * SHOPIFY_HTTP_PROXY, SHOPIFY_HTTPS_PROXY and SHOPIFY_NO_PROXY environment variables,
 * or undefined when no proxy is configured. These are the same variables that
 * global-agent honors for the http traffic that goes through Node's http module.
 *
 * @param env - Process environment variables.
 * @returns A dispatcher, or undefined when no proxy is configured.
 */
function dispatcherFromEnvironment(env: NodeJS.ProcessEnv = process.env): Dispatcher | undefined {
  if (!proxyDispatcherComputed) {
    proxyDispatcherComputed = true
    const httpProxy = env.SHOPIFY_HTTP_PROXY
    const httpsProxy = env.SHOPIFY_HTTPS_PROXY ?? httpProxy
    if (httpProxy ?? httpsProxy) {
      proxyDispatcher = new EnvHttpProxyAgent({httpProxy, httpsProxy, noProxy: env.SHOPIFY_NO_PROXY})
    }
  }
  return proxyDispatcher
}

/**
 * Create an AbortSignal for automatic request cancellation, from a request behaviour.
 *
 * @param behaviour - The request behaviour.
 * @returns An AbortSignal.
 */
export function abortSignalFromRequestBehaviour(behaviour: RequestBehaviour): AbortSignal {
  let signal: AbortSignal
  if (behaviour.useAbortSignal === true) {
    signal = AbortSignal.timeout(behaviour.timeoutMs)
  } else if (behaviour.useAbortSignal && typeof behaviour.useAbortSignal === 'function') {
    signal = behaviour.useAbortSignal()
  } else if (behaviour.useAbortSignal) {
    signal = behaviour.useAbortSignal
  }
  return signal
}

async function innerFetch({url, behaviour, init, logRequest}: FetchOptions): Promise<Response> {
  if (logRequest) {
    outputDebug(outputContent`Sending ${init?.method ?? 'GET'} request to URL ${sanitizeURL(url.toString())}
With request headers:
${sanitizedHeadersOutput((init?.headers ?? {}) as Record<string, string>)}
`)
  }

  const dispatcher = init?.dispatcher ?? dispatcherFromEnvironment()

  const request = async () => {
    // each time we make the request, we need to potentially reset the abort signal, as the request logic may make
    // the same request multiple times.
    let signal = abortSignalFromRequestBehaviour(behaviour)

    // it's possible to provide a signal through the request's init structure.
    if (init?.signal) {
      signal = init.signal
    }

    return undiciFetch(url, {...init, dispatcher, signal})
  }

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    return simpleRequestWithDebugLog({
      url: url.toString(),
      request,
      ...behaviour,
    })
  })
}

/**
 * An interface that abstracts away the fetch implementation (undici). The exposed
 * types are consistent with the Web API.
 *
 * The CLI's fetch function supports special behaviours, like automatic retries. These are disabled by default through
 * this function.
 *
 * @param url - This defines the resource that you wish to fetch.
 * @param init - An object containing any custom settings that you want to apply to the request.
 * @param preferredBehaviour - A request behaviour object that overrides the default behaviour.
 * @returns A promise that resolves with the response.
 */
export async function fetch(
  url: RequestInfo,
  init?: RequestInit,
  preferredBehaviour?: RequestModeInput,
): Promise<Response> {
  const options = {
    url,
    init,
    logRequest: false,
    // all special behaviours are disabled by default
    behaviour: preferredBehaviour ? requestMode(preferredBehaviour) : requestMode('non-blocking'),
  } as const

  return innerFetch(options)
}

/**
 * A fetch function to use with Shopify services. The function ensures the right
 * TLS configuragion is used based on the environment in which the service is running
 * (e.g. Local). NB: headers/auth are the responsibility of the caller.
 *
 * By default, the CLI's fetch function's special behaviours, like automatic retries, are enabled.
 *
 * @param url - This defines the resource that you wish to fetch.
 * @param init - An object containing any custom settings that you want to apply to the request.
 * @param preferredBehaviour - A request behaviour object that overrides the default behaviour.
 * @returns A promise that resolves with the response.
 */
export async function shopifyFetch(
  url: RequestInfo,
  init?: RequestInit,
  preferredBehaviour?: RequestModeInput,
): Promise<Response> {
  const options = {
    url,
    init,
    logRequest: true,
    // special behaviours enabled by default
    behaviour: preferredBehaviour ? requestMode(preferredBehaviour) : requestMode(),
  }

  return innerFetch(options)
}

/**
 * Download a file from a URL to a local path.
 *
 * @param url - The URL to download from.
 * @param to - The local path to download to.
 * @returns - A promise that resolves with the local path.
 */
export function downloadFile(url: string, to: string): Promise<string> {
  const sanitizedUrl = sanitizeURL(url)
  outputDebug(`Downloading ${sanitizedUrl} to ${to}`)

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    if (!fileExistsSync(dirname(to))) {
      mkdirSync(dirname(to))
    }

    // if we can't remove the file for some reason (seen on windows), that's ok -- it's in a temporary directory
    const tryToRemoveFile = () => {
      try {
        if (fileExistsSync(to)) {
          unlinkFileSync(to)
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err: unknown) {
        outputDebug(outputContent`Failed to remove file ${outputToken.path(to)}: ${outputToken.raw(String(err))}`)
      }
    }

    try {
      const res = await undiciFetch(url, {redirect: 'follow', dispatcher: dispatcherFromEnvironment()})
      if (!res.body) {
        throw new Error(`No response body received when downloading ${sanitizedUrl}`)
      }
      await pipeline(res.body, createFileWriteStream(to))
      return to
    } catch (err) {
      tryToRemoveFile()
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
}
