import {selectActiveConfig} from './active-config.js'
import {Project} from './project.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, basename} from '@shopify/cli-kit/node/path'

vi.mock('../../services/local-storage.js', () => ({
  getCachedAppInfo: vi.fn().mockReturnValue(undefined),
  setCachedAppInfo: vi.fn(),
  clearCachedAppInfo: vi.fn(),
}))

vi.mock('../../services/app/config/use.js', () => ({
  default: vi.fn(),
}))

const {getCachedAppInfo} = await import('../../services/local-storage.js')

beforeEach(() => {
  vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
})

describe('selectActiveConfig', () => {
  test('selects config by user-provided name (flag)', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project, 'staging')

      expect(basename(config.file.path)).toBe('shopify.app.staging.toml')
      expect(config.file.content.client_id).toBe('staging')
      expect(config.source).toBe('flag')
      expect(config.isLinked).toBe(true)
    })
  })

  test('selects config from cache', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      await writeFile(joinPath(dir, 'shopify.app.production.toml'), 'client_id = "production"')
      const project = await Project.load(dir)

      vi.mocked(getCachedAppInfo).mockReturnValue({
        directory: dir,
        configFile: 'shopify.app.production.toml',
      })

      const config = await selectActiveConfig(project)

      expect(basename(config.file.path)).toBe('shopify.app.production.toml')
      expect(config.file.content.client_id).toBe('production')
      expect(config.source).toBe('cached')
    })
  })

  test('falls back to default shopify.app.toml when no flag or cache', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default-id"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(basename(config.file.path)).toBe('shopify.app.toml')
      expect(config.file.content.client_id).toBe('default-id')
    })
  })

  test('detects isLinked from client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = ""')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(config.isLinked).toBe(false)
    })
  })

  test('detects isLinked when client_id is present', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc123"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(config.isLinked).toBe(true)
    })
  })

  test('resolves config-specific dotenv', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      await writeFile(joinPath(dir, '.env'), 'KEY=default')
      await writeFile(joinPath(dir, '.env.staging'), 'KEY=staging')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project, 'staging')

      expect(config.dotenv).toBeDefined()
      expect(config.dotenv!.variables.KEY).toBe('staging')
    })
  })

  test('resolves hidden config for client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc123"')
      await mkdir(joinPath(dir, '.shopify'))
      await writeFile(
        joinPath(dir, '.shopify', 'project.json'),
        JSON.stringify({abc123: {dev_store_url: 'test.myshopify.com'}}),
      )
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(config.hiddenConfig).toStrictEqual({dev_store_url: 'test.myshopify.com'})
    })
  })

  test('returns empty hidden config when no entry for client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc123"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(config.hiddenConfig).toStrictEqual({})
    })
  })

  test('file.path is absolute', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project)

      expect(config.file.path).toBe(joinPath(dir, 'shopify.app.toml'))
    })
  })

  test('accepts full filename as config name', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')
      const project = await Project.load(dir)

      const config = await selectActiveConfig(project, 'shopify.app.staging.toml')

      expect(basename(config.file.path)).toBe('shopify.app.staging.toml')
      expect(config.file.content.client_id).toBe('staging')
    })
  })

  test('throws when requested config does not exist', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      const project = await Project.load(dir)

      await expect(selectActiveConfig(project, 'nonexistent')).rejects.toThrow()
    })
  })

  test('loads with errors when the only app config is malformed', async () => {
    await inTemporaryDirectory(async (dir) => {
      // The only config is broken TOML — Project.load includes it with errors
      await writeFile(joinPath(dir, 'shopify.app.toml'), '{{invalid toml')

      const project = await Project.load(dir)
      expect(project.appConfigFiles).toHaveLength(1)
      expect(project.appConfigFiles[0]!.errors).toHaveLength(1)
      expect(project.errors).toHaveLength(1)
      expect(project.errors[0]!.path).toContain('shopify.app.toml')
    })
  })

  test('selects a broken config and exposes its errors', async () => {
    await inTemporaryDirectory(async (dir) => {
      // Two configs: one good, one broken. Selecting the broken one succeeds
      // but the selected file has errors.
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "good"')
      await writeFile(joinPath(dir, 'shopify.app.broken.toml'), '{{invalid toml')

      const project = await Project.load(dir)
      const activeConfig = await selectActiveConfig(project, 'broken')
      expect(activeConfig.file.errors).toHaveLength(1)
    })
  })

  test('loads active config even when an unrelated config is malformed', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "good"')
      await writeFile(joinPath(dir, 'shopify.app.broken.toml'), '{{invalid toml')

      const project = await Project.load(dir)

      // The broken config is skipped, but selecting the good one works fine
      const config = await selectActiveConfig(project)

      expect(config.file.content.client_id).toBe('good')
      expect(basename(config.file.path)).toBe('shopify.app.toml')
    })
  })
})
