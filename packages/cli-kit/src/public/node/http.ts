/* eslint-disable @typescript-eslint/no-base-to-string */
import {dirname} from './path.js'
import {createFileWriteStream, fileExistsSync, mkdirSync, unlinkFileSync} from './fs.js'
import {runWithTimer} from './metadata.js'
import {maxRequestTimeForNetworkCallsMs, skipNetworkLevelRetry} from './environment.js'
import {httpsAgent, sanitizedHeadersOutput} from '../../private/node/api/headers.js'
import {sanitizeURL} from '../../private/node/api/urls.js'
import {outputContent, outputDebug, outputToken} from '../../public/node/output.js'
import {NetworkRetryBehaviour, simpleRequestWithDebugLog} from '../../private/node/api.js'
import {DEFAULT_MAX_TIME_MS} from '../../private/node/sleep-with-backoff.js'
import FormData from 'form-data'
import nodeFetch, {RequestInfo, RequestInit, Response} from 'node-fetch'

export {FetchError, Request, Response} from 'node-fetch'

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

type RequestBehaviour = NetworkRetryBehaviour & AutomaticCancellationBehaviour

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
  useHttpsAgent: boolean
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

async function innerFetch({url, behaviour, init, logRequest, useHttpsAgent}: FetchOptions): Promise<Response> {
  if (logRequest) {
    outputDebug(outputContent`Sending ${init?.method ?? 'GET'} request to URL ${sanitizeURL(url.toString())}
With request headers:
${sanitizedHeadersOutput((init?.headers ?? {}) as {[header: string]: string})}
`)
  }

  let agent: RequestInit['agent']
  if (useHttpsAgent) {
    agent = await httpsAgent()
  }

  const request = async () => {
    // each time we make the request, we need to potentially reset the abort signal, as the request logic may make
    // the same request multiple times.
    let signal = abortSignalFromRequestBehaviour(behaviour)

    // it's possible to provide a signal through the request's init structure.
    if (init?.signal) {
      signal = init.signal
    }

    return nodeFetch(url, {...init, agent, signal})
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
 * An interface that abstracts way node-fetch. When Node has built-in
 * support for "fetch" in the standard library, we can drop the node-fetch
 * dependency from here.
 * Note that we are exposing types from "node-fetch". The reason being is that
 * they are consistent with the Web API so if we drop node-fetch in the future
 * it won't require changes from the callers.
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
    useHttpsAgent: false,
    // all special behaviours are disabled by default
    behaviour: preferredBehaviour ? requestMode(preferredBehaviour) : requestMode('non-blocking'),
  } as const

  return innerFetch(options)
}

/**
 * A fetch function to use with Shopify services. The function ensures the right
 * TLS configuragion is used based on the environment in which the service is running
 * (e.g. Spin). NB: headers/auth are the responsibility of the caller.
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
    useHttpsAgent: true,
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

  return runWithTimer('cmd_all_timing_network_ms')(() => {
    return new Promise<string>((resolve, reject) => {
      if (!fileExistsSync(dirname(to))) {
        mkdirSync(dirname(to))
      }

      const file = createFileWriteStream(to)

      // if we can't remove the file for some reason (seen on windows), that's ok -- it's in a temporary directory
      const tryToRemoveFile = () => {
        try {
          unlinkFileSync(to)
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (err: unknown) {
          outputDebug(outputContent`Failed to remove file ${outputToken.path(to)}: ${outputToken.raw(String(err))}`)
        }
      }

      file.on('finish', () => {
        file.close()
        resolve(to)
      })

      file.on('error', (err) => {
        tryToRemoveFile()
        reject(err)
      })

      nodeFetch(url, {redirect: 'follow'})
        .then((res) => {
          res.body?.pipe(file)
        })
        .catch((err) => {
          tryToRemoveFile()
          reject(err)
        })
    })
  })
}
