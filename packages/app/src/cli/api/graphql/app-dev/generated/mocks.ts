/* eslint-disable @typescript-eslint/no-unused-vars, tsdoc/syntax, @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention */
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
}

type DevSessionCreateMutationVariables = Exact<{
  appId: Scalars['String']['input']
  assetsUrl: Scalars['String']['input']
}>

type DevSessionCreateMutation = {
  devSessionCreate?: {
    userErrors: {message: string; on: JsonMapType; field?: string[] | null; category: string}[]
  } | null
}

type DevSessionDeleteMutationVariables = Exact<{
  appId: Scalars['String']['input']
}>

type DevSessionDeleteMutation = {devSessionDelete?: {userErrors: {message: string}[]} | null}

type DevSessionUpdateMutationVariables = Exact<{
  appId: Scalars['String']['input']
  assetsUrl: Scalars['String']['input']
}>

type DevSessionUpdateMutation = {
  devSessionUpdate?: {
    userErrors: {message: string; on: JsonMapType; field?: string[] | null; category: string}[]
  } | null
}

const appDev = graphql.link('https://app-dev.shopify-cli.mock/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockDevSessionCreateMutationAppDev(
 *   ({ query, variables }) => {
 *     const { appId, assetsUrl } = variables;
 *     return HttpResponse.json({
 *       data: { devSessionCreate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockDevSessionCreateMutationAppDev = (
  resolver: GraphQLResponseResolver<DevSessionCreateMutation, DevSessionCreateMutationVariables>,
  options?: RequestHandlerOptions,
) => appDev.mutation<DevSessionCreateMutation, DevSessionCreateMutationVariables>('DevSessionCreate', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockDevSessionDeleteMutationAppDev(
 *   ({ query, variables }) => {
 *     const { appId } = variables;
 *     return HttpResponse.json({
 *       data: { devSessionDelete }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockDevSessionDeleteMutationAppDev = (
  resolver: GraphQLResponseResolver<DevSessionDeleteMutation, DevSessionDeleteMutationVariables>,
  options?: RequestHandlerOptions,
) => appDev.mutation<DevSessionDeleteMutation, DevSessionDeleteMutationVariables>('DevSessionDelete', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockDevSessionUpdateMutationAppDev(
 *   ({ query, variables }) => {
 *     const { appId, assetsUrl } = variables;
 *     return HttpResponse.json({
 *       data: { devSessionUpdate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockDevSessionUpdateMutationAppDev = (
  resolver: GraphQLResponseResolver<DevSessionUpdateMutation, DevSessionUpdateMutationVariables>,
  options?: RequestHandlerOptions,
) => appDev.mutation<DevSessionUpdateMutation, DevSessionUpdateMutationVariables>('DevSessionUpdate', resolver, options)
