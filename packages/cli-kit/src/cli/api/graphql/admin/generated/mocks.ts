/* eslint-disable @typescript-eslint/no-unused-vars, tsdoc/syntax, @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention */
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
   * An Amazon Web Services Amazon Resource Name (ARN), including the Region and account ID.
   * For more information, refer to [Amazon Resource Names](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html).
   */
  ARN: {input: unknown; output: unknown}
  /**
   * Represents non-fractional signed whole numeric values. Since the value may
   * exceed the size of a 32-bit integer, it's encoded as a string.
   */
  BigInt: {input: unknown; output: unknown}
  /**
   * A string containing a hexadecimal representation of a color.
   *
   * For example, "#6A8D48".
   */
  Color: {input: unknown; output: unknown}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date string.
   * For example, September 7, 2019 is represented as `"2019-07-16"`.
   */
  Date: {input: unknown; output: unknown}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: {input: unknown; output: unknown}
  /**
   * A signed decimal number, which supports arbitrary precision and is serialized as a string.
   *
   * Example values: `"29.99"`, `"29.999"`.
   */
  Decimal: {input: unknown; output: unknown}
  /**
   * A string containing a strict subset of HTML code. Non-allowed tags will be stripped out.
   * Allowed tags:
   * * `a` (allowed attributes: `href`, `target`)
   * * `b`
   * * `br`
   * * `em`
   * * `i`
   * * `strong`
   * * `u`
   * Use [HTML](https://shopify.dev/api/admin-graphql/latest/scalars/HTML) instead if you need to
   * include other HTML tags.
   *
   * Example value: `"Your current domain is <strong>example.myshopify.com</strong>."`
   */
  FormattedString: {input: unknown; output: unknown}
  /**
   * A string containing HTML code. Refer to the [HTML spec](https://html.spec.whatwg.org/#elements-3) for a
   * complete list of HTML elements.
   *
   * Example value: `"<p>Grey cotton knit sweater.</p>"`
   */
  HTML: {input: unknown; output: unknown}
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
  /** A monetary value string without a currency symbol or code. Example value: `"100.57"`. */
  Money: {input: unknown; output: unknown}
  /** A scalar value. */
  Scalar: {input: unknown; output: unknown}
  /**
   * Represents a unique identifier in the Storefront API. A `StorefrontID` value can
   * be used wherever an ID is expected in the Storefront API.
   *
   * Example value: `"Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0LzEwMDc5Nzg1MTAw"`.
   */
  StorefrontID: {input: unknown; output: unknown}
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: unknown; output: unknown}
  /**
   * An unsigned 64-bit integer. Represents whole numeric values between 0 and 2^64 - 1 encoded as a string of base-10 digits.
   *
   * Example value: `"50"`.
   */
  UnsignedInt64: {input: unknown; output: unknown}
  /**
   * Time between UTC time and a location's observed time, in the format `"+HH:MM"` or `"-HH:MM"`.
   *
   * Example value: `"-07:00"`.
   */
  UtcOffset: {input: unknown; output: unknown}
}

/** Possible types of a metafield's owner resource. */
type MetafieldOwnerType =
  /** The Api Permission metafield owner type. */
  | 'API_PERMISSION'
  /** The Article metafield owner type. */
  | 'ARTICLE'
  /** The Blog metafield owner type. */
  | 'BLOG'
  /** The Cart Transform metafield owner type. */
  | 'CARTTRANSFORM'
  /** The Collection metafield owner type. */
  | 'COLLECTION'
  /** The Company metafield owner type. */
  | 'COMPANY'
  /** The Company Location metafield owner type. */
  | 'COMPANY_LOCATION'
  /** The Customer metafield owner type. */
  | 'CUSTOMER'
  /** The Delivery Customization metafield owner type. */
  | 'DELIVERY_CUSTOMIZATION'
  /** The Delivery Method metafield owner type. */
  | 'DELIVERY_METHOD'
  /** The Delivery Option Generator metafield owner type. */
  | 'DELIVERY_OPTION_GENERATOR'
  /** The Discount metafield owner type. */
  | 'DISCOUNT'
  /** The draft order metafield owner type. */
  | 'DRAFTORDER'
  /** The Fulfillment Constraint Rule metafield owner type. */
  | 'FULFILLMENT_CONSTRAINT_RULE'
  /** The Gate Configuration metafield owner type. */
  | 'GATE_CONFIGURATION'
  /** The GiftCardTransaction metafield owner type. */
  | 'GIFT_CARD_TRANSACTION'
  /** The Location metafield owner type. */
  | 'LOCATION'
  /** The Market metafield owner type. */
  | 'MARKET'
  /** The Media Image metafield owner type. */
  | 'MEDIA_IMAGE'
  /** The Order metafield owner type. */
  | 'ORDER'
  /** The Order Routing Location Rule metafield owner type. */
  | 'ORDER_ROUTING_LOCATION_RULE'
  /** The Page metafield owner type. */
  | 'PAGE'
  /** The Payment Customization metafield owner type. */
  | 'PAYMENT_CUSTOMIZATION'
  /** The Product metafield owner type. */
  | 'PRODUCT'
  /** The Product Variant metafield owner type. */
  | 'PRODUCTVARIANT'
  /** The Selling Plan metafield owner type. */
  | 'SELLING_PLAN'
  /** The Shop metafield owner type. */
  | 'SHOP'
  /** The Validation metafield owner type. */
  | 'VALIDATION'

