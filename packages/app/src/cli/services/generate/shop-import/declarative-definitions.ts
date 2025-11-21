/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import {FieldObject, Metafield, MetafieldOwners, MetaObject, ValidationRule} from './dcdd.js'
import {OrganizationApp, OrganizationStore} from '../../../models/organization.js'
import {
  MetafieldDefinitions,
  MetafieldForImportFragment,
} from '../../../api/graphql/admin/generated/metafield_definitions.js'
import {adminAsAppRequestDoc} from '../../../api/admin-as-app.js'
import {
  MetaobjectForImportFragment,
  MetaobjectDefinitions,
} from '../../../api/graphql/admin/generated/metaobject_definitions.js'
import {
  MetafieldAdminAccess,
  MetafieldCustomerAccountAccess,
  MetafieldOwnerType,
  MetafieldStorefrontAccess,
  MetaobjectAdminAccess,
  MetaobjectStorefrontAccess,
} from '../../../api/graphql/admin/generated/types.js'
import {CurrentAppConfiguration} from '../../../models/app/app.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {AdminSession, ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {Variables} from 'graphql-request'
import {updateTomlValues} from '@shopify/toml-patch'
import {renderInfo, renderSingleTask, renderTasks} from '@shopify/cli-kit/node/ui'
import {isEmpty} from '@shopify/cli-kit/common/object'

interface ImportDeclarativeDefinitionsOptions {
  remoteApp: OrganizationApp
  appConfiguration: CurrentAppConfiguration
  store: OrganizationStore
  includeExistingDeclaredDefinitions: boolean
}

interface ProcessNodesResult {
  tomlContent: string
  metafieldCount: number
  metaobjectCount: number
}

export interface MetafieldNodesInput {
  ownerType: MetafieldOwners
  graphQLOwner: MetafieldOwnerType
  items: MetafieldForImportFragment[]
}

interface ResultWithPageInfo<TNodes> {
  pageInfo: {hasNextPage: boolean; endCursor?: string | null}
  nodes: TNodes[]
}

interface PaginatedQueryOptions<TResult, TVariables extends Variables, TNodes> {
  query: TypedDocumentNode<TResult, TVariables>
  session: AdminSession
  toNodes: (res: TResult) => ResultWithPageInfo<TNodes>
  toVariables: (cursor: string | undefined | null) => TVariables
  performQuery?: (variables: TVariables) => Promise<TResult>
}

type PaginatedQueryResult<TNodes> =
  | {
      status: 'ok'
      items: TNodes[]
    }
  | {
      status: 'scope_error'
    }

const DCDD_OWNER_TO_GRAPHQL_MAPPING: {
  [key in MetafieldOwners]?: MetafieldOwnerType
} = {
  article: 'ARTICLE',
  blog: 'BLOG',
  collection: 'COLLECTION',
  company: 'COMPANY',
  company_location: 'COMPANY_LOCATION',
  location: 'LOCATION',
  market: 'MARKET',
  order: 'ORDER',
  page: 'PAGE',
  product: 'PRODUCT',
  customer: 'CUSTOMER',
  delivery_customization: 'DELIVERY_CUSTOMIZATION',
  delivery_method: 'DELIVERY_METHOD',
  delivery_option_generator: 'DELIVERY_OPTION_GENERATOR',
  discount: 'DISCOUNT',
  draft_order: 'DRAFTORDER',
  fulfillment_constraint_rule: 'FULFILLMENT_CONSTRAINT_RULE',
  gift_card_transaction: 'GIFT_CARD_TRANSACTION',
  order_routing_location_rule: 'ORDER_ROUTING_LOCATION_RULE',
  payment_customization: 'PAYMENT_CUSTOMIZATION',
  selling_plan: 'SELLING_PLAN',
  shop: 'SHOP',
  validation: 'VALIDATION',
  variant: 'PRODUCTVARIANT',
  cart_transform: 'CARTTRANSFORM',
}

