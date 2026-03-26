import {selectActiveConfig} from './active-config.js'
import {Project} from './project.js'
import {LocalConfigError} from '../app/local-config-error.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, normalizePath} from '@shopify/cli-kit/node/path'

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

  test('throws LocalConfigError when requested config does not exist', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"')
      const project = await Project.load(dir)

      try {
        await selectActiveConfig(project, 'nonexistent')
        expect.fail('Expected selectActiveConfig to throw')
      } catch (error) {
        if (!(error instanceof LocalConfigError)) throw error
        expect(error.configurationPath).toBe(joinPath(dir, 'shopify.app.nonexistent.toml'))
        expect(error.message).toBe(`Couldn't find shopify.app.nonexistent.toml in ${normalizePath(dir)}.`)
        expect(error.issues[0]).toMatchObject({
          filePath: joinPath(dir, 'shopify.app.nonexistent.toml'),
          path: [],
          pathString: 'root',
        })
      }
    })
  })

  test('throws a structured parse error when the only app config is malformed', async () => {
    await inTemporaryDirectory(async (dir) => {
      // The only config is broken TOML — Project.load should surface the parse error.
      await writeFile(joinPath(dir, 'shopify.app.toml'), '{{invalid toml')

      try {
        await Project.load(dir)
        expect.fail('Expected Project.load to throw')
      } catch (error) {
        if (!(error instanceof LocalConfigError)) throw error
        expect(error.message).toMatch(/Unknown character/)
        expect(error.issues[0]).toMatchObject({
          filePath: joinPath(dir, 'shopify.app.toml'),
          path: [],
          pathString: 'root',
        })
      }
    })
  })

  test('surfaces parse error when selecting a broken config while a valid one exists', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "good"')
      await writeFile(joinPath(dir, 'shopify.app.broken.toml'), '{{invalid toml')

      const project = await Project.load(dir)

      try {
        await selectActiveConfig(project, 'shopify.app.broken.toml')
        expect.fail('Expected selectActiveConfig to throw')
      } catch (error) {
        if (!(error instanceof LocalConfigError)) throw error
        expect(error.message).toMatch(/Unknown character/)
        expect(error.issues[0]).toMatchObject({
          filePath: joinPath(dir, 'shopify.app.broken.toml'),
          path: [],
          pathString: 'root',
        })
      }
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
