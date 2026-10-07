import {renderAppDeployResult} from './result.js'
import {testAppLinked, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Errors} from '@oclif/core'
import {unstyled} from '@shopify/cli-kit/node/output'
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

test('projects only the public fields through the real encoder and stdout writer', async () => {
  const result = deployResult()
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderAppDeployResult(result, testOrganizationApp(), testProject(), 'json')
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      app: {name: 'app1', clientId: 'api-key'},
      deployment: {
        released: true,
        version: {
          gid: 'gid://shopify/Version/1',
          name: 'v1',
          message: 'Release message',
          url: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
        },
      },
    })
    expect(stderr()).toBe('')
    expect(stdout()).not.toContain('apiSecret')
    expect(stdout()).not.toContain('validationErrors')
  })
})

test('returns null for unavailable version fields', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    await renderAppDeployResult(
      deployResult({versionTag: undefined, message: ''}),
      testOrganizationApp(),
      testProject(),
      'json',
    )
    expect(JSON.parse(stdout())).toMatchObject({deployment: {version: {name: null, message: null}}})
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

test('text preserves the partial-release message and exit behavior', async () => {
  process.exitCode = undefined
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderAppDeployResult(
      deployResult({deployError: 'Release failed.'}),
      testOrganizationApp(),
      testProject(),
      'text',
    )
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toContain('New version created, but not released.')
    expect(unstyled(stderr())).toContain('Release failed.')
    expect(process.exitCode).toBeUndefined()
  })
})

test('text preserves the no-release message and next command', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderAppDeployResult({...deployResult(), release: false}, testOrganizationApp(), testProject(), 'text')
    expect(stdout()).toBe('')
    expect(unstyled(stderr())).toContain('New version created.')
    expect(unstyled(stderr())).toContain('shopify app release --version=v1')
  })
})

test('cancelled JSON uses the standard silent handler and exits zero without another document', async () => {
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      let cancellation: unknown
      try {
        await renderAppDeployResult(
          {status: 'cancelled', app: testAppLinked()},
          testOrganizationApp(),
          testProject(),
          'json',
        )
      } catch (error) {
        if (!(error instanceof AbortSilentError)) throw error
        cancellation = error
      }
      expect(cancellation).toBeInstanceOf(AbortSilentError)
      expect(cancellation).toMatchObject({oclif: {exit: 0}})
      await errorHandler(cancellation as Error)
      await Errors.handle(cancellation as Error)
      expect(exit).toHaveBeenCalledExactlyOnceWith(0)
      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
      expect(stderr()).toBe('')
    })
  } finally {
    exit.mockRestore()
  }
})
