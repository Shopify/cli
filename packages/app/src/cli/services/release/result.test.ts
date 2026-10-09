import {renderAppReleaseResult} from './result.js'
import {testOrganizationApp} from '../../models/app/app.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
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

test('text retains silent cancellation', () => {
  expect(() => renderAppReleaseResult({status: 'cancelled'}, testOrganizationApp(), 'text')).toThrow(AbortSilentError)
})
