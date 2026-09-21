import {info} from './info.js'
import {appInfoJsonOutputSchema} from './info/types.js'
import {logMetadataForLoadedContext} from './context.js'
import {
  testAppLinked,
  testOrganizationApp,
  testProject,
  testUIExtension,
  testAppConfigExtensions,
} from '../models/app/app.test-data.js'
import {OrganizationSource} from '../models/organization.js'
import {AppErrors} from '../models/app/loader.js'
import {Project} from '../models/project/project.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {expect, test, vi} from 'vitest'

vi.mock('./context.js')

const organization = {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform}

async function resultWithExtensions() {
  const uiExtension = await testUIExtension({configuration: {name: 'Example', handle: 'example', type: 'ui_extension'}})
  const configExtension = await testAppConfigExtensions()
  uiExtension.uid = 'example-uid'
  uiExtension.devUUID = 'dev-example-uid'
  configExtension.uid = 'config-uid'
  configExtension.devUUID = 'dev-config-uid'
  const errors = new AppErrors()
  errors.addError({file: '/tmp/project/shopify.app.toml', message: 'Invalid app configuration'})
  const app = testAppLinked({
    allExtensions: [uiExtension, configExtension],
    specifications: [uiExtension.specification, configExtension.specification],
    errors,
    dotenv: {path: '/tmp/project/.env', variables: {EXAMPLE: 'value'}},
    hiddenConfig: {dev_store_url: 'example.myshopify.com'},
  })
  const result = await info(
    app,
    testOrganizationApp(),
    organization,
    testProject({nodeDependencies: {example: '1.0.0'}}),
    {webEnv: false},
  )
  return {app, result}
}

test('preserves the legacy JSON payload from real app and extension instances', async () => {
  const {app, result} = await resultWithExtensions()
  const {remoteApp, account, project, system, devStoreUrl, ...legacy} = JSON.parse(
    appInfoJsonOutputSchema.encode(result),
  )
  delete legacy.organization.source
  for (const extension of [...legacy.allExtensions, ...legacy.realExtensions]) {
    for (const key of ['name', 'type', 'externalType', 'humanName', 'surface', 'features', 'dependency']) {
      delete extension[key]
    }
  }
  expect(legacy).toMatchSnapshot()
  expect(app.configSchema).toBeDefined()
  expect(app.allExtensions[0]!.specification).toHaveProperty('schema')
})

test('preserves empty collections, false, and omitted dotenv and dev URLs', async () => {
  const result = await info(testAppLinked(), testOrganizationApp(), organization, testProject(), {webEnv: false})
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  expect(json).toMatchObject({
    allExtensions: [],
    realExtensions: [],
    specifications: [],
    usesWorkspaces: false,
    nodeDependencies: {},
  })
  expect(json).not.toHaveProperty('dotenv')
  expect(json).not.toHaveProperty('devApplicationURLs')
  expect(json).not.toHaveProperty('configSchema')
})

test.each([true, false])('preserves web environment JSON with secret present: %s', async (hasSecret) => {
  const remoteApp = testOrganizationApp({apiSecretKeys: hasSecret ? [{secret: 'secret'}] : []})
  const result = await info(testAppLinked(), remoteApp, organization, testProject(), {webEnv: true})
  expect(appInfoJsonOutputSchema.encode(result)).toBe(
    hasSecret
      ? '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SHOPIFY_API_SECRET": "secret",\n  "SCOPES": "read_products"\n}'
      : '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SCOPES": "read_products"\n}',
  )
  expect(logMetadataForLoadedContext).toHaveBeenCalledWith(remoteApp, organization.source)
})

test.each([{name: null}, {usesWorkspaces: 'false'}, {organization: {id: 123, businessName: 'Example organization'}}])(
  'rejects malformed app fields: %j',
  async (invalidFields) => {
    const {result} = await resultWithExtensions()
    expect(() => appInfoJsonOutputSchema.validate({...result, ...invalidFields})).toThrow()
  },
)

test('rejects malformed web environment values', () => {
  expect(() =>
    appInfoJsonOutputSchema.validate({SHOPIFY_API_KEY: 'key', SHOPIFY_API_SECRET: null, SCOPES: ''}),
  ).toThrow()
})

