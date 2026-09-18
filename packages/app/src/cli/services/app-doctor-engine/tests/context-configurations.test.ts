import {
  createFixtureSymlink,
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {inspectAppDoctorConfigurations} from '../context/configurations.js'
import {AppDoctorContextError} from '../context/types.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {chmod} from 'node:fs/promises'

describe('inspectAppDoctorConfigurations', () => {
  test('reports local client IDs and parse state for each direct configuration file, sorted by name', async () => {
    await inCanonicalTemporaryDirectory(async (app) => {
      await writeFixtureFile(app, 'shopify.app.toml', linkedConfiguration('default-id'))
      await writeFixtureFile(app, 'shopify.app.broken.toml', 'client_id = "oops\n[unterminated')
      await writeFixtureFile(app, 'shopify.app.unlinked.toml', 'name = "Unlinked"\n')
      await writeFixtureFile(app, 'shopify.app.blank.toml', 'client_id = "   "\n')
      await writeFixtureFile(app, 'shopify.app.numeric.toml', 'client_id = 12345\n')
      await writeFixtureFile(app, 'nested/shopify.app.toml', linkedConfiguration('nested-id'))
      await writeFixtureFile(app, 'README.md', 'client_id = "not-a-config"\n')

      const configurations = await inspectAppDoctorConfigurations(app)

      expect(configurations).toEqual([
        {path: joinPath(app, 'shopify.app.blank.toml'), fileName: 'shopify.app.blank.toml', state: 'parsed'},
        {path: joinPath(app, 'shopify.app.broken.toml'), fileName: 'shopify.app.broken.toml', state: 'malformed'},
        {path: joinPath(app, 'shopify.app.numeric.toml'), fileName: 'shopify.app.numeric.toml', state: 'parsed'},
        {
          path: joinPath(app, 'shopify.app.toml'),
          fileName: 'shopify.app.toml',
          state: 'parsed',
          clientId: 'default-id',
        },
        {path: joinPath(app, 'shopify.app.unlinked.toml'), fileName: 'shopify.app.unlinked.toml', state: 'parsed'},
      ])
    })
  })

  test('keeps a padded client ID verbatim', async () => {
    await inCanonicalTemporaryDirectory(async (app) => {
      const path = await writeFixtureFile(app, 'shopify.app.toml', linkedConfiguration(' padded '))
      await expect(inspectAppDoctorConfigurations(app)).resolves.toEqual([
        {path, fileName: 'shopify.app.toml', state: 'parsed', clientId: ' padded '},
      ])
    })
  })

  test('skips symlinked and directory entries named like configuration files', async () => {
    await inCanonicalTemporaryDirectory(async (app) => {
      const real = await writeFixtureFile(app, 'shopify.app.toml')
      await createFixtureSymlink(real, joinPath(app, 'shopify.app.link.toml'))
      await makeFixtureDirectory(app, 'shopify.app.dir.toml')
      await expect(inspectAppDoctorConfigurations(app)).resolves.toEqual([
        {path: real, fileName: 'shopify.app.toml', state: 'parsed'},
      ])
    })
  })

  test('marks unreadable files without failing the inspection', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return
    await inCanonicalTemporaryDirectory(async (app) => {
      const locked = await writeFixtureFile(app, 'shopify.app.locked.toml', linkedConfiguration('hidden-id'))
      await writeFixtureFile(app, 'shopify.app.toml', linkedConfiguration('default-id'))
      await chmod(locked, 0o000)
      try {
        await expect(inspectAppDoctorConfigurations(app)).resolves.toEqual([
          {path: locked, fileName: 'shopify.app.locked.toml', state: 'unreadable'},
          {
            path: joinPath(app, 'shopify.app.toml'),
            fileName: 'shopify.app.toml',
            state: 'parsed',
            clientId: 'default-id',
          },
        ])
      } finally {
        await chmod(locked, 0o644)
      }
    })
  })

  test('rejects relative and missing directories', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await expect(inspectAppDoctorConfigurations('relative/app')).rejects.toMatchObject({code: 'INVALID_PATH'})
      const missing = inspectAppDoctorConfigurations(joinPath(root, 'missing'))
      await expect(missing).rejects.toBeInstanceOf(AppDoctorContextError)
      await expect(missing).rejects.toMatchObject({code: 'PATH_NOT_FOUND'})
    })
  })
})
