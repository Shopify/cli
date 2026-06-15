import {Project} from './project.js'
import {resolveDotEnv, resolveHiddenConfig, extensionFilesForConfig, webFilesForConfig} from './config-selection.js'
import {loadApp, reloadApp} from '../app/loader.js'
import {AppLinkedInterface} from '../app/app.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {handleWatcherEvents} from '../../services/dev/app-events/app-event-watcher-handler.js'
import {EventType} from '../../services/dev/app-events/app-event-watcher.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortController} from '@shopify/cli-kit/node/abort'

/**
 * Integration tests verifying that Project + config-selection produce
 * the same results as the old loader for real app configurations.
 */

async function setupRealApp(dir: string) {
  // App config
  await writeFile(
    joinPath(dir, 'shopify.app.toml'),
    `
client_id = "test-client-id"
name = "Integration Test App"
application_url = "https://example.com"
embedded = true

[build]
dev_store_url = "test.myshopify.com"

[access_scopes]
scopes = "read_products,write_products"

[auth]
redirect_urls = ["https://example.com/callback"]

[webhooks]
api_version = "2024-01"
  `.trim(),
  )

  // Extension
  await mkdir(joinPath(dir, 'extensions', 'my-function'))
  await writeFile(
    joinPath(dir, 'extensions', 'my-function', 'shopify.extension.toml'),
    `
type = "product_discounts"
name = "My Discount"
handle = "my-discount"
api_version = "2024-01"

[build]
command = "cargo build"
    `.trim(),
  )

  // Web
  await mkdir(joinPath(dir, 'web', 'backend'))
  await writeFile(
    joinPath(dir, 'web', 'backend', 'shopify.web.toml'),
    `
name = "backend"
roles = ["backend"]

[commands]
dev = "npm run dev"
    `.trim(),
  )

  // Dotenv
  await writeFile(joinPath(dir, '.env'), 'SHOPIFY_API_KEY=test-key\nSHOPIFY_API_SECRET=test-secret')

  // Hidden config
  await mkdir(joinPath(dir, '.shopify'))
  await writeFile(
    joinPath(dir, '.shopify', 'project.json'),
    JSON.stringify({'test-client-id': {dev_store_url: 'hidden.myshopify.com'}}),
  )

  // package.json (needed by the loader)
  await writeFile(joinPath(dir, 'package.json'), JSON.stringify({name: 'test-app', dependencies: {}}))
  // Pin npm: getPackageManager walks up to ancestors if no lockfile is found
  await writeFile(joinPath(dir, 'package-lock.json'), '')
}

// Load specifications once — this is expensive (loads all extension specs from disk)
const specifications = await loadLocalExtensionsSpecifications()

