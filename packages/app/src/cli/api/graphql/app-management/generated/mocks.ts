/* eslint-disable @typescript-eslint/no-unused-vars, tsdoc/syntax, @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-duplicate-type-constituents */
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {graphql, type GraphQLResponseResolver, type RequestHandlerOptions} from 'msw'

type Maybe<T> = T | null
type InputMaybe<T> = Maybe<T>
type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}
type MakeOptional<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]?: Maybe<T[SubKey]>}
type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]: Maybe<T[SubKey]>}
type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {[_ in K]?: never}
type Incremental<T> = T | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never}
/** All built-in and custom scalars, mapped to their actual values */
type Scalars = {
  ID: {input: string; output: string}
  String: {input: string; output: string}
  Boolean: {input: boolean; output: boolean}
  Int: {input: number; output: number}
  Float: {input: number; output: number}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: {input: unknown; output: unknown}
  /**
   * A [JSON](https://www.json.org/json-en.html) object.
   *
   * Example value:
   * `{
   *   "product": {
   *     "id": "gid://shopify/Product/1346443542550",
   *     "title": "White T-shirt",
   *     "options": [{
   *       "name": "Size",
   *       "values": ["M", "L"]
   *     }]
   *   }
   * }`
   */
  JSON: {input: unknown; output: unknown}
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: unknown; output: unknown}
}

/** The input fields for an app module. */
type AppModuleInput = {
  /** Configuration for the module. */
  config: Scalars['JSON']['input']
  /** Human-readable identifier for the module. */
  handle?: InputMaybe<Scalars['String']['input']>
  /** Identifier for the module's specification. */
  specificationIdentifier: Scalars['String']['input']
  /** The location where the module will be surfaced. */
  target?: InputMaybe<Scalars['String']['input']>
  /** User-specified identifier for the module, unique to the app. */
  uid?: InputMaybe<Scalars['String']['input']>
}

/** The input fields for data and configuration that represent an app. */
type AppSourceInput = {
  /** Modules that make up the app. */
  appModules: AppModuleInput[]
  /** URL for app assets. */
  assetsUrl?: InputMaybe<Scalars['URL']['input']>
}

/** The input fields used to create a new app version. */
type AppVersionInput = {
  /** The manifest from which to create the app version. */
  source?: InputMaybe<Scalars['JSON']['input']>
  /** URL referencing the source from which to create the app version. */
  sourceUrl?: InputMaybe<Scalars['URL']['input']>
}

/** Possible error codes that can be returned by AppManagement. */
type Code =
  /** Access denied. */
  | 'ACCESS_DENIED'
  /** An event error. */
  | 'EVENT'
  /** An internal error. */
  | 'INTERNAL'
  /** The request was invalid. */
  | 'INVALID'
  /** The requested resource was not found. */
  | 'NOT_FOUND'
  /** A plugin error. */
  | 'PLUGIN'
  /** An unknown error. */
  | 'UNKNOWN'

/** The input fields for app version metadata. */
type VersionMetadataInput = {
  /** Message associated with this app version. */
  message?: InputMaybe<Scalars['String']['input']>
  /** Link to version control, if any. */
  sourceControlUrl?: InputMaybe<Scalars['URL']['input']>
  /** Version tag associated with this app version. */
  versionTag?: InputMaybe<Scalars['String']['input']>
}

type ActiveAppReleaseFromApiKeyQueryVariables = Exact<{
  apiKey: Scalars['String']['input']
}>

type ActiveAppReleaseFromApiKeyQuery = {
  app: {
    id: string
    key: string
    activeRoot: {clientCredentials: {secrets: {key: string}[]}}
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: {
          uuid: string
          userIdentifier: string
          handle: string
          config: JsonMapType
          specification: {identifier: string; externalIdentifier: string; name: string}
        }[]
      }
    }
  }
}

type ActiveAppReleaseQueryVariables = Exact<{
  appId: Scalars['ID']['input']
}>

type ActiveAppReleaseQuery = {
  app: {
    id: string
    key: string
    activeRoot: {clientCredentials: {secrets: {key: string}[]}}
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: {
          uuid: string
          userIdentifier: string
          handle: string
          config: JsonMapType
          specification: {identifier: string; externalIdentifier: string; name: string}
        }[]
      }
    }
  }
}

type AppVersionInfoFragment = {
  id: string
  key: string
  activeRoot: {clientCredentials: {secrets: {key: string}[]}}
  activeRelease: {
    id: string
    version: {
      name: string
      appModules: {
        uuid: string
        userIdentifier: string
        handle: string
        config: JsonMapType
        specification: {identifier: string; externalIdentifier: string; name: string}
      }[]
    }
  }
}

type ReleasedAppModuleFragment = {
  uuid: string
  userIdentifier: string
  handle: string
  config: JsonMapType
  specification: {identifier: string; externalIdentifier: string; name: string}
}

