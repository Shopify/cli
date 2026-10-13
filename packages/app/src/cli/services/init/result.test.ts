import {initResultToJson, renderInitResult} from './result.js'
import {appInitJsonOutputSchema, type InitResult} from './types.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {expect, test} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'

function initResult(id = 'gid://shopify/App/9007199254740993'): InitResult {
  return {
    app: testAppLinked(),
    remoteApp: testOrganizationApp({id, title: 'My app'}),
    projectName: 'my-app',
    packageManager: 'pnpm',
    template: 'https://github.com/Shopify/shopify-app-template-react-router/web#main-cli',
  }
}

const publicResult = {
  status: 'success' as const,
  app: {
    id: '9007199254740993',
    name: 'My app',
    clientId: 'api-key',
    organizationId: '1',
    directory: '/tmp/project',
    configurationPath: '/tmp/project/shopify.app.toml',
  },
  packageManager: 'pnpm' as const,
  template: 'https://github.com/Shopify/shopify-app-template-react-router/web#main-cli',
}

test('writes the explicit public projection with exact decimal IDs', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderInitResult(initResult(), true)

    expect(JSON.parse(stdout())).toEqual(publicResult)
    expect(stderr()).toBe('')
  })
})

test('retains legacy decimal app IDs', () => {
  const result = initResultToJson(initResult('42'))
  expect(JSON.parse(appInitJsonOutputSchema.encode(result)).app.id).toBe('42')
})

test.each(['gid://shopify/Product/42', 'gid://shopify/App/invalid'])('rejects the malformed app ID %s', async (id) => {
  await withCapturedStandardStreams(async ({stdout}) => {
    expect(() => renderInitResult(initResult(id), true)).toThrow()
    expect(stdout()).toBe('')
  })
})

test.each([
  {id: 'gid://shopify/App/42'},
  {organizationId: 'gid://shopify/Organization/1'},
  {clientId: ''},
  {directory: 'relative/project'},
  {configurationPath: 'shopify.app.toml'},
  {secret: 'private'},
])('rejects malformed public app fields %j', (app) => {
  expect(() => appInitJsonOutputSchema.validate({...publicResult, app: {...publicResult.app, ...app}})).toThrow()
})

test.each([{template: 'not-a-url'}, {packageManager: 'unknown'}, {secret: 'private'}])(
  'rejects malformed public result fields %j',
  (fields) => {
    expect(() => appInitJsonOutputSchema.validate({...publicResult, ...fields})).toThrow()
  },
)

test('keeps the project name and package manager commands in text output', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderInitResult(initResult())
    const text = unstyled(stderr())

    expect(stdout()).toBe('')
    expect(text).toContain('my-app is ready for you to build!')
    expect(text).toContain('cd my-app')
    expect(text).toContain('shopify app generate extension')
    expect(text).toContain('shopify app dev')
    expect(text).toContain('Shopify Dev MCP')
  })
})
