import {IdentityToken} from '../../session/schema.js'
import {TokenRequestResult} from '../../session/exchange.js'
import {API} from '../../api.js'
import {Environment, serviceEnvironment} from '../../context/service.js'
import {BugError} from '../../../../public/node/error.js'
import {Result} from '../../../../public/node/result.js'

export abstract class IdentityClient {
  abstract requestAccessToken(scopes: string[]): Promise<IdentityToken>

  abstract tokenRequest(params: {
    [key: string]: string
  }): Promise<Result<TokenRequestResult, {error: string; store?: string}>>

  abstract refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken>

  abstract clientId(): string

  applicationId(api: API): string {
    switch (api) {
      case 'admin': {
        const environment = serviceEnvironment()
        if (environment === Environment.Local) {
          return 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52'
        } else if (environment === Environment.Production) {
          return '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c'
        } else {
          return 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52'
        }
      }
      case 'partners': {
        const environment = serviceEnvironment()
        if (environment === Environment.Local) {
          return 'df89d73339ac3c6c5f0a98d9ca93260763e384d51d6038da129889c308973978'
        } else if (environment === Environment.Production) {
          return '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6'
        } else {
          return 'df89d73339ac3c6c5f0a98d9ca93260763e384d51d6038da129889c308973978'
        }
      }
      case 'storefront-renderer': {
        const environment = serviceEnvironment()
        if (environment === Environment.Local) {
          return '46f603de-894f-488d-9471-5b721280ff49'
        } else if (environment === Environment.Production) {
          return 'ee139b3d-5861-4d45-b387-1bc3ada7811c'
        } else {
          return '46f603de-894f-488d-9471-5b721280ff49'
        }
      }
      case 'business-platform': {
        const environment = serviceEnvironment()
        if (environment === Environment.Local) {
          return 'ace6dc89-b526-456d-a942-4b8ef6acda4b'
        } else if (environment === Environment.Production) {
          return '32ff8ee5-82b8-4d93-9f8a-c6997cefb7dc'
        } else {
          return 'ace6dc89-b526-456d-a942-4b8ef6acda4b'
        }
      }
      case 'app-management': {
        const environment = serviceEnvironment()
        if (environment === Environment.Production) {
          return '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c'
        } else {
          return 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52'
        }
      }
      default:
        throw new BugError(`Application id for API of type: ${api}`)
    }
  }
}
