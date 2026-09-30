import {REQUEST_AUTHENTICATION_METHODS} from '../types.js'
import type {RequestAuthenticationMethod} from '../types.js'

export {REQUEST_AUTHENTICATION_METHODS}
export type {RequestAuthenticationMethod}

export const REQUEST_MANIFEST_SCHEMA_VERSION = 1 as const

export interface AppSecurityRequest {
  url: string
  method: RequestAuthenticationMethod
}

export interface AppSecurityRequestManifest {
  schema_version: typeof REQUEST_MANIFEST_SCHEMA_VERSION
  requests: AppSecurityRequest[]
}

const MAX_REQUESTS = 1_000
const authenticationMethods = new Set<string>(REQUEST_AUTHENTICATION_METHODS)

export class RequestManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestManifestError'
  }
}

export function parseRequestManifest(value: unknown): AppSecurityRequestManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestManifestError('The App Security request manifest must contain a JSON object.')
  }
  const document = value as Record<string, unknown>
  if (Object.keys(document).some((key) => key !== 'schema_version' && key !== 'requests')) {
    throw new RequestManifestError('The App Security request manifest contains an unknown field.')
  }
  if (document.schema_version !== REQUEST_MANIFEST_SCHEMA_VERSION) {
    throw new RequestManifestError(
      `The App Security request manifest must use schema version ${REQUEST_MANIFEST_SCHEMA_VERSION}.`,
    )
  }
  if (!Array.isArray(document.requests)) {
    throw new RequestManifestError('The App Security request manifest must contain a requests array.')
  }
  if (document.requests.length > MAX_REQUESTS) {
    throw new RequestManifestError(
      `The App Security request manifest can't contain more than ${MAX_REQUESTS} requests.`,
    )
  }

  const requests = document.requests.map((request, index) => parseRequest(request, index))
  const identities = new Set<string>()
  for (const request of requests) {
    const identity = `${request.method}:${request.url}`
    if (identities.has(identity)) {
      throw new RequestManifestError(`The App Security request manifest contains a duplicate request: ${identity}.`)
    }
    identities.add(identity)
  }

  return {schema_version: REQUEST_MANIFEST_SCHEMA_VERSION, requests}
}

function parseRequest(value: unknown, index: number): AppSecurityRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestManifestError(`requests[${index}] must be an object.`)
  }
  const request = value as Record<string, unknown>
  if (Object.keys(request).some((key) => key !== 'url' && key !== 'method')) {
    throw new RequestManifestError(`requests[${index}] contains an unknown field.`)
  }
  if (typeof request.url !== 'string' || !isSafeRelativeUrl(request.url)) {
    throw new RequestManifestError(
      `requests[${index}].url must be an absolute-path reference without credentials, query parameters, or a fragment.`,
    )
  }
  if (typeof request.method !== 'string' || !authenticationMethods.has(request.method)) {
    throw new RequestManifestError(
      `requests[${index}].method must be one of: ${REQUEST_AUTHENTICATION_METHODS.join(', ')}.`,
    )
  }
  return {url: request.url, method: request.method as RequestAuthenticationMethod}
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function isSafeRelativeUrl(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || hasControlCharacter(value)) return false
  if (!URL.canParse(value, 'https://app-security.invalid')) return false
  const parsed = new URL(value, 'https://app-security.invalid')
  return parsed.origin === 'https://app-security.invalid' && parsed.pathname === value && !parsed.search && !parsed.hash
}
