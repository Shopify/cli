import {requireProjectPackageManagerForOperations} from './project-package-manager.js'
import {describe, expect, test} from 'vitest'

describe('requireProjectPackageManagerForOperations', () => {
  test.each(['npm', 'pnpm', 'yarn', 'bun'])('returns %s for supported project package managers', (packageManager) => {
    const result = requireProjectPackageManagerForOperations({
      packageManager,
      directory: '/tmp/project',
    } as any)

    expect(result).toBe(packageManager)
  })

  test('throws when the project package manager is unknown', () => {
    expect(() =>
      requireProjectPackageManagerForOperations({
        packageManager: 'unknown',
        directory: '/tmp/project',
      } as any),
    ).toThrow(/Could not determine the project package manager for \/tmp\/project/)
  })
})
