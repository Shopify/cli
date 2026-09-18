import {
  createFixtureSymlink,
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {
  AppDoctorScopeError,
  appDoctorScopeIdentity,
  buildAppDoctorReviewScopes,
  createAppDoctorContext,
  discoverAppDoctorApps,
  inspectAppDoctorConfigurations,
  parseAppDoctorScopeDescriptor,
  selectAppDoctorApp,
  selectAppDoctorConfiguration,
} from '../index.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorContext, AppDoctorReviewScope} from '../index.js'

/**
 * A repository root, a sibling directory outside the app but inside the anchor,
 * and an app at `repo/packages/app` containing `web` and `lib` directories.
 */
interface ReviewFixture {
  readonly root: string
  readonly repository: string
  readonly context: AppDoctorContext
}

async function createReviewFixture(root: string): Promise<ReviewFixture> {
  const repository = await makeFixtureDirectory(root, 'repo')
  await makeFixtureDirectory(repository, '.git')
  await makeFixtureDirectory(repository, 'shared')
  await writeFixtureFile(repository, 'packages/app/shopify.app.toml', linkedConfiguration('app-id'))
  await makeFixtureDirectory(repository, 'packages/app/web')
  await makeFixtureDirectory(repository, 'packages/app/lib')
  await writeFixtureFile(repository, 'packages/app/README.md', 'docs')

  const discovery = await discoverAppDoctorApps({directory: joinPath(repository, 'packages/app')})
  const configurations = await inspectAppDoctorConfigurations(selectAppDoctorApp(discovery).directory)
  const decision = selectAppDoctorConfiguration(configurations, {interactive: false})
  if (decision.type !== 'selected') throw new Error('unexpected selection-required decision')
  return {root, repository, context: await createAppDoctorContext(decision.selection)}
}

const expectScopeError = async (promise: Promise<unknown>, code: AppDoctorScopeError['code']) => {
  await expect(promise).rejects.toBeInstanceOf(AppDoctorScopeError)
  await expect(promise).rejects.toMatchObject({code})
}

const directories = (scopes: ReadonlyArray<AppDoctorReviewScope>) => scopes.map((scope) => scope.directory)

describe('buildAppDoctorReviewScopes', () => {
  test('defaults to the implicit app scope when no directories are given', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)

      const scopes = await buildAppDoctorReviewScopes(context, {invocationDirectory: root})

      expect(scopes).toEqual([
        {
          scopeIdentity: appDoctorScopeIdentity(context.storageAnchor, context.appRoot),
          directory: context.appRoot,
          requestedPaths: [context.appRoot],
          isAppRoot: true,
          descriptor: {
            descriptor_version: 1,
            app_directory: {base: 'storage_anchor', up: 0, path: 'packages/app'},
            selected_config: {base: 'storage_anchor', up: 0, path: 'packages/app/shopify.app.toml'},
            directory: {base: 'storage_anchor', up: 0, path: 'packages/app'},
            boundary: {app: 'inside', anchor: 'inside'},
            exclusions: {
              semantics: 'literal-file-or-subtree-v1',
              declared_from: 'selected_config_directory',
              entries: [],
            },
          },
        },
      ])
    })
  })

  test('explicit directories replace the implicit app scope', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)

      const scopes = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: ['web'],
        invocationDirectory: context.appRoot,
      })

      expect(directories(scopes)).toEqual([joinPath(context.appRoot, 'web')])
      expect(scopes[0]).toMatchObject({
        scopeIdentity: appDoctorScopeIdentity(context.storageAnchor, joinPath(context.appRoot, 'web')),
        requestedPaths: ['web'],
        isAppRoot: false,
        descriptor: {
          directory: {base: 'storage_anchor', up: 0, path: 'packages/app/web'},
          boundary: {app: 'inside', anchor: 'inside'},
        },
      })
    })
  })

  test('coalesces every spelling of one directory into a single scope', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)
      const lib = joinPath(context.appRoot, 'lib')
      const link = joinPath(root, 'lib-link')
      await createFixtureSymlink(lib, link)

      const scopes = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: ['./lib', 'lib/', lib, link, './lib'],
        invocationDirectory: context.appRoot,
      })

      expect(directories(scopes)).toEqual([lib])
      expect(scopes[0]?.requestedPaths).toEqual(['./lib', 'lib/', lib, link])
    })
  })

  test('keeps nested owners as distinct scopes, ordered by canonical directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)

      const scopes = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: ['web', '.', 'lib'],
        invocationDirectory: context.appRoot,
      })

      expect(directories(scopes)).toEqual([
        context.appRoot,
        joinPath(context.appRoot, 'lib'),
        joinPath(context.appRoot, 'web'),
      ])
      expect(scopes.map((scope) => scope.isAppRoot)).toEqual([true, false, false])
      expect(new Set(scopes.map((scope) => scope.scopeIdentity)).size).toBe(3)
    })
  })

  test('classifies boundaries for directories outside the app and outside the anchor', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context, repository} = await createReviewFixture(root)
      const outsideAnchor = await makeFixtureDirectory(root, 'elsewhere')

      const scopes = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: [joinPath(repository, 'shared'), outsideAnchor],
        invocationDirectory: root,
      })

      const byDirectory = new Map(scopes.map((scope) => [scope.directory, scope]))
      expect(byDirectory.get(joinPath(repository, 'shared'))).toMatchObject({
        isAppRoot: false,
        descriptor: {
          directory: {base: 'storage_anchor', up: 0, path: 'shared'},
          boundary: {app: 'outside', anchor: 'inside'},
        },
      })
      expect(byDirectory.get(outsideAnchor)).toMatchObject({
        isAppRoot: false,
        descriptor: {
          directory: {base: 'storage_anchor', up: 1, path: 'elsewhere'},
          boundary: {app: 'outside', anchor: 'outside'},
        },
      })
      for (const scope of scopes) {
        expect(parseAppDoctorScopeDescriptor(scope.descriptor)).toEqual({ok: true, descriptor: scope.descriptor})
      }
    })
  })

  test('produces identical scopes for the same absolute targets from any invocation directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context, repository} = await createReviewFixture(root)
      const targets = [joinPath(context.appRoot, 'web'), joinPath(repository, 'shared')]

      const fromRoot = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: targets,
        invocationDirectory: root,
      })
      const fromApp = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: targets,
        invocationDirectory: context.appRoot,
      })

      expect(fromApp).toEqual(fromRoot)
    })
  })

  test('resolves relative directories against the invocation directory, not the app root', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context, repository} = await createReviewFixture(root)

      const scopes = await buildAppDoctorReviewScopes(context, {
        reviewDirectories: ['shared'],
        invocationDirectory: repository,
      })

      expect(directories(scopes)).toEqual([joinPath(repository, 'shared')])
    })
  })

  test('rejects an empty directory list', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)

      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: [], invocationDirectory: root}),
        'NO_REVIEW_DIRECTORIES',
      )
    })
  })

  test('rejects blank, missing, and non-directory entries', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)
      const invocationDirectory = context.appRoot

      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['web', '   '], invocationDirectory}),
        'INVALID_REVIEW_DIRECTORY',
      )
      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['does-not-exist'], invocationDirectory}),
        'REVIEW_DIRECTORY_NOT_FOUND',
      )
      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['README.md'], invocationDirectory}),
        'REVIEW_DIRECTORY_NOT_A_DIRECTORY',
      )
    })
  })

  test('reports the first failing entry in request order when several are invalid', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)
      const invocationDirectory = context.appRoot

      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['README.md', 'does-not-exist'], invocationDirectory}),
        'REVIEW_DIRECTORY_NOT_A_DIRECTORY',
      )
      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['does-not-exist', 'README.md'], invocationDirectory}),
        'REVIEW_DIRECTORY_NOT_FOUND',
      )
    })
  })

  // Windows forbids control characters in file names, so the directory can't be created there.
  test.skipIf(process.platform === 'win32')(
    'rejects a directory whose name the descriptor contract cannot carry',
    async () => {
      await inCanonicalTemporaryDirectory(async (root) => {
        const {context} = await createReviewFixture(root)
        await makeFixtureDirectory(context.appRoot, 'a\nb')

        await expectScopeError(
          buildAppDoctorReviewScopes(context, {reviewDirectories: ['a\nb'], invocationDirectory: context.appRoot}),
          'DESCRIPTOR_INVALID',
        )
      })
    },
  )

  test('rejects a relative invocation directory instead of consulting the process working directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const {context} = await createReviewFixture(root)

      await expectScopeError(
        buildAppDoctorReviewScopes(context, {reviewDirectories: ['web'], invocationDirectory: 'relative'}),
        'INVALID_PATH',
      )
    })
  })
})