/** The input fields for the theme file body. */
type OnlineStoreThemeFileBodyInput = {
  /** The input type of the theme file body. */
  type: OnlineStoreThemeFileBodyInputType
  /** The body of the theme file. */
  value: Scalars['String']['input']
}

/** The input type for a theme file body. */
type OnlineStoreThemeFileBodyInputType =
  /** The base64 encoded body of a theme file. */
  | 'BASE64'
  /** The text body of the theme file. */
  | 'TEXT'
  /** The url of the body of a theme file. */
  | 'URL'

/** Type of a theme file operation result. */
type OnlineStoreThemeFileResultType =
  /** Operation was malformed or invalid. */
  | 'BAD_REQUEST'
  /** Operation faced a conflict with the current state of the file. */
  | 'CONFLICT'
  /** Operation encountered an error. */
  | 'ERROR'
  /** Operation file could not be found. */
  | 'NOT_FOUND'
  /** Operation was successful. */
  | 'SUCCESS'
  /** Operation timed out. */
  | 'TIMEOUT'
  /** Operation could not be processed due to issues with input data. */
  | 'UNPROCESSABLE_ENTITY'

/** The input fields for the file to create or update. */
type OnlineStoreThemeFilesUpsertFileInput = {
  /** The body of the theme file. */
  body: OnlineStoreThemeFileBodyInput
  /** The filename of the theme file. */
  filename: Scalars['String']['input']
}

/** Possible error codes that can be returned by `OnlineStoreThemeFilesUserErrors`. */
type OnlineStoreThemeFilesUserErrorsCode =
  /** Access denied. */
  | 'ACCESS_DENIED'
  /** There are files with the same filename. */
  | 'DUPLICATE_FILE_INPUT'
  /** Error. */
  | 'ERROR'
  /** The file is invalid. */
  | 'FILE_VALIDATION_ERROR'
  /** The input value should be less than or equal to the maximum value allowed. */
  | 'LESS_THAN_OR_EQUAL_TO'
  /** The record with the ID used as the input value couldn't be found. */
  | 'NOT_FOUND'
  /** There are theme files with conflicts. */
  | 'THEME_FILES_CONFLICT'
  /** This action is not available on your current plan. Please upgrade to access theme editing features. */
  | 'THEME_LIMITED_PLAN'
  /** Too many updates in a short period. Please try again later. */
  | 'THROTTLED'

/** The input fields for Theme attributes to update. */
type OnlineStoreThemeInput = {
  /** The new name of the theme. */
  name?: InputMaybe<Scalars['String']['input']>
}

/** The role of the theme. */
type ThemeRole =
  /**
   * The theme is archived if a merchant changes their plan and exceeds the maximum
   * number of themes allowed. Archived themes can be downloaded by merchant, but
   * can not be customized or published until the plan is upgraded.
   */
  | 'ARCHIVED'
  /**
   * The theme is installed as a trial from the Shopify Theme Store. It can be
   * customized using the theme editor, but access to the code editor and the
   * ability to publish the theme are restricted until it is purchased.
   */
  | 'DEMO'
  /** The theme is automatically created by the CLI for previewing purposes when in a development session. */
  | 'DEVELOPMENT'
  /**
   * The theme is locked if it is identified as unlicensed. Customization and
   * publishing are restricted until the merchant resolves the licensing issue.
   */
  | 'LOCKED'
  /** The currently published theme. There can only be one main theme at any time. */
  | 'MAIN'
  /** The currently published theme that is only accessible to a mobile client. */
  | 'MOBILE'
  /** The theme is currently not published. It can be transitioned to the main role if it is published by the merchant. */
  | 'UNPUBLISHED'

type ThemeCreateMutationVariables = Exact<{
  name: Scalars['String']['input']
  source: Scalars['URL']['input']
  role: ThemeRole
}>

