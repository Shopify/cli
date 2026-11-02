import {appReleaseJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

const app = {name: 'Example', clientId: 'client-id'}
const version = {gid: 'gid://shopify/Version/123', name: 'v1', message: null, url: 'https://example.com/version/123'}
const result = {status: 'success' as const, app, release: {version}}

test.each([
  ['top-level field', {...result, internalId: 'private'}],
  ['app field', {...result, app: {...app, internalId: 'private'}}],
  ['release field', {...result, release: {version, internalId: 'private'}}],
  ['version field', {...result, release: {version: {...version, internalId: 'private'}}}],
  ['cancelled field', {status: 'cancelled' as const, app}],
  ['client ID', {...result, app: {...app, clientId: ''}}],
  ['version GID', {...result, release: {version: {...version, gid: '123'}}}],
  ['version URL', {...result, release: {version: {...version, url: 'invalid'}}}],
])('rejects an invalid %s', (_name, value) => {
  expect(() => appReleaseJsonOutputSchema.encode(value)).toThrow()
})
