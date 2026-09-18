import {
  createFixtureSymlink,
  inCanonicalTemporaryDirectory,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {discoverAppDoctorApps} from '../context/discovery.js'
import {AppDoctorContextError} from '../context/types.js'
import {describe, expect, test, vi} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mkdir} from '@shopify/cli-kit/node/fs'
import {chmod} from 'node:fs/promises'

const expectErrorCode = async (run: Promise<unknown>, code: AppDoctorContextError['code']) => {
  await expect(run).rejects.toBeInstanceOf(AppDoctorContextError)
  await expect(run).rejects.toMatchObject({code})
}

describe('discoverAppDoctorApps explicit paths', () => {
  test('rejects blank, missing, non-configuration and special paths', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'README.md')
      await expectErrorCode(discoverAppDoctorApps({directory: ''}), 'INVALID_PATH')
      await expectErrorCode(discoverAppDoctorApps({directory: '   '}), 'INVALID_PATH')
      await expectErrorCode(discoverAppDoctorApps({directory: joinPath(root, 'nope')}), 'PATH_NOT_FOUND')
      await expectErrorCode(discoverAppDoctorApps({directory: joinPath(root, 'README.md')}), 'UNSUPPORTED_PATH')
    })
  })

  test('selects exactly the named configuration file', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.staging.toml', 'nonsense = [')
      await writeFixtureFile(root, 'app/shopify.app.toml')
      const discovery = await discoverAppDoctorApps({directory: configurationPath})
      expect(discovery).toEqual({
        explicitConfigurationPath: configurationPath,
        apps: [
          {
            directory: joinPath(root, 'app'),
            configurationPaths: [
              joinPath(root, 'app/shopify.app.staging.toml'),
              joinPath(root, 'app/shopify.app.toml'),
            ],
          },
        ],
      })
    })
  })

  test('canonicalizes a regular configuration file reached through a symlinked parent', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml')
      await createFixtureSymlink(joinPath(root, 'app'), joinPath(root, 'link'))
      const discovery = await discoverAppDoctorApps({directory: joinPath(root, 'link/shopify.app.toml')})
      expect(discovery.explicitConfigurationPath).toBe(configurationPath)
      expect(discovery.apps[0]!.directory).toBe(joinPath(root, 'app'))
    })
  })

  test('treats a directory named like a configuration file as a directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml')
      const impostor = await makeFixtureDirectory(root, 'app/shopify.app.fake.toml')
      const discovery = await discoverAppDoctorApps({directory: impostor})
      expect(discovery.explicitConfigurationPath).toBeUndefined()
      expect(discovery.apps).toEqual([{directory: joinPath(root, 'app'), configurationPaths: [configurationPath]}])
    })
  })

  test('rejects a symlinked configuration file and skips symlinked siblings', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const real = await writeFixtureFile(root, 'app/shopify.app.toml')
      const link = joinPath(root, 'app/shopify.app.link.toml')
      await createFixtureSymlink(real, link)
      await expectErrorCode(discoverAppDoctorApps({directory: link}), 'UNSUPPORTED_PATH')
      const discovery = await discoverAppDoctorApps({directory: joinPath(root, 'app')})
      expect(discovery.apps[0]!.configurationPaths).toEqual([real])
    })
  })

  test('resolves a symlinked directory to the canonical app', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml')
      const link = joinPath(root, 'link')
      await createFixtureSymlink(joinPath(root, 'app'), link)
      const discovery = await discoverAppDoctorApps({directory: link})
      expect(discovery.apps).toEqual([{directory: joinPath(root, 'app'), configurationPaths: [configurationPath]}])
    })
  })

  test('reports a broken symlink as a missing path', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const link = joinPath(root, 'dangling')
      await createFixtureSymlink(joinPath(root, 'missing-target'), link)
      await expectErrorCode(discoverAppDoctorApps({directory: link}), 'PATH_NOT_FOUND')
    })
  })
})