type ThemeCreateMutation = {
  themeCreate?: {
    theme?: {id: string; name: string; role: ThemeRole} | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

type ThemeDeleteMutationVariables = Exact<{
  id: Scalars['ID']['input']
}>

type ThemeDeleteMutation = {
  themeDelete?: {
    deletedThemeId?: string | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

type ThemeFilesDeleteMutationVariables = Exact<{
  themeId: Scalars['ID']['input']
  files: Scalars['String']['input'][] | Scalars['String']['input']
}>

type ThemeFilesDeleteMutation = {
  themeFilesDelete?: {
    deletedThemeFiles?: {filename: string}[] | null
    userErrors: {filename?: string | null; code?: OnlineStoreThemeFilesUserErrorsCode | null; message: string}[]
  } | null
}

type ThemeFilesUpsertMutationVariables = Exact<{
  files: OnlineStoreThemeFilesUpsertFileInput[] | OnlineStoreThemeFilesUpsertFileInput
  themeId: Scalars['ID']['input']
}>

type ThemeFilesUpsertMutation = {
  themeFilesUpsert?: {
    upsertedThemeFiles?: {filename: string}[] | null
    userErrors: {filename?: string | null; message: string}[]
  } | null
}

type ThemePublishMutationVariables = Exact<{
  id: Scalars['ID']['input']
}>

type ThemePublishMutation = {
  themePublish?: {
    theme?: {id: string; name: string; role: ThemeRole} | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

type ThemeUpdateMutationVariables = Exact<{
  id: Scalars['ID']['input']
  input: OnlineStoreThemeInput
}>

type ThemeUpdateMutation = {
  themeUpdate?: {
    theme?: {id: string; name: string; role: ThemeRole} | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

type GetThemeQueryVariables = Exact<{
  id: Scalars['ID']['input']
}>

type GetThemeQuery = {theme?: {id: string; name: string; role: ThemeRole; processing: boolean} | null}

type GetThemeFileBodiesQueryVariables = Exact<{
  id: Scalars['ID']['input']
  after?: InputMaybe<Scalars['String']['input']>
  filenames?: InputMaybe<Scalars['String']['input'][] | Scalars['String']['input']>
}>

type GetThemeFileBodiesQuery = {
  theme?: {
    files?: {
      nodes: {
        filename: string
        size: unknown
        checksumMd5?: string | null
        body:
          | {__typename: 'OnlineStoreThemeFileBodyBase64'; contentBase64: string}
          | {__typename: 'OnlineStoreThemeFileBodyText'; content: string}
          | {__typename: 'OnlineStoreThemeFileBodyUrl'; url: string}
      }[]
      userErrors: {filename: string; code: OnlineStoreThemeFileResultType}[]
      pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    } | null
  } | null
}

type GetThemeFileChecksumsQueryVariables = Exact<{
  id: Scalars['ID']['input']
  after?: InputMaybe<Scalars['String']['input']>
}>

type GetThemeFileChecksumsQuery = {
  theme?: {
    files?: {
      nodes: {filename: string; size: unknown; checksumMd5?: string | null}[]
      userErrors: {filename: string; code: OnlineStoreThemeFileResultType}[]
      pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    } | null
  } | null
}

type GetThemesQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>
}>

type GetThemesQuery = {
  themes?: {
    nodes: {id: string; name: string; role: ThemeRole; processing: boolean}[]
    pageInfo: {hasNextPage: boolean; endCursor?: string | null}
  } | null
}

type MetafieldDefinitionsByOwnerTypeQueryVariables = Exact<{
  ownerType: MetafieldOwnerType
}>

type MetafieldDefinitionsByOwnerTypeQuery = {
  metafieldDefinitions: {
    nodes: {
      key: string
      name: string
      namespace: string
      description?: string | null
      type: {category: string; name: string}
    }[]
  }
}

type OnlineStorePasswordProtectionQueryVariables = Exact<{[key: string]: never}>

type OnlineStorePasswordProtectionQuery = {onlineStore: {passwordProtection: {enabled: boolean}}}

type PublicApiVersionsQueryVariables = Exact<{[key: string]: never}>

type PublicApiVersionsQuery = {publicApiVersions: {handle: string; supported: boolean}[]}

const admin = graphql.link('https://admin.shopify-cli.mock/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemeCreateMutationAdmin(
 *   ({ query, variables }) => {
 *     const { name, source, role } = variables;
 *     return HttpResponse.json({
 *       data: { themeCreate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemeCreateMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemeCreateMutation, ThemeCreateMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemeCreateMutation, ThemeCreateMutationVariables>('themeCreate', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemeDeleteMutationAdmin(
 *   ({ query, variables }) => {
 *     const { id } = variables;
 *     return HttpResponse.json({
 *       data: { themeDelete }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemeDeleteMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemeDeleteMutation, ThemeDeleteMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemeDeleteMutation, ThemeDeleteMutationVariables>('themeDelete', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemeFilesDeleteMutationAdmin(
 *   ({ query, variables }) => {
 *     const { themeId, files } = variables;
 *     return HttpResponse.json({
 *       data: { themeFilesDelete }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemeFilesDeleteMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemeFilesDeleteMutation, ThemeFilesDeleteMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemeFilesDeleteMutation, ThemeFilesDeleteMutationVariables>('themeFilesDelete', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemeFilesUpsertMutationAdmin(
 *   ({ query, variables }) => {
 *     const { files, themeId } = variables;
 *     return HttpResponse.json({
 *       data: { themeFilesUpsert }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemeFilesUpsertMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemeFilesUpsertMutation, ThemeFilesUpsertMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemeFilesUpsertMutation, ThemeFilesUpsertMutationVariables>('themeFilesUpsert', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemePublishMutationAdmin(
 *   ({ query, variables }) => {
 *     const { id } = variables;
 *     return HttpResponse.json({
 *       data: { themePublish }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemePublishMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemePublishMutation, ThemePublishMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemePublishMutation, ThemePublishMutationVariables>('themePublish', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockThemeUpdateMutationAdmin(
 *   ({ query, variables }) => {
 *     const { id, input } = variables;
 *     return HttpResponse.json({
 *       data: { themeUpdate }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockThemeUpdateMutationAdmin = (
  resolver: GraphQLResponseResolver<ThemeUpdateMutation, ThemeUpdateMutationVariables>,
  options?: RequestHandlerOptions,
) => admin.mutation<ThemeUpdateMutation, ThemeUpdateMutationVariables>('themeUpdate', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetThemeQueryAdmin(
 *   ({ query, variables }) => {
 *     const { id } = variables;
 *     return HttpResponse.json({
 *       data: { theme }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetThemeQueryAdmin = (
  resolver: GraphQLResponseResolver<GetThemeQuery, GetThemeQueryVariables>,
  options?: RequestHandlerOptions,
) => admin.query<GetThemeQuery, GetThemeQueryVariables>('getTheme', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetThemeFileBodiesQueryAdmin(
 *   ({ query, variables }) => {
 *     const { id, after, filenames } = variables;
 *     return HttpResponse.json({
 *       data: { theme }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetThemeFileBodiesQueryAdmin = (
  resolver: GraphQLResponseResolver<GetThemeFileBodiesQuery, GetThemeFileBodiesQueryVariables>,
  options?: RequestHandlerOptions,
) => admin.query<GetThemeFileBodiesQuery, GetThemeFileBodiesQueryVariables>('getThemeFileBodies', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetThemeFileChecksumsQueryAdmin(
 *   ({ query, variables }) => {
 *     const { id, after } = variables;
 *     return HttpResponse.json({
 *       data: { theme }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetThemeFileChecksumsQueryAdmin = (
  resolver: GraphQLResponseResolver<GetThemeFileChecksumsQuery, GetThemeFileChecksumsQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  admin.query<GetThemeFileChecksumsQuery, GetThemeFileChecksumsQueryVariables>(
    'getThemeFileChecksums',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetThemesQueryAdmin(
 *   ({ query, variables }) => {
 *     const { after } = variables;
 *     return HttpResponse.json({
 *       data: { themes }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetThemesQueryAdmin = (
  resolver: GraphQLResponseResolver<GetThemesQuery, GetThemesQueryVariables>,
  options?: RequestHandlerOptions,
) => admin.query<GetThemesQuery, GetThemesQueryVariables>('getThemes', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockMetafieldDefinitionsByOwnerTypeQueryAdmin(
 *   ({ query, variables }) => {
 *     const { ownerType } = variables;
 *     return HttpResponse.json({
 *       data: { metafieldDefinitions }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockMetafieldDefinitionsByOwnerTypeQueryAdmin = (
  resolver: GraphQLResponseResolver<
    MetafieldDefinitionsByOwnerTypeQuery,
    MetafieldDefinitionsByOwnerTypeQueryVariables
  >,
  options?: RequestHandlerOptions,
) =>
  admin.query<MetafieldDefinitionsByOwnerTypeQuery, MetafieldDefinitionsByOwnerTypeQueryVariables>(
    'metafieldDefinitionsByOwnerType',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockOnlineStorePasswordProtectionQueryAdmin(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { onlineStore }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockOnlineStorePasswordProtectionQueryAdmin = (
  resolver: GraphQLResponseResolver<OnlineStorePasswordProtectionQuery, OnlineStorePasswordProtectionQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  admin.query<OnlineStorePasswordProtectionQuery, OnlineStorePasswordProtectionQueryVariables>(
    'OnlineStorePasswordProtection',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockPublicApiVersionsQueryAdmin(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { publicApiVersions }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockPublicApiVersionsQueryAdmin = (
  resolver: GraphQLResponseResolver<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>,
  options?: RequestHandlerOptions,
) => admin.query<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>('publicApiVersions', resolver, options)
