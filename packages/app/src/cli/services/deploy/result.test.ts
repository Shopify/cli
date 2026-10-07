import {renderAppDeployResult} from './result.js'
import {testAppLinked, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import type {DeployResult} from './types.js'

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
})

function deployResult(
  overrides: Partial<Exclude<DeployResult, {status: 'cancelled'}>['uploadExtensionsBundleResult']> = {},
): Exclude<DeployResult, {status: 'cancelled'}> {
  return {
    status: overrides.deployError ? 'partial' : 'success',
    app: testAppLinked(),
    release: true,
    didMigrateExtensionsToDevDash: false,
    uploadExtensionsBundleResult: {
      validationErrors: [],
      versionGid: 'gid://shopify/Version/1',
      versionTag: 'v1',
      message: 'Release message',
      location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
      ...overrides,
    },
  }
}

test('an unreleased version returns null for unavailable metadata', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    await renderAppDeployResult(
      {...deployResult({versionTag: undefined, message: ''}), release: false},
      testOrganizationApp(),
      testProject(),
      'json',
    )
    expect(JSON.parse(stdout())).toMatchObject({
      status: 'success',
      deployment: {released: false, version: {name: null, message: null}},
    })
  })
})

test('a failed requested release retains the created version and exits nonzero', async () => {
  process.exitCode = undefined
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderAppDeployResult(
      deployResult({deployError: 'Release failed.'}),
      testOrganizationApp(),
      testProject(),
      'json',
    )
    expect(JSON.parse(stdout())).toMatchObject({
      status: 'partial',
      deployment: {released: false, version: {gid: 'gid://shopify/Version/1'}},
      errors: [{type: 'abort', message: 'Release failed.'}],
    })
    expect(stderr()).toBe('')
    expect(process.exitCode).toBe(1)
  })
})

test('text keeps the released-version banner on stderr', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderAppDeployResult(deployResult(), testOrganizationApp(), testProject(), 'text')
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toContain('New version released to users.')
    expect(unstyled(stderr())).toContain('Release message')
  })
})

test('text retains silent cancellation', async () => {
  await expect(
    renderAppDeployResult({status: 'cancelled', app: testAppLinked()}, testOrganizationApp(), testProject(), 'text'),
  ).rejects.toBeInstanceOf(AbortSilentError)
})
