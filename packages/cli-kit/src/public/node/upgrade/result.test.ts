import {presentUpgradeResult} from './result.js'
import {upgradeJsonOutputSchema, type UpgradeResult} from './types.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {afterEach, describe, expect, test} from 'vitest'

afterEach(() => mockAndCaptureOutput().clear())

const globalResult: UpgradeResult = {
  status: 'upgraded',
  scope: 'global',
  previousVersion: '4.8.0',
  version: '4.9.0',
  packageManager: 'npm',
}

const localResult: UpgradeResult = {
  status: 'dependencies_updated',
  scope: 'local',
  directory: '/project',
  previousVersion: '4.8.0',
  packages: ['@shopify/cli'],
}

describe('upgrade result contract', () => {
  test.each<UpgradeResult>([
    globalResult,
    localResult,
    {...localResult, availableVersion: '4.9.0'},
    {status: 'skipped', scope: 'global', reason: 'development'},
    {status: 'skipped', scope: 'local', reason: 'local_autoupgrade'},
    {status: 'skipped', scope: 'local', reason: 'dependency_not_found'},
  ])('encodes $status', (result) => {
    presentUpgradeResult(result, 'json')
    expect(JSON.parse(mockAndCaptureOutput().output())).toEqual(result)
  })

  test.each([
    {...globalResult, version: undefined},
    {...globalResult, version: 42},
    {...globalResult, scope: 'local'},
    {...localResult, packages: [42]},
    {...localResult, availableVersion: false},
    {status: 'skipped', scope: 'local', reason: 'unknown'},
  ])('rejects invalid result %j', (result) => {
    expect(() => upgradeJsonOutputSchema.validate(result)).toThrow()
  })

  test('preserves the global success banner', () => {
    presentUpgradeResult(globalResult, 'text')
    expect(mockAndCaptureOutput().info()).toContain('Shopify CLI upgraded.')
    expect(mockAndCaptureOutput().info()).toContain("You're now on version 4.9.0.")
  })

  test.each<UpgradeResult>([localResult, {status: 'skipped', scope: 'local', reason: 'development'}])(
    'does not add terminal output for $status',
    (result) => {
      presentUpgradeResult(result, 'text')
      expect(mockAndCaptureOutput().output()).toBe('')
      expect(mockAndCaptureOutput().info()).toBe('')
    },
  )
})