type AppVersionByIdQueryVariables = Exact<{
  versionId: Scalars['ID']['input']
}>

type AppVersionByIdQuery = {
  version: {
    id: string
    metadata: {message?: string | null; versionTag?: string | null}
    appModules: {
      uuid: string
      userIdentifier: string
      handle: string
      config: JsonMapType
      specification: {identifier: string; externalIdentifier: string; name: string}
    }[]
  }
}

type VersionInfoFragment = {
  id: string
  metadata: {message?: string | null; versionTag?: string | null}
  appModules: {
    uuid: string
    userIdentifier: string
    handle: string
    config: JsonMapType
    specification: {identifier: string; externalIdentifier: string; name: string}
  }[]
}

type AppVersionByTagQueryVariables = Exact<{
  versionTag: Scalars['String']['input']
}>

type AppVersionByTagQuery = {
  versionByTag: {
    id: string
    metadata: {message?: string | null; versionTag?: string | null}
    appModules: {
      uuid: string
      userIdentifier: string
      handle: string
      config: JsonMapType
      specification: {identifier: string; externalIdentifier: string; name: string}
    }[]
  }
}

type AppVersionsQueryVariables = Exact<{
  appId: Scalars['ID']['input']
}>

type AppVersionsQuery = {
  app: {id: string; activeRelease: {id: string; version: {id: string}}}
  versions: {
    id: string
    createdAt: string
    createdBy?: string | null
    metadata: {message?: string | null; versionTag?: string | null}
  }[]
}

type ListAppsQueryVariables = Exact<{
  query?: InputMaybe<Scalars['String']['input']>
}>

type ListAppsQuery = {
  appsConnection?: {
    edges: {
      node: {
        id: string
        key: string
        activeRelease: {
          id: string
          version: {
            name: string
            appModules: {
              uuid: string
              userIdentifier: string
              handle: string
              config: JsonMapType
              specification: {identifier: string; externalIdentifier: string; name: string}
            }[]
          }
        }
      }
    }[]
    pageInfo: {hasNextPage: boolean}
  } | null
}

type CreateAppVersionMutationVariables = Exact<{
  appId: Scalars['ID']['input']
  appSource: AppSourceInput
  name: Scalars['String']['input']
  metadata?: InputMaybe<VersionMetadataInput>
}>

type CreateAppVersionMutation = {
  appVersionCreate: {
    version?: {
      id: string
      appModules: {
        uuid: string
        userIdentifier: string
        handle: string
        config: JsonMapType
        specification: {identifier: string; externalIdentifier: string; name: string}
      }[]
      metadata: {versionTag?: string | null; message?: string | null}
    } | null
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      code?: Code | null
      on: JsonMapType
    }[]
  }
}

type CreateAppMutationVariables = Exact<{
  initialVersion: AppVersionInput
}>

type CreateAppMutation = {
  appCreate: {
    app?: {id: string; key: string; activeRoot: {clientCredentials: {secrets: {key: string}[]}}} | null
    userErrors: {category: string; message: string; on: JsonMapType}[]
  }
}

type CreateAssetUrlMutationVariables = Exact<{[key: string]: never}>

type CreateAssetUrlMutation = {
  appRequestSourceUploadUrl: {
    sourceUploadUrl?: string | null
    userErrors: {field?: string[] | null; message: string}[]
  }
}

type ReleaseVersionMutationVariables = Exact<{
  appId: Scalars['ID']['input']
  versionId: Scalars['ID']['input']
}>

type ReleaseVersionMutation = {
  appReleaseCreate: {
    release?: {version: {id: string; metadata: {message?: string | null; versionTag?: string | null}}} | null
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      code?: Code | null
      on: JsonMapType
    }[]
  }
}

type FetchSpecificationsQueryVariables = Exact<{[key: string]: never}>

type FetchSpecificationsQuery = {
  specifications: {
    name: string
    identifier: string
    externalIdentifier: string
    features: string[]
    uidStrategy:
      | {appModuleLimit: number; isClientProvided: boolean}
      | {appModuleLimit: number; isClientProvided: boolean}
    validationSchema?: {jsonSchema: string} | null
  }[]
}

