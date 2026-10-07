import {renderAppReleaseError, renderAppReleaseResult} from './result.js'
import {ReleaseVersionLookupError} from './version-diff.js'
import {testOrganizationApp} from '../../models/app/app.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {expect, test} from 'vitest'
import type {ReleaseResult} from './types.js'

const version = {
  id: 123,
  uuid: 'gid://shopify/Version/123',
  versionTag: 'v1',
  message: 'Release message',
  location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/123',
  appModuleVersions: [],
}
const result: ReleaseResult = {status: 'success', version}

test('projects only public data through the real encoder and stdout writer', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderAppReleaseResult(result, testOrganizationApp(), 'json')
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      app: {name: 'app1', clientId: 'api-key'},
      release: {
        version: {gid: version.uuid, name: 'v1', message: 'Release message', url: version.location},
      },
    })
    expect(stderr()).toBe('')
    expect(stdout()).not.toContain('apiSecret')
    expect(stdout()).not.toContain('appModuleVersions')
  })
})

test('encodes unavailable version fields as null', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    renderAppReleaseResult(
      {...result, version: {...version, versionTag: undefined, message: ''}},
      testOrganizationApp(),
      'json',
    )
    expect(JSON.parse(stdout())).toMatchObject({release: {version: {name: null, message: null}}})
  })
})

test('text keeps the released-version banner on stderr', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderAppReleaseResult(result, testOrganizationApp(), 'text')
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toContain('Version released to users.')
    expect(unstyled(stderr())).toContain('Release message')
    expect(unstyled(stderr())).toContain('v1')
  })
})

test('text retains the failed release banner and exit behavior', async () => {
  const originalExitCode = process.exitCode
  const userErrors = [{message: 'First error'}, {message: 'Second error'}].map((error) => ({
    ...error,
    category: 'validation',
    details: [],
  }))
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderAppReleaseResult({status: 'failed', version, userErrors}, testOrganizationApp(), 'text')
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toContain("Version couldn't be released.")
    expect(unstyled(stderr())).toContain('First error, Second error')
    expect(unstyled(stderr())).toContain('Release message')
    expect(process.exitCode).toBe(originalExitCode)
  })
})

test('JSON failure throws an abort with native user errors and no result', async () => {
  const userErrors = [{message: 'Release failed.', category: 'validation', details: [], field: ['version']}]
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    expect(() =>
      renderAppReleaseResult({status: 'failed', version, userErrors}, testOrganizationApp(), 'json'),
    ).toThrow(AbortError)
    expect(() =>
      renderAppReleaseResult({status: 'failed', version, userErrors}, testOrganizationApp(), 'json'),
    ).toThrow(expect.objectContaining({details: {userErrors}}))
    expect(stdout()).toBe('')
    expect(stderr()).toBe('')
  })
})

test('declined confirmation is a JSON result and retains silent text cancellation', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderAppReleaseResult({status: 'cancelled'}, testOrganizationApp(), 'json')
    expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
    expect(() => renderAppReleaseResult({status: 'cancelled'}, testOrganizationApp(), 'text')).toThrow(AbortSilentError)
    expect(stderr()).toBe('')
  })
})

test('text preserves the missing-version banner, while JSON retains the original failure', async () => {
  const cause = new AbortError('Version not found for tag: missing')
  const error = new ReleaseVersionLookupError('missing', cause)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    expect(() => renderAppReleaseError(error, 'text')).toThrow(AbortSilentError)
    expect(unstyled(stderr())).toContain('Version missing could not be found.')
    expect(stdout()).toBe('')
    expect(() => renderAppReleaseError(error, 'json')).toThrow(cause)
  })
})

test('does not turn unrelated failures into cancellation', () => {
  const cause = new AbortSilentError()
  expect(() => renderAppReleaseError(cause, 'json')).toThrow(AbortError)
  expect(() => renderAppReleaseError(cause, 'text')).toThrow(cause)
})
