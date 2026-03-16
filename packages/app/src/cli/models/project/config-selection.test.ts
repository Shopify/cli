import {resolveDotEnv, resolveHiddenConfig, extensionFilesForConfig, webFilesForConfig} from './config-selection.js'
import {Project} from './project.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

async function setupProject(dir: string, appToml = 'client_id = "abc"'): Promise<Project> {
  await writeFile(joinPath(dir, 'shopify.app.toml'), appToml)
  return Project.load(dir)
}

describe('resolveDotEnv', () => {
  test('returns default .env for shopify.app.toml', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, '.env'), 'KEY=default')
      const project = await setupProject(dir)

      const dotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.toml'))

      expect(dotenv).toBeDefined()
      expect(dotenv!.variables.KEY).toBe('default')
    })
  })

  test('returns config-specific .env.staging for shopify.app.staging.toml', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, '.env'), 'KEY=default')
      await writeFile(joinPath(dir, '.env.staging'), 'KEY=staging')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')
      const project = await setupProject(dir)

      const dotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.staging.toml'))

      expect(dotenv).toBeDefined()
      expect(dotenv!.variables.KEY).toBe('staging')
    })
  })

  test('falls back to default .env when config-specific dotenv missing', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, '.env'), 'KEY=default')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')
      const project = await setupProject(dir)

      const dotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.staging.toml'))

      expect(dotenv).toBeDefined()
      expect(dotenv!.variables.KEY).toBe('default')
    })
  })

  test('returns undefined when no dotenv files exist', async () => {
    await inTemporaryDirectory(async (dir) => {
      const project = await setupProject(dir)

      const dotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.toml'))

      expect(dotenv).toBeUndefined()
    })
  })
})

describe('resolveHiddenConfig', () => {
  test('returns config for specific client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      await mkdir(joinPath(dir, '.shopify'))
      await writeFile(
        joinPath(dir, '.shopify', 'project.json'),
        JSON.stringify({
          abc: {dev_store_url: 'abc.myshopify.com'},
          def: {dev_store_url: 'def.myshopify.com'},
        }),
      )
      const project = await setupProject(dir)

      const config = await resolveHiddenConfig(project, 'abc')
      expect(config).toStrictEqual({dev_store_url: 'abc.myshopify.com'})
    })
  })

  test('returns empty for unknown client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      await mkdir(joinPath(dir, '.shopify'))
      await writeFile(
        joinPath(dir, '.shopify', 'project.json'),
        JSON.stringify({abc: {dev_store_url: 'abc.myshopify.com'}}),
      )
      const project = await setupProject(dir)

      const config = await resolveHiddenConfig(project, 'unknown')
      expect(config).toStrictEqual({})
    })
  })

  test('returns empty for undefined client_id', async () => {
    await inTemporaryDirectory(async (dir) => {
      const project = await setupProject(dir)
      const config = await resolveHiddenConfig(project, undefined)
      expect(config).toStrictEqual({})
    })
  })

  test('handles legacy format with top-level dev_store_url', async () => {
    await inTemporaryDirectory(async (dir) => {
      await mkdir(joinPath(dir, '.shopify'))
      await writeFile(
        joinPath(dir, '.shopify', 'project.json'),
        JSON.stringify({dev_store_url: 'legacy.myshopify.com'}),
      )
      const project = await setupProject(dir)

      const config = await resolveHiddenConfig(project, 'any-client-id')
      expect(config).toStrictEqual({dev_store_url: 'legacy.myshopify.com'})
    })
  })
})

describe('extensionFilesForConfig', () => {
  test('returns extensions from default directory when no extension_directories set', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc"')
      await mkdir(joinPath(dir, 'extensions', 'my-ext'))
      await writeFile(joinPath(dir, 'extensions', 'my-ext', 'shopify.extension.toml'), 'type = "function"')
      const project = await Project.load(dir)
      const activeConfig = project.appConfigFiles[0]!

      const extFiles = extensionFilesForConfig(project, activeConfig)

      expect(extFiles).toHaveLength(1)
    })
  })

  test('filters to active config extension_directories only', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"\nextension_directories = ["ext-a/*"]')
      await writeFile(
        joinPath(dir, 'shopify.app.staging.toml'),
        'client_id = "staging"\nextension_directories = ["ext-b/*"]',
      )

      await mkdir(joinPath(dir, 'ext-a', 'func1'))
      await writeFile(joinPath(dir, 'ext-a', 'func1', 'shopify.extension.toml'), 'type = "function"\nname = "func1"')
      await mkdir(joinPath(dir, 'ext-b', 'func2'))
      await writeFile(joinPath(dir, 'ext-b', 'func2', 'shopify.extension.toml'), 'type = "function"\nname = "func2"')

      const project = await Project.load(dir)
      const defaultConfig = project.appConfigByName('shopify.app.toml')!
      const stagingConfig = project.appConfigByName('shopify.app.staging.toml')!

      // Default config should only see ext-a
      const defaultExts = extensionFilesForConfig(project, defaultConfig)
      expect(defaultExts).toHaveLength(1)
      expect(defaultExts[0]!.content.name).toBe('func1')

      // Staging config should only see ext-b
      const stagingExts = extensionFilesForConfig(project, stagingConfig)
      expect(stagingExts).toHaveLength(1)
      expect(stagingExts[0]!.content.name).toBe('func2')
    })
  })
})

describe('webFilesForConfig', () => {
  test('returns all web files when no web_directories set', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "abc"')
      await mkdir(joinPath(dir, 'web', 'backend'))
      await writeFile(joinPath(dir, 'web', 'backend', 'shopify.web.toml'), 'name = "backend"\nroles = ["backend"]')
      const project = await Project.load(dir)
      const activeConfig = project.appConfigFiles[0]!

      const webFiles = webFilesForConfig(project, activeConfig)

      expect(webFiles).toHaveLength(1)
    })
  })

  test('filters to active config web_directories', async () => {
    await inTemporaryDirectory(async (dir) => {
      await writeFile(joinPath(dir, 'shopify.app.toml'), 'client_id = "default"\nweb_directories = ["web-a"]')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"\nweb_directories = ["web-b"]')

      await mkdir(joinPath(dir, 'web-a'))
      await writeFile(joinPath(dir, 'web-a', 'shopify.web.toml'), 'name = "web-a"\nroles = ["backend"]')
      await mkdir(joinPath(dir, 'web-b'))
      await writeFile(joinPath(dir, 'web-b', 'shopify.web.toml'), 'name = "web-b"\nroles = ["backend"]')

      const project = await Project.load(dir)
      const defaultConfig = project.appConfigByName('shopify.app.toml')!

      const webFiles = webFilesForConfig(project, defaultConfig)
      expect(webFiles).toHaveLength(1)
      expect(webFiles[0]!.content.name).toBe('web-a')
    })
  })
})