export async function paginatedQuery<TResult, TVariables extends Variables, TNodes>({
  query,
  session,
  toNodes,
  toVariables,
  performQuery = (variables) => adminAsAppRequestDoc({query, session, variables, autoRateLimitRestore: true}),
}: PaginatedQueryOptions<TResult, TVariables, TNodes>): Promise<PaginatedQueryResult<TNodes>> {
  let cursor: string | undefined | null
  try {
    let res = toNodes(await performQuery(toVariables(cursor)))

    const allResults: TNodes[] = []
    allResults.push(...res.nodes)
    while (res.pageInfo.hasNextPage) {
      cursor = res.pageInfo.endCursor

      // eslint-disable-next-line no-await-in-loop
      res = toNodes(await performQuery(toVariables(cursor)))
      allResults.push(...res.nodes)
    }
    return {status: 'ok', items: allResults}
  } catch (error) {
    if (error instanceof Error && error.message.includes('ACCESS_DENIED')) {
      return {status: 'scope_error'}
    }
    throw error
  }
}

function patchesToToml(patches: Patch[], comment: string) {
  let tomlContent = ''
  for (const patch of patches) {
    tomlContent = updateTomlValues(tomlContent, patch)
  }
  return `# ${comment}\n${tomlContent}`
}

export function processDeclarativeDefinitionNodes(
  metafieldNodes: MetafieldNodesInput[],
  metaobjectNodes: MetaobjectForImportFragment[],
): ProcessNodesResult {
  const metaobjectTomls = metaobjectNodes
    .map(convertMetaobject)
    .map((result) => {
      switch (result.status) {
        case 'ok': {
          const {typeName, patches} = result
          return patchesToToml(patches, `type: $app:${typeName}`)
        }
        case 'not_app_reserved': {
          return null
        }
      }
    })
    .filter((item) => item !== null)

  const metafieldTomls = metafieldNodes
    .flatMap(({items, ownerType, graphQLOwner}) =>
      items.map((node) => ({
        result: convertMetafield(node, ownerType),
        graphQLOwner,
      })),
    )
    .map(({result, graphQLOwner}) => {
      switch (result.status) {
        case 'ok': {
          const {namespace, key, patches: metafieldPatches} = result
          return patchesToToml(
            metafieldPatches,
            `namespace: ${namespace === 'app' ? '$app' : `$app:${namespace}`} key: ${key} owner_type: ${graphQLOwner}`,
          )
        }
        case 'not_app_reserved': {
          return null
        }
      }
    })
    .filter((item) => item !== null)

  const tomlContent = [...metaobjectTomls, ...metafieldTomls].join('\n')

  return {
    tomlContent,
    metafieldCount: metafieldTomls.length,
    metaobjectCount: metaobjectTomls.length,
  }
}

export async function importDeclarativeDefinitions(options: ImportDeclarativeDefinitionsOptions) {
  const adminSession = await createAdminApiSessionForShop(options)
  const shopName = adminSession.storeFqdn

  let metafieldNodes: MetafieldNodesInput[] = await loadMetafieldNodes(adminSession)
  let metaobjectNodes: MetaobjectForImportFragment[] = await loadMetaobjectNodes(adminSession)

  if (!options.includeExistingDeclaredDefinitions) {
    metafieldNodes = filterOutDeclaredMetafields(metafieldNodes, options.appConfiguration)
    metaobjectNodes = filterOutDeclaredMetaobjects(metaobjectNodes, options.appConfiguration)
  }

  const {tomlContent, metafieldCount, metaobjectCount} = processDeclarativeDefinitionNodes(
    metafieldNodes,
    metaobjectNodes,
  )

  renderConversionSummary(metafieldCount, metaobjectCount, shopName, tomlContent)
}

type ConvertedMetafield =
  | {
      status: 'ok'
      namespace: string
      key: string
      patches: Patch[]
    }
  | {
      status: 'not_app_reserved'
    }

