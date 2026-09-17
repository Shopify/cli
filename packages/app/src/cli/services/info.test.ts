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
  expect(JSON.parse(appInfoJsonOutputSchema.encode(result))).toMatchSnapshot()
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
