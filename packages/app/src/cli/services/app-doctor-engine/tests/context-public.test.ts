import {
  inCanonicalTemporaryDirectory,
  independentIdentity,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {
  AppDoctorContextError,
  createAppDoctorContext,
  discoverAppDoctorApps,
  inspectAppDoctorConfigurations,
  selectAppDoctorApp,
  selectAppDoctorConfiguration,
} from '../index.js'
import {describe, expect, test} from 'vitest'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {unlink} from 'node:fs/promises'
import type {AppDoctorContext} from '../index.js'

async function resolveThroughEngine(
  directory: string,
  options: {configName?: string; clientId?: string; cachedConfigName?: string} = {},
): Promise<AppDoctorContext> {
  const discovery = await discoverAppDoctorApps({directory})
  const app = selectAppDoctorApp(discovery)
  const configurations = await inspectAppDoctorConfigurations(app.directory)
  const decision = selectAppDoctorConfiguration(configurations, {
    explicitConfigurationPath: discovery.explicitConfigurationPath,
    interactive: false,
    ...options,
  })
  if (decision.type !== 'selected') throw new Error('unexpected selection-required decision')
  return createAppDoctorContext(decision.selection)
}

describe('createAppDoctorContext', () => {
  test('composes discovery, inspection, selection, anchor and identity into a frozen context', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const repository = await makeFixtureDirectory(root, 'repo')
      await makeFixtureDirectory(repository, '.git')
      await writeFixtureFile(repository, 'packages/app/shopify.app.toml', linkedConfiguration('default-id'))
      const staging = await writeFixtureFile(
        repository,
        'packages/app/shopify.app.staging.toml',
        linkedConfiguration('staging-id'),
      )
      const nestedStart = await makeFixtureDirectory(repository, 'packages/app/web')

      const context = await resolveThroughEngine(nestedStart, {clientId: 'staging-id'})

      const identity = independentIdentity('packages/app/shopify.app.staging.toml')
      expect(context).toEqual({
        appRoot: joinPath(repository, 'packages/app'),
        configurationPath: staging,
        configurationFileName: 'shopify.app.staging.toml',
        configurationIdentity: identity,
        storageAnchor: repository,
        storageAnchorKind: 'repository',
        storeDirectory: joinPath(repository, '.shopify', 'app-doctor', 'v1', identity),
        configurationState: 'parsed',
        clientId: 'staging-id',
        selectionSource: 'client-id',
      })
      expect(Object.isFrozen(context)).toBe(true)
      expect(Object.getPrototypeOf(context)).toBe(Object.prototype)
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
      await expect(fileExists(joinPath(repository, '.shopify'))).resolves.toBe(false)
    })
  })

  test('anchors at the app root and omits clientId for unlinked configurations', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml', 'name = "Unlinked"\n')
      const context = await resolveThroughEngine(configurationPath)
      expect(context).toEqual({
        appRoot: joinPath(root, 'app'),
        configurationPath,
        configurationFileName: 'shopify.app.toml',
        configurationIdentity: independentIdentity('shopify.app.toml'),
        storageAnchor: joinPath(root, 'app'),
        storageAnchorKind: 'app',
        storeDirectory: joinPath(root, 'app', '.shopify', 'app-doctor', 'v1', independentIdentity('shopify.app.toml')),
        configurationState: 'parsed',
        selectionSource: 'file',
      })
      expect('clientId' in context).toBe(false)
    })
  })

  test('keeps malformed configurations selectable by name', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'app/shopify.app.toml')
      await writeFixtureFile(root, 'app/shopify.app.broken.toml', '= not toml')
      const context = await resolveThroughEngine(joinPath(root, 'app'), {configName: 'broken'})
      expect(context.configurationState).toBe('malformed')
      expect(context.selectionSource).toBe('config')
    })
  })

  test('fails when the selected file disappears before the context is built', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml')
      const configurations = await inspectAppDoctorConfigurations(joinPath(root, 'app'))
      const decision = selectAppDoctorConfiguration(configurations, {interactive: false})
      if (decision.type !== 'selected') throw new Error('unexpected decision')
      await unlink(configurationPath)
      const result = createAppDoctorContext(decision.selection)
      await expect(result).rejects.toBeInstanceOf(AppDoctorContextError)
      await expect(result).rejects.toMatchObject({code: 'PATH_NOT_FOUND'})
    })
  })

  test('rejects selections that are not canonical configuration files', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'app/notes.txt')
      await expect(
        createAppDoctorContext({
          configuration: {path: joinPath(root, 'app/notes.txt'), fileName: 'notes.txt', state: 'parsed'},
          source: 'default',
        }),
      ).rejects.toMatchObject({code: 'INVALID_CONFIGURATION_SELECTION'})
      await expect(
        createAppDoctorContext({
          configuration: {path: 'app/shopify.app.toml', fileName: 'shopify.app.toml', state: 'parsed'},
          source: 'default',
        }),
      ).rejects.toMatchObject({code: 'INVALID_CONFIGURATION_SELECTION'})
    })
  })
})