function renderConversionSummary(
  metafieldCount: number,
  metaobjectCount: number,
  shopName: string,
  tomlContent: string,
) {
  renderInfo({
    headline: 'Conversion to TOML complete.',
    body: [
      'Converted',
      {
        warn: `${metafieldCount} metafields`,
      },
      'and',
      {
        warn: `${metaobjectCount} metaobjects`,
      },
      'from',
      {
        warn: shopName,
      },
      'into TOML, ready for you to copy.',
    ],
    orderedNextSteps: true,
    nextSteps: [
      'Review the suggested TOML carefully before applying.',
      [
        'Missing sections? Make sure your app has the required access scopes to load metafields and metaobjects (e.g.',
        {
          command: 'read_customers',
        },
        'to load customer metafields,',
        {
          command: 'read_metaobject_definitions',
        },
        'to load metaobjects.)',
      ],
      [
        'Missing definitions? Only metafields and metaobjects that are app-reserved (using',
        {
          command: '$app',
        },
        ') will be converted.',
      ],
      [
        "When you're ready, add the generated TOML to your app's configuration file and test out changes with the",
        {
          command: 'shopify app dev',
        },
        'command.',
      ],
    ],
  })

  renderTomlStringWithFormatting(tomlContent)
}

async function loadMetafieldNodes(adminSession: AdminSession): Promise<MetafieldNodesInput[]> {
  const metafieldLoadResults: {
    metafields: PaginatedQueryResult<MetafieldForImportFragment>
    ownerType: MetafieldOwners
    graphQLOwner: MetafieldOwnerType
  }[] = []

  await renderTasks(
    Object.entries(DCDD_OWNER_TO_GRAPHQL_MAPPING).map(([dcddOwner, graphQLOwner]) => ({
      title: outputContent`Loading ${outputToken.green(dcddOwner)} metafields`,
      task: async () => {
        const metafields = await paginatedQuery({
          query: MetafieldDefinitions,
          session: adminSession,
          toNodes: (res) => res.metafieldDefinitions,
          toVariables: (cursor) => ({
            ownerType: graphQLOwner,
            after: cursor,
          }),
        })
        metafieldLoadResults.push({
          metafields,
          ownerType: dcddOwner as MetafieldOwners,
          graphQLOwner,
        })
      },
    })),
  )

  return metafieldLoadResults
    .map(({metafields, ownerType, graphQLOwner}) => {
      if (metafields.status === 'ok') {
        return {
          ownerType,
          items: metafields.items,
          graphQLOwner,
        }
      }
      return null
    })
    .filter((item) => item !== null)
}

async function loadMetaobjectNodes(adminSession: AdminSession): Promise<MetaobjectForImportFragment[]> {
  const metaobjects = await renderSingleTask({
    title: outputContent`Loading ${outputToken.green('metaobjects')}`,
    task: async () => {
      return paginatedQuery({
        query: MetaobjectDefinitions,
        session: adminSession,
        toNodes: (res) => res.metaobjectDefinitions,
        toVariables: (cursor) => ({
          after: cursor,
        }),
      })
    },
  })
  return metaobjects.status === 'ok' ? metaobjects.items : []
}

function filterOutDeclaredMetafields(
  metafields: MetafieldNodesInput[],
  appConfiguration: unknown,
): MetafieldNodesInput[] {
  return metafields
    .map((input) => {
      const filteredItems = input.items.filter((item) => {
        return !appConfigurationContains(appConfiguration, [
          input.ownerType,
          'metafields',
          simplifyAppReservedNamespace(item.namespace) ?? '',
          item.key,
        ])
      })
      if (filteredItems.length > 0) {
        return {
          ...input,
          items: filteredItems,
        }
      }
      return null
    })
    .filter((item) => item !== null)
}