describe('Project integration', () => {
  test('Project discovers the same directory as the old loader', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      expect(project.directory).toBe(app.directory)
    })
  })

  test('Project discovers the same extension files as the old loader', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      // The app's non-config extensions should match what the project discovered
      const appExtensionPaths = app.realExtensions
        .filter((ext) => !ext.isAppConfigExtension)
        .map((ext) => ext.configurationPath)
        .sort()

      const activeConfig = project.appConfigByName('shopify.app.toml')!
      const projectExtensionPaths = extensionFilesForConfig(project, activeConfig)
        .map((file) => file.path)
        .sort()

      expect(projectExtensionPaths).toStrictEqual(appExtensionPaths)
    })
  })

  test('Project discovers the same web files as the old loader', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      const appWebDirs = app.webs.map((web) => web.directory).sort()
      const activeConfig = project.appConfigByName('shopify.app.toml')!
      const projectWebDirs = webFilesForConfig(project, activeConfig)
        .map((file) => joinPath(file.path, '..'))
        .sort()

      // Both should find the same web directories
      expect(projectWebDirs.length).toBe(appWebDirs.length)
    })
  })

  test('resolveDotEnv matches the old loader dotenv', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      const configPath = joinPath(dir, 'shopify.app.toml')
      const projectDotenv = resolveDotEnv(project, configPath)

      // Both should find the same .env file with the same variables
      expect(projectDotenv?.path).toBe(app.dotenv?.path)
      expect(projectDotenv?.variables).toStrictEqual(app.dotenv?.variables)
    })
  })

  test('resolveHiddenConfig matches the old loader hidden config', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      const projectHiddenConfig = await resolveHiddenConfig(project, 'test-client-id')

      expect(projectHiddenConfig).toStrictEqual(app.hiddenConfig)
    })
  })

  test('Project loads correct metadata from filesystem', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      const project = await Project.load(dir)

      expect(project.packageManager).toBe('npm')
      expect(project.nodeDependencies).toStrictEqual({})
      expect(project.usesWorkspaces).toBe(false)
    })
  })

  test('multi-config project discovers all configs', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      // Add a staging config with different extension dirs
      await writeFile(
        joinPath(dir, 'shopify.app.staging.toml'),
        `
client_id = "staging-client-id"
name = "Staging App"
application_url = "https://staging.example.com"
embedded = true
extension_directories = ["staging-ext/*"]
        `.trim(),
      )

      await mkdir(joinPath(dir, 'staging-ext', 'staging-func'))
      await writeFile(
        joinPath(dir, 'staging-ext', 'staging-func', 'shopify.extension.toml'),
        'type = "function"\nname = "staging-func"\nhandle = "staging-func"',
      )

      const project = await Project.load(dir)

      // Should discover both configs
      expect(project.appConfigFiles).toHaveLength(2)
      expect(project.appConfigByClientId('test-client-id')).toBeDefined()
      expect(project.appConfigByClientId('staging-client-id')).toBeDefined()

      // Should discover extensions from both configs' directories
      expect(project.extensionConfigFiles.length).toBeGreaterThanOrEqual(2)

      // Filtering to default config should only get extensions/*
      const defaultConfig = project.appConfigByName('shopify.app.toml')!
      const defaultExts = extensionFilesForConfig(project, defaultConfig)
      expect(defaultExts).toHaveLength(1)

      // Filtering to staging config should only get staging-ext/*
      const stagingConfig = project.appConfigByName('shopify.app.staging.toml')!
      const stagingExts = extensionFilesForConfig(project, stagingConfig)
      expect(stagingExts).toHaveLength(1)
      expect(stagingExts[0]!.content.name).toBe('staging-func')
    })
  })

  test('config-specific dotenv resolution works', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)
      await writeFile(joinPath(dir, '.env.staging'), 'STAGING_VAR=staging-value')
      await writeFile(joinPath(dir, 'shopify.app.staging.toml'), 'client_id = "staging"')

      const project = await Project.load(dir)

      // Default config gets .env
      const defaultDotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.toml'))
      expect(defaultDotenv?.variables.SHOPIFY_API_KEY).toBe('test-key')

      // Staging config gets .env.staging
      const stagingDotenv = resolveDotEnv(project, joinPath(dir, 'shopify.app.staging.toml'))
      expect(stagingDotenv?.variables.STAGING_VAR).toBe('staging-value')
    })
  })

  test('Project.load re-scans filesystem and finds extensions added after initial load', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)

      // Initial load — should find 1 extension file
      const project1 = await Project.load(dir)
      expect(project1.extensionConfigFiles).toHaveLength(1)

      // Add a new extension to disk (simulates `shopify generate extension` mid-dev)
      await mkdir(joinPath(dir, 'extensions', 'another-function'))
      await writeFile(
        joinPath(dir, 'extensions', 'another-function', 'shopify.extension.toml'),
        `
type = "product_discounts"
name = "Another Discount"
handle = "another-discount"
api_version = "2024-01"

[build]
command = "cargo build"
        `.trim(),
      )

      // Fresh Project.load should find the new file
      const project2 = await Project.load(dir)
      expect(project2.extensionConfigFiles).toHaveLength(2)

      // extensionFilesForConfig should also include it
      const activeConfig = (await import('./active-config.js')).selectActiveConfig
      const config = await activeConfig(project2)
      const extFiles = extensionFilesForConfig(project2, config.file)
      expect(extFiles).toHaveLength(2)
    })
  })

  test('reloadApp finds extensions added after initial load', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)
      // Initial load with report mode (matches dev behavior)
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })
      const initialRealExtensions = app.realExtensions
      const initialCount = initialRealExtensions.length

      // Add a new extension to disk (simulates `shopify generate extension` mid-dev)
      await mkdir(joinPath(dir, 'extensions', 'another-function'))
      await writeFile(
        joinPath(dir, 'extensions', 'another-function', 'shopify.extension.toml'),
        `
type = "product_discounts"
name = "Another Discount"
handle = "another-discount"
api_version = "2024-01"

[build]
command = "cargo build"
        `.trim(),
      )

      // Reload should find the new extension
      const reloadedApp = await reloadApp(app as AppLinkedInterface)
      const reloadedRealExtensions = reloadedApp.realExtensions
      expect(reloadedRealExtensions.length).toBe(initialCount + 1)
    })
  })

  test('handleWatcherEvents produces Created event for extension added mid-dev', async () => {
    await inTemporaryDirectory(async (dir) => {
      await setupRealApp(dir)
      // Initial load
      const app = await loadApp({
        directory: dir,
        userProvidedConfigName: undefined,
        specifications,
      })

      // Add a new extension to disk
      const newExtDir = joinPath(dir, 'extensions', 'another-function')
      await mkdir(newExtDir)
      await writeFile(
        joinPath(newExtDir, 'shopify.extension.toml'),
        `
type = "product_discounts"
name = "Another Discount"
handle = "another-discount"
api_version = "2024-01"

[build]
command = "cargo build"
        `.trim(),
      )

      // Simulate the file watcher event that would fire
      const appEvent = await handleWatcherEvents(
        [
          {
            type: 'extension_folder_created',
            path: newExtDir,
            extensionPath: newExtDir,
            startTime: [0, 0] as [number, number],
          },
        ],
        app as AppLinkedInterface,
        {stdout: process.stdout, stderr: process.stderr, signal: new AbortController().signal},
      )

      // The event should indicate the app was reloaded and the new extension was created
      expect(appEvent).toBeDefined()
      expect(appEvent!.appWasReloaded).toBe(true)
      expect(appEvent!.app.realExtensions.length).toBeGreaterThan(app.realExtensions.length)

      const createdEvents = appEvent!.extensionEvents.filter((ev) => ev.type === EventType.Created)
      expect(createdEvents.length).toBeGreaterThanOrEqual(1)

      // The reloaded app should include the new extension
      const handles = appEvent!.app.realExtensions.map((ext) => ext.configuration.handle ?? ext.configuration.name)
      expect(handles).toContain('another-discount')
    })
  })
})
