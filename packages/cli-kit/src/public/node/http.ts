import {dirname} from './path.js'
import {createFileWriteStream, fileExistsSync, mkdirSync, unlinkFileSync} from './fs.js'
import {runWithTimer} from './metadata.js'
import {buildHeaders, httpsAgent, sanitizedHeadersOutput} from '../../private/node/api/headers.js'
import {sanitizeURL} from '../../private/node/api/urls.js'
import {outputContent, outputDebug} from '../../public/node/output.js'
import {debugLogResponseInfo} from '../../private/node/api.js'
import FormData from 'form-data'
import nodeFetch, {RequestInfo, RequestInit} from 'node-fetch'

export {FetchError, Request} from 'node-fetch'

/**
 * Create a new FormData object.
 *
 * @returns A FormData object.
 */
export function formData(): FormData {
  return new FormData()
}

export type Response = ReturnType<typeof nodeFetch>

/**
 * An interface that abstracts way node-fetch. When Node has built-in
 * support for "fetch" in the standard library, we can drop the node-fetch
 * dependency from here.
 * Note that we are exposing types from "node-fetch". The reason being is that
 * they are consistent with the Web API so if we drop node-fetch in the future
 * it won't require changes from the callers.
 *
 * @param url - This defines the resource that you wish to fetch.
 * @param init - An object containing any custom settings that you want to apply to the request.
 * @returns A promise that resolves with the response.
 */
export async function fetch(url: RequestInfo, init?: RequestInit): Response {
  return runWithTimer('cmd_all_timing_network_ms')(() =>
    debugLogResponseInfo({url: url.toString(), request: nodeFetch(url, init)}),
  )
}

/**
 * A fetch function to use with Shopify services. The function ensures the right
 * TLS configuragion is used based on the environment in which the service is running
 * (e.g. Spin).
 *
 * @param url - This defines the resource that you wish to fetch.
 * @param init - An object containing any custom settings that you want to apply to the request.
 * @returns A promise that resolves with the response.
 */
export async function shopifyFetch(url: RequestInfo, init?: RequestInit): Response {
  const sanitizedUrl = sanitizeURL(url.toString())
  const options: RequestInit = {
    ...(init ?? {}),
    headers: {
      ...(await buildHeaders()),
      ...(init?.headers ?? {}),
    },
  }

  outputDebug(outputContent`Sending ${options.method ?? 'GET'} request to URL ${sanitizedUrl}
With request headers:
${sanitizedHeadersOutput((options?.headers ?? {}) as {[header: string]: string})}
`)
  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    return debugLogResponseInfo({url: url.toString(), request: nodeFetch(url, {...init, agent: await httpsAgent()})})
  })
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

      file.on('finish', () => {
        file.close()
        resolve(to)
      })

      file.on('error', (err) => {
        unlinkFileSync(to)
        reject(err)
      })

      nodeFetch(url, {redirect: 'follow'})
        .then((res) => {
          res.body?.pipe(file)
        })
        .catch((err) => {
          unlinkFileSync(to)
          reject(err)
        })
    })
  })
}