function filterOutDeclaredMetaobjects(
  metaobjects: MetaobjectForImportFragment[],
  appConfiguration: unknown,
): MetaobjectForImportFragment[] {
  return metaobjects.filter((input) => {
    return !appConfigurationContains(appConfiguration, [
      'metaobjects',
      'app',
      simplifyAppReservedNamespace(input.type) ?? '',
    ])
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appConfigurationContains(appConfiguration: any, path: string[]): boolean {
  let current = appConfiguration
  for (const key of path) {
    if (!current[key]) {
      return false
    }
    current = current[key]
  }
  return true
}

async function createAdminApiSessionForShop(options: ImportDeclarativeDefinitionsOptions) {
  const {remoteApp, store} = options

  const appSecret = remoteApp.apiSecretKeys[0]?.secret

  if (!appSecret) {
    throw new BugError('No API secret keys found for app')
  }

  const adminSession = await ensureAuthenticatedAdminAsApp(store.shopDomain, remoteApp.apiKey, appSecret)
  return adminSession
}

function simplifyAppReservedNamespace(namespace: string): string | null {
  if (!namespace.match(/^app--\d+/)) {
    return null
  }
  let result = 'app'
  if (namespace.match(/^app--\d+--/)) {
    result = namespace.replace(/^app--\d+--/, '')
  }
  return result
}

function convertMetafield(node: MetafieldForImportFragment, ownerType: MetafieldOwners): ConvertedMetafield {
  const namespace = simplifyAppReservedNamespace(node.namespace)
  if (!namespace) {
    return {status: 'not_app_reserved'}
  }

  const key = node.key
  const metafield = nodeToMetafield(node)
  const patches = metafieldToPatches(metafield, ownerType, namespace, key)

  return {
    status: 'ok',
    key,
    namespace,
    patches,
  }
}

type ConvertedMetaobject =
  | {
      status: 'ok'
      typeName: string
      patches: Patch[]
    }
  | {
      status: 'not_app_reserved'
    }

function convertMetaobject(node: MetaobjectForImportFragment): ConvertedMetaobject {
  const typeName = simplifyAppReservedNamespace(node.type)
  if (!typeName) {
    return {status: 'not_app_reserved'}
  }

  const metaobject = nodeToMetaobject(node, typeName)
  const patches = metaobjectToPatches(metaobject, typeName)

  return {
    status: 'ok',
    typeName,
    patches,
  }
}

function nodeToMetafield(node: MetafieldForImportFragment): Metafield {
  const res = {
    name: node.name === node.key ? undefined : node.name,
    type: node.type.name,
    description: node.description ?? undefined,
    capabilities: undefinedIfEmptyObject({
      admin_filterable: node.capabilities.adminFilterable.enabled || undefined,
    }),
    access: undefinedIfEmptyObject({
      admin: graphQLToAdminAccess(node.access.admin),
      storefront: graphQLToStorefrontAccess(node.access.storefront),
      customer_account: graphQLToCustomerAccountAccess(node.access.customerAccount),
    }),
    validations: validationsNodeToObject(node.validations),
  }

  const {type, validations} = convertFieldTypeForReferenceValidations(res.type, res.validations)
  res.type = type
  res.validations = validations

  return res
}

function nodeToMetaobject(node: MetaobjectForImportFragment, typeName: string): MetaObject {
  return {
    name: node.name === typeName ? undefined : node.name,
    description: node.description ?? undefined,
    display_name_field: node.displayNameKey ?? undefined,
    access: undefinedIfEmptyObject({
      admin: graphQLToAdminAccess(node.access.admin),
      storefront: graphQLToStorefrontAccess(node.access.storefront),
    }),
    capabilities: undefinedIfEmptyObject({
      translatable: node.capabilities.translatable.enabled || undefined,
      publishable: node.capabilities.publishable.enabled || undefined,
      renderable: node.capabilities.renderable?.enabled || undefined,
      renderable_meta_title_field: node.capabilities.renderable?.data?.metaTitleKey ?? undefined,
      renderable_meta_description_field: node.capabilities.renderable?.data?.metaDescriptionKey ?? undefined,
    }),
    fields: Object.fromEntries(
      node.fieldDefinitions.map((field) => {
        const fieldObject: FieldObject = {
          type: field.type.name,
          description: field.description ?? undefined,
          name: field.name === field.key ? undefined : field.name,
          required: field.required || undefined,
          validations: validationsNodeToObject(field.validations),
        }

        const {type, validations} = convertFieldTypeForReferenceValidations(fieldObject.type, fieldObject.validations)
        fieldObject.type = type
        fieldObject.validations = validations

        return [field.key, fieldObject]
      }),
    ),
  }
}

function convertFieldTypeForReferenceValidations(
  type: string,
  validations: {[key: string]: unknown} | undefined,
): {
  type: string
  validations: {[key: string]: unknown} | undefined
} {
  if (!validations) {
    return {
      type,
      validations: undefined,
    }
  }

  if (validations.metaobject_definition_type && typeof validations.metaobject_definition_type === 'string') {
    const referencedType = simplifyAppReservedNamespace(validations.metaobject_definition_type)
    return {
      type: `${type}<$app:${referencedType}>`,
      validations: undefinedIfEmptyObject({
        ...validations,
        metaobject_definition_type: undefined,
      }),
    }
  }

  if (
    validations.metaobject_definition_types &&
    Array.isArray(validations.metaobject_definition_types) &&
    validations.metaobject_definition_types.every((item) => typeof item === 'string')
  ) {
    const referencedTypes = validations.metaobject_definition_types.map((item) => simplifyAppReservedNamespace(item))
    return {
      type: `${type}<${referencedTypes.map((item) => `$app:${item}`).join(',')}>`,
      validations: undefinedIfEmptyObject({
        ...validations,
        metaobject_definition_types: undefined,
      }),
    }
  }

  return {type, validations}
}

function validationsNodeToObject(validations: {name: string; value?: string | null}[]) {
  const safelyJsonParse = (value: string) => {
    try {
      return JSON.parse(value)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return value
    }
  }

  return undefinedIfEmptyObject(
    Object.fromEntries(
      validations
        .filter(
          (validation) =>
            validation.value !== undefined &&
            validation.name !== 'metaobject_definition_id' &&
            validation.name !== 'metaobject_definition_ids',
        )
        .map((validation) => [validation.name, validation.value ? safelyJsonParse(validation.value) : undefined]),
    ),
  )
}

function metafieldToPatches(metafield: Metafield, ownerType: MetafieldOwners, namespace: string, key: string): Patch[] {
  const firstBatch: Patch = [
    [[ownerType, 'metafields', namespace, key, 'name'], metafield.name],
    [[ownerType, 'metafields', namespace, key, 'type'], metafield.type],
    [[ownerType, 'metafields', namespace, key, 'description'], metafield.description],
  ]
  const secondBatch: Patch = [
    [[ownerType, 'metafields', namespace, key, 'access', 'admin'], metafield.access?.admin],
    [[ownerType, 'metafields', namespace, key, 'access', 'storefront'], metafield.access?.storefront],
    [[ownerType, 'metafields', namespace, key, 'access', 'customer_account'], metafield.access?.customer_account],
    [
      [ownerType, 'metafields', namespace, key, 'capabilities', 'admin_filterable'],
      metafield.capabilities?.admin_filterable || undefined,
    ],
  ]

  if (metafield.validations) {
    const validationKeysAndValuesToPush = getValidationValuesForPatch(metafield.validations)

    validationKeysAndValuesToPush.forEach(({validationKey, actualValue}) => {
      firstBatch.push([[ownerType, 'metafields', namespace, key, 'validations', validationKey], actualValue])
    })
  }
  return [cleanPatch(firstBatch), cleanPatch(secondBatch)]
}

function metaobjectToPatches(metaobject: MetaObject, typeName: string): Patch[] {
  const firstBatch: Patch = [
    [['metaobjects', 'app', typeName, 'name'], metaobject.name === typeName ? undefined : metaobject.name],
    [['metaobjects', 'app', typeName, 'description'], metaobject.description],
    [['metaobjects', 'app', typeName, 'display_name_field'], metaobject.display_name_field],
  ]
  const secondBatch: Patch = [
    [['metaobjects', 'app', typeName, 'access', 'admin'], metaobject.access?.admin],
    [['metaobjects', 'app', typeName, 'access', 'storefront'], metaobject.access?.storefront],
  ]

  if (metaobject.capabilities?.translatable) {
    secondBatch.push([['metaobjects', 'app', typeName, 'capabilities', 'translatable'], true])
  }
  if (metaobject.capabilities?.publishable) {
    secondBatch.push([['metaobjects', 'app', typeName, 'capabilities', 'publishable'], true])
  }
  if (metaobject.capabilities?.renderable) {
    secondBatch.push([['metaobjects', 'app', typeName, 'capabilities', 'renderable'], true])
    if (metaobject.capabilities?.renderable_meta_title_field) {
      secondBatch.push([
        ['metaobjects', 'app', typeName, 'capabilities', 'renderable_meta_title_field'],
        metaobject.capabilities.renderable_meta_title_field,
      ])
    }
    if (metaobject.capabilities?.renderable_meta_description_field) {
      secondBatch.push([
        ['metaobjects', 'app', typeName, 'capabilities', 'renderable_meta_description_field'],
        metaobject.capabilities.renderable_meta_description_field,
      ])
    }
  }
  Object.entries(metaobject.fields).forEach(([key, value]) => {
    if (typeof value === 'string') {
      firstBatch.push([['metaobjects', 'app', typeName, 'fields', key], value])
    } else {
      // if the only thing we have is a type, then we can just use short hand
      const valuePropertiesThatAreDefined = Object.fromEntries(
        Object.entries(value).filter(([_key, value]) => value !== undefined),
      )
      if (Object.keys(valuePropertiesThatAreDefined).length === 1) {
        firstBatch.push([['metaobjects', 'app', typeName, 'fields', key], value.type])
      } else {
        firstBatch.push([['metaobjects', 'app', typeName, 'fields', key, 'type'], value.type])
        firstBatch.push([['metaobjects', 'app', typeName, 'fields', key, 'description'], value.description])
        firstBatch.push([['metaobjects', 'app', typeName, 'fields', key, 'name'], value.name])
        firstBatch.push([['metaobjects', 'app', typeName, 'fields', key, 'required'], value.required || undefined])
        if (value.validations) {
          const validationKeysAndValuesToPush = getValidationValuesForPatch(value.validations)

          validationKeysAndValuesToPush.forEach(({validationKey, actualValue}) => {
            firstBatch.push([
              ['metaobjects', 'app', typeName, 'fields', key, 'validations', validationKey],
              actualValue,
            ])
          })
        }
      }
    }
  })
  return [cleanPatch(firstBatch), cleanPatch(secondBatch)]
}

type Patch = [string[], number | string | boolean | undefined | (number | string | boolean)[]][]

function getValidationValuesForPatch(validations: ValidationRule) {
  return Object.entries(validations).map(([validationKey, value]) => {
    let actualValue: number | string | boolean | string[]
    if (typeof value === 'string') {
      actualValue = value
    } else if (typeof value === 'number') {
      actualValue = value
    } else if (typeof value === 'boolean') {
      actualValue = value
    } else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      actualValue = value
    } else {
      actualValue = JSON.stringify(value)
    }
    return {
      validationKey,
      actualValue,
    }
  })
}

export function renderTomlStringWithFormatting(tomlContent: string) {
  const lines = tomlContent.split('\n')
  for (const line of lines) {
    if (line.match(/^\s*\[/)) {
      outputInfo(outputContent`${outputToken.green(line)}`)
    } else if (line.match(/^\s*#/)) {
      outputInfo(outputContent`${outputToken.gray(line)}`)
    } else {
      outputInfo(outputContent`${line}`)
    }
  }
}

function graphQLToAdminAccess(
  access: MetaobjectAdminAccess | MetafieldAdminAccess | null | undefined,
): 'merchant_read_write' | undefined {
  switch (access) {
    case 'MERCHANT_READ_WRITE':
      return 'merchant_read_write'
    default:
      return undefined
  }
}

function graphQLToStorefrontAccess(
  access: MetaobjectStorefrontAccess | MetafieldStorefrontAccess | null | undefined,
): 'public_read' | undefined {
  switch (access) {
    case 'PUBLIC_READ':
      return 'public_read'
    default:
      return undefined
  }
}

function graphQLToCustomerAccountAccess(
  access: MetafieldCustomerAccountAccess | null | undefined,
): 'read' | 'read_write' | undefined {
  switch (access) {
    case 'READ':
      return 'read'
    case 'READ_WRITE':
      return 'read_write'
    default:
      return undefined
  }
}

function undefinedIfEmptyObject<T>(subject: T | undefined): T | undefined {
  if (!subject) {
    return undefined
  }
  if (isEmpty(subject)) {
    return undefined
  }
  if (typeof subject === 'object' && Object.values(subject).every((value) => value === undefined)) {
    return undefined
  }
  return subject
}

function cleanPatch(patch: Patch): Patch {
  return patch.filter(([_key, value]) => value !== undefined)
}