const appManagement = graphql.link(
  'https://app-management.shopify-cli.mock/app_management/unstable/organizations/xxxx/graphql.json',
)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockActiveAppReleaseFromApiKeyQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { apiKey } = variables;
 *     return HttpResponse.json({
 *       data: { appByKey }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockActiveAppReleaseFromApiKeyQueryAppManagement = (
  resolver: GraphQLResponseResolver<ActiveAppReleaseFromApiKeyQuery, ActiveAppReleaseFromApiKeyQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  appManagement.query<ActiveAppReleaseFromApiKeyQuery, ActiveAppReleaseFromApiKeyQueryVariables>(
    'ActiveAppReleaseFromApiKey',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockActiveAppReleaseQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { appId } = variables;
 *     return HttpResponse.json({
 *       data: { app }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockActiveAppReleaseQueryAppManagement = (
  resolver: GraphQLResponseResolver<ActiveAppReleaseQuery, ActiveAppReleaseQueryVariables>,
  options?: RequestHandlerOptions,
) => appManagement.query<ActiveAppReleaseQuery, ActiveAppReleaseQueryVariables>('activeAppRelease', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockAppVersionByIdQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { versionId } = variables;
 *     return HttpResponse.json({
 *       data: { version }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockAppVersionByIdQueryAppManagement = (
  resolver: GraphQLResponseResolver<AppVersionByIdQuery, AppVersionByIdQueryVariables>,
  options?: RequestHandlerOptions,
) => appManagement.query<AppVersionByIdQuery, AppVersionByIdQueryVariables>('AppVersionById', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockAppVersionByTagQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { versionTag } = variables;
 *     return HttpResponse.json({
 *       data: { versionByTag }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockAppVersionByTagQueryAppManagement = (
  resolver: GraphQLResponseResolver<AppVersionByTagQuery, AppVersionByTagQueryVariables>,
  options?: RequestHandlerOptions,
) => appManagement.query<AppVersionByTagQuery, AppVersionByTagQueryVariables>('AppVersionByTag', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockAppVersionsQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { appId } = variables;
 *     return HttpResponse.json({
 *       data: { app, versions }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockAppVersionsQueryAppManagement = (
  resolver: GraphQLResponseResolver<AppVersionsQuery, AppVersionsQueryVariables>,
  options?: RequestHandlerOptions,
) => appManagement.query<AppVersionsQuery, AppVersionsQueryVariables>('AppVersions', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockListAppsQueryAppManagement(
 *   ({ query, variables }) => {
 *     const { query } = variables;
 *     return HttpResponse.json({
 *       data: { appsConnection }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockListAppsQueryAppManagement = (
  resolver: GraphQLResponseResolver<ListAppsQuery, ListAppsQueryVariables>,
  options?: RequestHandlerOptions,
) => appManagement.query<ListAppsQuery, ListAppsQueryVariables>('listApps', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockCreateAppVersionMutationAppManagement(
 *   ({ query, variables }) => {
 *     const { appId, appSource, name, metadata } = variables;
 *     return HttpResponse.json({
 *       data: { appVersionCreate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockCreateAppVersionMutationAppManagement = (
  resolver: GraphQLResponseResolver<CreateAppVersionMutation, CreateAppVersionMutationVariables>,
  options?: RequestHandlerOptions,
) =>
  appManagement.mutation<CreateAppVersionMutation, CreateAppVersionMutationVariables>(
    'CreateAppVersion',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockCreateAppMutationAppManagement(
 *   ({ query, variables }) => {
 *     const { initialVersion } = variables;
 *     return HttpResponse.json({
 *       data: { appCreate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockCreateAppMutationAppManagement = (
  resolver: GraphQLResponseResolver<CreateAppMutation, CreateAppMutationVariables>,
  options?: RequestHandlerOptions,
) => appManagement.mutation<CreateAppMutation, CreateAppMutationVariables>('CreateApp', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockCreateAssetUrlMutationAppManagement(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { appRequestSourceUploadUrl }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockCreateAssetUrlMutationAppManagement = (
  resolver: GraphQLResponseResolver<CreateAssetUrlMutation, CreateAssetUrlMutationVariables>,
  options?: RequestHandlerOptions,
) =>
  appManagement.mutation<CreateAssetUrlMutation, CreateAssetUrlMutationVariables>('CreateAssetURL', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockReleaseVersionMutationAppManagement(
 *   ({ query, variables }) => {
 *     const { appId, versionId } = variables;
 *     return HttpResponse.json({
 *       data: { appReleaseCreate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockReleaseVersionMutationAppManagement = (
  resolver: GraphQLResponseResolver<ReleaseVersionMutation, ReleaseVersionMutationVariables>,
  options?: RequestHandlerOptions,
) =>
  appManagement.mutation<ReleaseVersionMutation, ReleaseVersionMutationVariables>('ReleaseVersion', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockFetchSpecificationsQueryAppManagement(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { specifications }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockFetchSpecificationsQueryAppManagement = (
  resolver: GraphQLResponseResolver<FetchSpecificationsQuery, FetchSpecificationsQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  appManagement.query<FetchSpecificationsQuery, FetchSpecificationsQueryVariables>(
    'fetchSpecifications',
    resolver,
    options,
  )
