import crossFetch from 'cross-fetch'

type Response = ReturnType<typeof crossFetch>
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
async function fetch(url: RequestInfo, init?: RequestInit): Response {
  const response = await crossFetch(url, init)
  return response
}

export default fetch
