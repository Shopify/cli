import {dependencyManagerUsedForCreating, install} from './dependency'
import {exec} from './system'
import {describe, it, expect, vi} from 'vitest'

vi.mock('./system')
const mockedExec = vi.mocked(exec)

describe('dependencyManagerUsedForCreating', () => {
  it('returns pnpm if the npm_config_user_agent variable contains yarn', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_config_user_agent: 'yarn/1.22.17'}

    // When
    const got = dependencyManagerUsedForCreating(env)

    // Then
    expect(got).toBe('yarn')
  })

  it('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = dependencyManagerUsedForCreating(env)

    // Then
    expect(got).toBe('pnpm')
  })

  it('returns npm when the package manager cannot be detected', () => {
    // When
    const got = dependencyManagerUsedForCreating({})

    // Then
    expect(got).toBe('npm')
  })
})

describe('install', () => {
  it('runs the install command', async () => {
    // Given
    const dependencyManager = 'npm'
    const directory = '/path/to/project'

    // When
    await install(directory, dependencyManager)

    // Then
    expect(mockedExec).toHaveBeenCalledWith(dependencyManager, ['install'], {
      cwd: directory,
    })
  })
})