describe('discoverAppDoctorApps containing search', () => {
  test('selects the nearest ancestor holding configuration files', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'shopify.app.toml')
      const inner = await writeFixtureFile(root, 'outer/inner/shopify.app.inner.toml')
      await writeFixtureFile(root, 'outer/inner/nested/shopify.app.toml')
      await mkdir(joinPath(root, 'outer/inner/web/frontend'))
      const discovery = await discoverAppDoctorApps({directory: joinPath(root, 'outer/inner/web/frontend')})
      expect(discovery.apps).toEqual([{directory: joinPath(root, 'outer/inner'), configurationPaths: [inner]}])
    })
  })

  test('ignores siblings of ancestors while walking upward', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'shopify.app.toml')
      await writeFixtureFile(root, 'packages/other-app/shopify.app.toml')
      await mkdir(joinPath(root, 'packages/lib/src'))
      const discovery = await discoverAppDoctorApps({directory: joinPath(root, 'packages/lib/src')})
      expect(discovery.apps).toEqual([{directory: root, configurationPaths: [configurationPath]}])
    })
  })

  test('errors when no app exists above or below the start directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await mkdir(joinPath(root, 'empty/child'))
      await expectErrorCode(discoverAppDoctorApps({directory: joinPath(root, 'empty')}), 'APP_NOT_FOUND')
    })
  })
})

describe('discoverAppDoctorApps downward search', () => {
  test('lists every descendant app sorted by canonical directory, including nested apps', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const paths = {
        appB: await writeFixtureFile(root, 'apps/b/shopify.app.toml'),
        appA: await writeFixtureFile(root, 'apps/a/shopify.app.toml'),
        aNested: await writeFixtureFile(root, 'apps/a/extensions/nested/shopify.app.toml'),
        aDash: await writeFixtureFile(root, 'apps/a-b/shopify.app.toml'),
        zeta: await writeFixtureFile(root, 'zeta/shopify.app.zeta.toml'),
      }
      await writeFixtureFile(root, 'apps/a/extensions/nested/notes.txt')
      const discovery = await discoverAppDoctorApps({directory: root})
      // Sorted by canonical directory, which is not raw DFS order: 'a-b' sorts between 'a' and 'a/extensions'.
      expect(discovery.apps.map((app) => app.directory)).toEqual(
        [paths.appA, paths.aDash, paths.aNested, paths.appB, paths.zeta].map((path) => joinPath(path, '..')),
      )
      expect(discovery.apps.map((app) => app.configurationPaths)).toEqual([
        [paths.appA],
        [paths.aDash],
        [paths.aNested],
        [paths.appB],
        [paths.zeta],
      ])
    })
  })

  test('prunes hidden and node_modules children and never descends symlinked directories', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      // The pruned children are direct siblings of `src` so the walk from `root` actually encounters them.
      await writeFixtureFile(root, '.hidden/shopify.app.toml')
      await writeFixtureFile(root, 'node_modules/pkg/shopify.app.toml')
      const outside = await writeFixtureFile(root, 'outside/shopify.app.toml')
      const visible = await writeFixtureFile(root, 'src/visible/shopify.app.toml')
      // Following the symlink would report a second copy of `outside` at `src/linked`.
      await createFixtureSymlink(joinPath(root, 'outside'), joinPath(root, 'src/linked'))
      const discovery = await discoverAppDoctorApps({directory: root})
      expect(discovery.apps).toEqual([
        {directory: joinPath(root, 'outside'), configurationPaths: [outside]},
        {directory: joinPath(root, 'src/visible'), configurationPaths: [visible]},
      ])
    })
  })

  test('defaults the start directory to the current working directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml')
      await mkdir(joinPath(root, 'app/web'))
      // cli-kit's `cwd()` prefers INIT_CWD (set by package managers) over `process.cwd()`.
      vi.stubEnv('INIT_CWD', joinPath(root, 'app/web'))
      try {
        const discovery = await discoverAppDoctorApps()
        expect(discovery).toEqual({apps: [{directory: joinPath(root, 'app'), configurationPaths: [configurationPath]}]})
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  test('honours an explicit start inside a hidden directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const hidden = await writeFixtureFile(root, '.hidden/app/shopify.app.toml')
      const discovery = await discoverAppDoctorApps({directory: joinPath(root, '.hidden')})
      expect(discovery.apps).toEqual([{directory: joinPath(root, '.hidden/app'), configurationPaths: [hidden]}])
    })
  })

  test('fails explicitly when a directory cannot be read', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'apps/ok/shopify.app.toml')
      const locked = await makeFixtureDirectory(root, 'apps/locked')
      await chmod(locked, 0o000)
      try {
        await expectErrorCode(discoverAppDoctorApps({directory: root}), 'IO_ERROR')
      } finally {
        await chmod(locked, 0o755)
      }
    })
  })
})