test('rejects an invalid extension handle while other fields are valid', async () => {
  const {result} = await resultWithExtensions()
  if (!('name' in result)) throw new Error('Expected app information')
  expect(() =>
    appInfoJsonOutputSchema.validate({
      ...result,
      allExtensions: [{...result.allExtensions[0], handle: 123}],
    }),
  ).toThrow()
})

test('preserves dynamic configuration values and development URLs', async () => {
  const app = testAppLinked({
    configuration: structuredClone(testAppLinked().configuration),
    devApplicationURLs: {applicationUrl: 'https://example.com', redirectUrlWhitelist: ['https://example.com/auth']},
  })
  Object.defineProperty(app.configuration, 'custom', {
    value: {nullable: null, enabled: false, items: []},
    enumerable: true,
  })
  const result = await info(app, testOrganizationApp(), organization, testProject(), {webEnv: false})
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  expect(json.configuration.custom).toEqual({nullable: null, enabled: false, items: []})
  expect(json.devApplicationURLs).toEqual({
    applicationUrl: 'https://example.com',
    redirectUrlWhitelist: ['https://example.com/auth'],
  })
})

test('includes all public remote fields without credentials or the API client', async () => {
  const publicRemoteApp = {
    id: 'gid://shopify/App/123',
    title: 'Remote title',
    apiKey: 'client-id',
    organizationId: '456',
    appType: 'custom',
    newApp: false,
    grantedScopes: ['read_orders'],
    developmentStorePreviewEnabled: false,
    applicationUrl: 'https://example.com',
    redirectUrlWhitelist: ['https://example.com/auth'],
    requestedAccessScopes: ['read_products'],
    webhookApiVersion: '2026-07',
    embedded: false,
    posEmbedded: false,
    preferencesUrl: 'https://example.com/preferences',
    gdprWebhooks: {
      customerDeletionUrl: 'https://example.com/delete',
      customerDataRequestUrl: 'https://example.com/data',
      shopDeletionUrl: 'https://example.com/shop-delete',
    },
    appProxy: {subPath: 'proxy', subPathPrefix: 'apps', url: 'https://example.com/proxy'},
    configuration: {name: 'Remote configuration', application_url: 'https://example.com', embedded: false},
    flags: [],
  }
  const result = await info(testAppLinked(), testOrganizationApp(publicRemoteApp), organization, testProject(), {
    webEnv: false,
  })
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  expect(json.remoteApp).toEqual(publicRemoteApp)
  expect(json.organization).toEqual(organization)
  expect(json.system).toEqual({
    cliVersion: CLI_KIT_VERSION,
    nodeVersion: process.version,
    ...platformAndArch(),
    ...(process.env.SHELL === undefined ? {} : {shell: process.env.SHELL}),
  })
})

test('includes extension identity and capabilities and resolves the dev store', async () => {
  const {result} = await resultWithExtensions()
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  expect(json.devStoreUrl).toBe('example.myshopify.com')
  expect(json.allExtensions[0]).toMatchObject({
    name: 'Example',
    type: 'ui_extension',
    externalType: 'ui_extension_external',
    features: expect.any(Array),
    surface: expect.any(String),
  })
  const app = testAppLinked({hiddenConfig: {dev_store_url: 'old.myshopify.com'}})
  app.configuration = {
    ...app.configuration,
    build: {...app.configuration.build, dev_store_url: 'current.myshopify.com'},
  }
  const current = await info(app, testOrganizationApp(), organization, testProject(), {webEnv: false})
  expect(current).toHaveProperty('devStoreUrl', 'current.myshopify.com')
})

