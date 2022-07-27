import {Service} from '../network/service.js'

import {httpsAgent} from '../http.js'
import nodeFetch from 'node-fetch'
import type {RequestInfo, RequestInit} from 'node-fetch'

type Response = ReturnType<typeof nodeFetch>
/**
 * An interface that abstracts way node-fetch. When Node has built-in
 * support for "fetch" in the standard library, we can drop the node-fetch
 * dependency from here.
 * Note that we are exposing types from "node-fetch". The reason being is that
 * they are consistent with the Web API so if we drop node-fetch in the future
 * it won't require changes from the callers.
 * @param url {RequestInfo} This defines the resource that you wish to fetch.
 * @param init {RequestInit} An object containing any custom settings that you want to apply to the request
 * @returns A promise that resolves with the response.
 */
export default async function fetch(url: RequestInfo, init?: RequestInit): Response {
  const response = await nodeFetch(url, init)
  return response
}

/**
 * A fetch function to use with Shopify services. The function ensures the right
 * TLS configuragion is used based on the environment in which the service is running
 * (e.g. spin)
 */
export async function shopifyFetch(service: Service, url: RequestInfo, init?: RequestInit): Response {
  const response = await nodeFetch(url, {...init, agent: await httpsAgent(service)})
  return response
}
