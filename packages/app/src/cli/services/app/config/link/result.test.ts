import {appConfigLinkJsonOutputSchema, projectAppConfigResult} from './types.js'
import {renderAppConfigLinkResult} from './result.js'
import ConfigLink from '../../../../commands/app/config/link.js'
import {testOrganizationApp} from '../../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'
import * as context from '@shopify/cli-kit/node/context/local'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'

function result() {
  return projectAppConfigResult({
    path: '/app/shopify.app.toml',
    configuration: {client_id: 'key', name: 'Example', embedded: false, custom_module: {enabled: true}},
    app: testOrganizationApp({apiKey: 'key', developmentStorePreviewEnabled: false}),
  })
}

describe('config link result', () => {
  test('retains public configuration and app fields while excluding credentials and runtime state', () => {
    const value = result()
    const encoded = JSON.parse(appConfigLinkJsonOutputSchema.encode(value))
    expect(encoded.configuration).toEqual({
      client_id: 'key',
      name: 'Example',
      embedded: false,
      custom_module: {enabled: true},
    })
    expect(encoded.app).toMatchObject({clientId: 'key', developmentStorePreviewEnabled: false, grantedScopes: []})
    expect(encoded.app).not.toHaveProperty('apiSecretKeys')
    expect(encoded.app).not.toHaveProperty('developerPlatformClient')
    expect(encoded.app).not.toHaveProperty('flags')
    expect(encoded.app.appType).toBeNull()
  })

  test('separates actual GIDs from other app and organization identifiers', () => {
    const value = projectAppConfigResult({
      path: '/app/shopify.app.toml',
      configuration: {client_id: 'key'},
      app: testOrganizationApp({id: 'gid://shopify/App/123', organizationId: 'gid://shopify/Organization/456'}),
    })
    expect(value.app).toMatchObject({
      id: null,
      gid: 'gid://shopify/App/123',
      organizationId: null,
      organizationGid: 'gid://shopify/Organization/456',
    })
    expect(result().app).toMatchObject({id: '1', gid: null, organizationId: '1', organizationGid: null})
  })

  test.each([
    {path: 'relative.toml'},
    {extra: true},
    {app: {...result().app, extra: true}},
    {app: {...result().app, applicationUrl: 'invalid-url'}},
    {app: {...result().app, gid: 'gid://shopify/Shop/123'}},
  ])('rejects malformed public projections %j', (fields) => {
    expect(() => appConfigLinkJsonOutputSchema.validate({...result(), ...fields})).toThrow()
  })

  test('rejects a missing configuration client ID', () => {
    expect(() => appConfigLinkJsonOutputSchema.validate({...result(), configuration: {name: 'Example'}})).toThrow()
  })

  test('exposes the schema and JSON flag', () => {
    expect(ConfigLink.jsonOutputSchema).toBe(appConfigLinkJsonOutputSchema)
    expect(ConfigLink.flags.json).toBeDefined()
    expect(ConfigLink.description).toContain('AppConfigLinkResult')
  })

  test('writes one encoded result to stdout and diagnostics to stderr', () => {
    vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
    const streams = mockAndCaptureStandardStreams()
    try {
      runWithCommandEventsForCommand(['--json'], () => {
        outputInfo('Configuration fetched')
        renderAppConfigLinkResult(result(), 'npm', 'json')
      })
      expect(streams.stdout()).toBe(`${appConfigLinkJsonOutputSchema.encode(result())}\n`)
      expect(JSON.parse(streams.stderr())).toMatchObject({type: 'diagnostic', message: 'Configuration fetched'})
    } finally {
      streams.restore()
    }
  })
})
