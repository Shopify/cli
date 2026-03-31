import {Project} from './project.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'

async function writeAppToml(directory: string, content: string, name = 'shopify.app.toml'): Promise<void> {
  await writeFile(joinPath(directory, name), content)
}

async function writeExtensionToml(directory: string, extName: string, content: string): Promise<void> {
  const extDir = joinPath(directory, 'extensions', extName)
  await mkdir(extDir)
  await writeFile(joinPath(extDir, 'shopify.extension.toml'), content)
}

async function writeWebToml(directory: string, webName: string, content: string): Promise<void> {
  const webDir = joinPath(directory, 'web', webName)
  await mkdir(webDir)
  await writeFile(joinPath(webDir, 'shopify.web.toml'), content)
}

describe('Project', () => {
  describe('load', () => {
    test('discovers the app config file', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc123"\nname = "Test App"')

        const project = await Project.load(dir)

        expect(normalizePath(project.directory)).toBe(normalizePath(dir))
        expect(project.appConfigFiles).toHaveLength(1)
        expect(project.appConfigFiles[0]!.content.client_id).toBe('abc123')
      })
    })

    test('discovers multiple app config files', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "default"')
        await writeAppToml(dir, 'client_id = "staging"', 'shopify.app.staging.toml')
        await writeAppToml(dir, 'client_id = "production"', 'shopify.app.production.toml')

        const project = await Project.load(dir)

        expect(project.appConfigFiles).toHaveLength(3)
        const clientIds = project.appConfigFiles.map((file) => file.content.client_id).sort()
        expect(clientIds).toStrictEqual(['default', 'production', 'staging'])
      })
    })

    test('discovers extension config files', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await writeExtensionToml(dir, 'my-func', 'type = "function"\nname = "my-func"')
        await writeExtensionToml(dir, 'my-ui', 'type = "ui_extension"\nname = "my-ui"')

        const project = await Project.load(dir)

        expect(project.extensionConfigFiles).toHaveLength(2)
      })
    })

    test('discovers web config files', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await writeWebToml(dir, 'backend', 'name = "backend"\nroles = ["backend"]')

        const project = await Project.load(dir)

        expect(project.webConfigFiles).toHaveLength(1)
        expect(project.webConfigFiles[0]!.content.name).toBe('backend')
      })
    })

    test('discovers all dotenv files', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await writeFile(joinPath(dir, '.env'), 'DEFAULT_KEY=default')
        await writeFile(joinPath(dir, '.env.staging'), 'STAGING_KEY=staging')
        await writeFile(joinPath(dir, '.env.production'), 'PROD_KEY=prod')

        const project = await Project.load(dir)

        expect(project.dotenvFiles.size).toBe(3)
        expect(project.dotenvFiles.get('.env')?.variables.DEFAULT_KEY).toBe('default')
        expect(project.dotenvFiles.get('.env.staging')?.variables.STAGING_KEY).toBe('staging')
        expect(project.dotenvFiles.get('.env.production')?.variables.PROD_KEY).toBe('prod')
      })
    })

    test('loads raw hidden config', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await mkdir(joinPath(dir, '.shopify'))
        await writeFile(
          joinPath(dir, '.shopify', 'project.json'),
          JSON.stringify({
            abc: {dev_store_url: 'abc.myshopify.com'},
            def: {dev_store_url: 'def.myshopify.com'},
          }),
        )

        const project = await Project.load(dir)

        expect(project.hiddenConfigRaw.abc).toStrictEqual({dev_store_url: 'abc.myshopify.com'})
        expect(project.hiddenConfigRaw.def).toStrictEqual({dev_store_url: 'def.myshopify.com'})
      })
    })

    test('returns empty hidden config when file is missing', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')

        const project = await Project.load(dir)

        expect(project.hiddenConfigRaw).toStrictEqual({})
      })
    })

    test('throws when no app config files found', async () => {
      await inTemporaryDirectory(async (dir) => {
        await expect(Project.load(dir)).rejects.toThrow()
      })
    })

    test('uses custom extension_directories from app config', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"\nextension_directories = ["custom/*"]')
        const customDir = joinPath(dir, 'custom', 'my-ext')
        await mkdir(customDir)
        await writeFile(joinPath(customDir, 'shopify.extension.toml'), 'type = "function"\nname = "custom-ext"')

        const project = await Project.load(dir)

        expect(project.extensionConfigFiles).toHaveLength(1)
        expect(project.extensionConfigFiles[0]!.content.name).toBe('custom-ext')
      })
    })

    test('unions extension_directories from all app configs', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "default"\nextension_directories = ["ext-a/*"]')
        await writeAppToml(
          dir,
          'client_id = "staging"\nextension_directories = ["ext-b/*"]',
          'shopify.app.staging.toml',
        )

        const extADir = joinPath(dir, 'ext-a', 'func1')
        await mkdir(extADir)
        await writeFile(joinPath(extADir, 'shopify.extension.toml'), 'type = "function"\nname = "func1"')

        const extBDir = joinPath(dir, 'ext-b', 'func2')
        await mkdir(extBDir)
        await writeFile(joinPath(extBDir, 'shopify.extension.toml'), 'type = "function"\nname = "func2"')

        const project = await Project.load(dir)

        expect(project.extensionConfigFiles).toHaveLength(2)
      })
    })

    test('includes malformed inactive app config with errors without blocking active config', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "good"')
        await writeAppToml(dir, '{{invalid toml content', 'shopify.app.broken.toml')

        const project = await Project.load(dir)

        expect(project.appConfigFiles).toHaveLength(2)
        const good = project.appConfigFiles.find((file) => file.content.client_id === 'good')
        const broken = project.appConfigFiles.find((file) => file.errors.length > 0)
        expect(good).toBeDefined()
        expect(broken).toBeDefined()
        expect(broken!.path).toContain('shopify.app.broken.toml')
        expect(project.errors).toHaveLength(1)
      })
    })

    test('includes malformed extension TOML with errors without blocking project load', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await writeExtensionToml(dir, 'good-ext', 'type = "function"\nname = "good"')
        await writeExtensionToml(dir, 'bad-ext', '{{broken toml')

        const project = await Project.load(dir)

        expect(project.extensionConfigFiles).toHaveLength(2)
        const good = project.extensionConfigFiles.find((file) => file.content.name === 'good')
        const broken = project.extensionConfigFiles.find((file) => file.errors.length > 0)
        expect(good).toBeDefined()
        expect(broken).toBeDefined()
        expect(project.errors).toHaveLength(1)
      })
    })

    test('includes malformed web TOML with errors without blocking project load', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await writeWebToml(dir, 'good-web', 'name = "good"\nroles = ["backend"]')
        await writeWebToml(dir, 'bad-web', '{{broken toml')

        const project = await Project.load(dir)

        expect(project.webConfigFiles).toHaveLength(2)
        const good = project.webConfigFiles.find((file) => file.content.name === 'good')
        const broken = project.webConfigFiles.find((file) => file.errors.length > 0)
        expect(good).toBeDefined()
        expect(broken).toBeDefined()
        expect(project.errors).toHaveLength(1)
      })
    })

    test('handles missing dotenv gracefully', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')

        const project = await Project.load(dir)

        expect(project.dotenvFiles.size).toBe(0)
      })
    })

    test('handles legacy hidden config format', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')
        await mkdir(joinPath(dir, '.shopify'))
        await writeFile(
          joinPath(dir, '.shopify', 'project.json'),
          JSON.stringify({dev_store_url: 'legacy.myshopify.com'}),
        )

        const project = await Project.load(dir)

        expect(project.hiddenConfigRaw.dev_store_url).toBe('legacy.myshopify.com')
      })
    })
  })

  describe('file lookup', () => {
    test('appConfigByName finds by filename', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "default"')
        await writeAppToml(dir, 'client_id = "staging"', 'shopify.app.staging.toml')

        const project = await Project.load(dir)

        const staging = project.appConfigByName('shopify.app.staging.toml')
        expect(staging).toBeDefined()
        expect(staging!.content.client_id).toBe('staging')

        const missing = project.appConfigByName('shopify.app.missing.toml')
        expect(missing).toBeUndefined()
      })
    })

    test('appConfigByClientId finds by client_id', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc123"')
        await writeAppToml(dir, 'client_id = "def456"', 'shopify.app.staging.toml')

        const project = await Project.load(dir)

        const found = project.appConfigByClientId('def456')
        expect(found).toBeDefined()
        expect(found!.path).toContain('staging')
      })
    })

    test('defaultAppConfig returns shopify.app.toml', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "default"')
        await writeAppToml(dir, 'client_id = "staging"', 'shopify.app.staging.toml')

        const project = await Project.load(dir)

        expect(project.defaultAppConfig).toBeDefined()
        expect(project.defaultAppConfig!.content.client_id).toBe('default')
      })
    })

    test('defaultAppConfig returns undefined when only named configs exist', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "staging"', 'shopify.app.staging.toml')

        const project = await Project.load(dir)

        expect(project.defaultAppConfig).toBeUndefined()
      })
    })
  })

  describe('metadata', () => {
    test('exposes project directory', async () => {
      await inTemporaryDirectory(async (dir) => {
        await writeAppToml(dir, 'client_id = "abc"')

        const project = await Project.load(dir)

        expect(normalizePath(project.directory)).toBe(normalizePath(dir))
      })
    })
  })
})