test('includes discovered configuration files and errors without adding environment secrets', async () => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "client-id"')
    await writeFile(joinPath(directory, 'shopify.app.staging.toml'), 'client_id = "staging-id"')
    await writeFile(joinPath(directory, 'shopify.app.invalid.toml'), 'invalid = [')
    await writeFile(joinPath(directory, '.env.production'), 'SECRET=private-value')
    await mkdir(joinPath(directory, 'extensions/example'))
    await writeFile(joinPath(directory, 'extensions/example/shopify.extension.toml'), 'type = "function"')
    await mkdir(joinPath(directory, 'web'))
    await writeFile(joinPath(directory, 'web/shopify.web.toml'), 'roles = ["frontend"]')
    const project = await Project.load(directory)
    const result = await info(testAppLinked({directory}), testOrganizationApp(), organization, project, {webEnv: false})
    const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
    expect(json.project.appConfigFiles).toEqual(
      expect.arrayContaining([
        {path: joinPath(directory, 'shopify.app.toml'), content: {client_id: 'client-id'}, errors: []},
        {path: joinPath(directory, 'shopify.app.staging.toml'), content: {client_id: 'staging-id'}, errors: []},
      ]),
    )
    expect(json.project.extensionConfigFiles).toEqual([
      {path: joinPath(directory, 'extensions/example/shopify.extension.toml'), content: {type: 'function'}, errors: []},
    ])
    expect(json.project.webConfigFiles).toEqual([
      {path: joinPath(directory, 'web/shopify.web.toml'), content: {roles: ['frontend']}, errors: []},
    ])
    expect(json.project.errors).toEqual([
      {path: joinPath(directory, 'shopify.app.invalid.toml'), message: expect.any(String)},
    ])
    expect(json.project.dotenvFiles).toEqual([{path: joinPath(directory, '.env.production')}])
    expect(JSON.stringify(json)).not.toContain('private-value')
  })
})

test.each([
  {type: 'UserAccount' as const, email: 'dev@example.com'},
  {type: 'ServiceAccount' as const, orgName: 'Example organization'},
  {type: 'UnknownAccount' as const},
])('includes the cached account identity: $type', async (account) => {
  const remoteApp = testOrganizationApp()
  vi.spyOn(remoteApp.developerPlatformClient, 'accountInfo').mockResolvedValue(account)
  const result = await info(testAppLinked(), remoteApp, organization, testProject(), {webEnv: false})
  expect(JSON.parse(appInfoJsonOutputSchema.encode(result)).account).toEqual(account)
})

test('only emits documented specification metadata, without reading internal fields', async () => {
  const extension = await testUIExtension()
  extension.specification.group = 'ui'
  extension.specification.graphQLType = 'UIExtension'
  Object.defineProperty(extension.specification, 'internalState', {
    enumerable: true,
    get() {
      throw new Error('Internal specification state must not be read')
    },
  })
  const app = testAppLinked({allExtensions: [extension], specifications: [extension.specification]})
  const result = await info(app, testOrganizationApp(), organization, testProject(), {webEnv: false})
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  for (const specification of [
    json.specifications[0],
    json.allExtensions[0].specification,
    json.realExtensions[0].specification,
  ]) {
    expect(specification).toMatchObject({
      identifier: extension.specification.identifier,
      group: 'ui',
      graphQLType: 'UIExtension',
    })
    expect(specification.clientSteps).toEqual(extension.specification.clientSteps)
    expect(specification).not.toHaveProperty('internalState')
    expect(specification).not.toHaveProperty('schema')
    const schema = appInfoJsonOutputSchema.jsonSchema.definitions!.AppInfoSpecification
    expect(schema).toHaveProperty('additionalProperties', false)
    for (const key of Object.keys(specification)) {
      expect(schema).toHaveProperty(`properties.${key}`)
    }
  }
})

test('preserves environment values, hidden state, and arbitrary configuration fields', async () => {
  const extension = await testUIExtension()
  Object.assign(extension.configuration, {custom: {token: 'extension-value'}})
  const app = testAppLinked({
    allExtensions: [extension],
    configuration: {...testAppLinked().configuration, custom: {token: 'app-value'}},
    dotenv: {path: '/tmp/project/.env', variables: {TOKEN: 'environment-value'}},
    hiddenConfig: {dev_store_url: 'example.myshopify.com'},
  })
  Object.assign(app.hiddenConfig, {custom: 'hidden-value'})
  app.webs = [
    {
      directory: '/tmp/project/web',
      configuration: {roles: [], commands: {dev: 'TOKEN=web-value npm run dev'}},
    },
  ]
  const result = await info(app, testOrganizationApp(), organization, testProject(), {webEnv: false})
  const json = JSON.parse(appInfoJsonOutputSchema.encode(result))
  expect(json.dotenv).toEqual(app.dotenv)
  expect(json._hiddenConfig).toEqual(app.hiddenConfig)
  expect(json.configuration).toEqual(app.configuration)
  expect(json.allExtensions[0].configuration).toEqual(extension.configuration)
  expect(json.realExtensions[0].configuration).toEqual(extension.configuration)
  expect(json.webs).toEqual(app.webs)
})
