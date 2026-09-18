import {
  createFixtureSymlink,
  inCanonicalTemporaryDirectory,
  independentIdentity,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {computeConfigurationIdentity, findStorageAnchor, resolveStoreDirectory} from '../context/storage.js'
import {AppDoctorContextError} from '../context/types.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {createHash} from 'node:crypto'

describe('findStorageAnchor', () => {
  test('uses the app root when no .git marker exists above it', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const app = await makeFixtureDirectory(root, 'workspace/app')
      await expect(findStorageAnchor(app)).resolves.toEqual({storageAnchor: app, storageAnchorKind: 'app'})
    })
  })

  test('anchors at a directory holding a .git directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const repository = await makeFixtureDirectory(root, 'repo')
      await makeFixtureDirectory(repository, '.git')
      const app = await makeFixtureDirectory(repository, 'packages/app')
      await expect(findStorageAnchor(app)).resolves.toEqual({
        storageAnchor: repository,
        storageAnchorKind: 'repository',
      })
    })
  })

  test('accepts a .git regular file (worktree or submodule) without following gitdir', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const repository = await makeFixtureDirectory(root, 'repo')
      await writeFixtureFile(repository, '.git', 'gitdir: /somewhere/that/does/not/exist\n')
      const app = await makeFixtureDirectory(repository, 'app')
      await expect(findStorageAnchor(app)).resolves.toEqual({
        storageAnchor: repository,
        storageAnchorKind: 'repository',
      })
    })
  })

  test('prefers a nested marker over an outer one', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await makeFixtureDirectory(root, '.git')
      const nested = await makeFixtureDirectory(root, 'vendor/nested')
      await writeFixtureFile(nested, '.git', 'gitdir: ../../.git/modules/nested\n')
      const app = await makeFixtureDirectory(nested, 'app')
      await expect(findStorageAnchor(app)).resolves.toEqual({storageAnchor: nested, storageAnchorKind: 'repository'})
    })
  })

  test('starts the walk at the app root itself', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const app = await makeFixtureDirectory(root, 'app')
      await makeFixtureDirectory(app, '.git')
      await expect(findStorageAnchor(app)).resolves.toEqual({storageAnchor: app, storageAnchorKind: 'repository'})
    })
  })

  test('rejects a symlinked .git entry', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const realGit = await makeFixtureDirectory(root, 'elsewhere/.git')
      const app = await makeFixtureDirectory(root, 'app')
      await createFixtureSymlink(realGit, joinPath(app, '.git'))
      const result = findStorageAnchor(app)
      await expect(result).rejects.toBeInstanceOf(AppDoctorContextError)
      await expect(result).rejects.toMatchObject({code: 'UNSUPPORTED_PATH'})
    })
  })

  test('rejects a relative app root', async () => {
    await expect(findStorageAnchor('relative/app')).rejects.toMatchObject({code: 'INVALID_PATH'})
  })
})

describe('computeConfigurationIdentity', () => {
  test('matches an independently computed digest of the exact preimage', () => {
    const identity = computeConfigurationIdentity('/repo', '/repo/packages/app/shopify.app.staging.toml')
    expect(identity).toBe(independentIdentity('packages/app/shopify.app.staging.toml'))
    expect(identity).toMatch(/^[0-9a-f]{32}$/)
  })

  test('is the first 32 hex characters of the full preimage digest', () => {
    const fullDigest = createHash('sha256')
      .update(JSON.stringify(['app-doctor-configuration', 1, 'app/shopify.app.toml']), 'utf8')
      .digest('hex')
    expect(computeConfigurationIdentity('/repo', '/repo/app/shopify.app.toml')).toBe(fullDigest.slice(0, 32))
  })

  test('is stable across whole-anchor relocation and same-location edits', () => {
    const before = computeConfigurationIdentity('/home/a/repo', '/home/a/repo/app/shopify.app.toml')
    const after = computeConfigurationIdentity('/mnt/b/checkout', '/mnt/b/checkout/app/shopify.app.toml')
    expect(after).toBe(before)
  })

  test('changes when the configuration is renamed or moved relative to the anchor', () => {
    const base = computeConfigurationIdentity('/repo', '/repo/app/shopify.app.toml')
    expect(computeConfigurationIdentity('/repo', '/repo/app/shopify.app.staging.toml')).not.toBe(base)
    expect(computeConfigurationIdentity('/repo', '/repo/other/shopify.app.toml')).not.toBe(base)
    expect(computeConfigurationIdentity('/repo/app', '/repo/app/shopify.app.toml')).not.toBe(base)
  })

  test('distinguishes sibling apps under one anchor', () => {
    expect(computeConfigurationIdentity('/repo', '/repo/apps/a/shopify.app.toml')).not.toBe(
      computeConfigurationIdentity('/repo', '/repo/apps/b/shopify.app.toml'),
    )
  })

  test('encodes the app-root anchor case as a bare file name', () => {
    expect(computeConfigurationIdentity('/repo/app', '/repo/app/shopify.app.toml')).toBe(
      independentIdentity('shopify.app.toml'),
    )
  })

  test('rejects relative inputs and configurations outside the anchor', () => {
    expect(() => computeConfigurationIdentity('repo', '/repo/shopify.app.toml')).toThrowError(AppDoctorContextError)
    expect(() => computeConfigurationIdentity('/repo', 'shopify.app.toml')).toThrowError(AppDoctorContextError)
    expect(() => computeConfigurationIdentity('/repo/app', '/repo/shopify.app.toml')).toThrowError(
      /outside the storage anchor/,
    )
    expect(() => computeConfigurationIdentity('/repo/app', '/repo/shopify.app.toml')).toThrowError(
      AppDoctorContextError,
    )
  })
})

describe('resolveStoreDirectory', () => {
  test('maps the identity beneath the anchor without creating anything', () => {
    const identity = 'a'.repeat(32)
    expect(resolveStoreDirectory('/repo', identity)).toBe(joinPath('/repo', '.shopify', 'app-doctor', 'v1', identity))
  })
})
