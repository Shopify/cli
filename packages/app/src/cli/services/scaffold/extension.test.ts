// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import extensionInit, {getRuntimeDependencies} from './extension'
import {
  blocks,
  configurationFileNames,
  ExtensionTypes,
  uiExtensions,
  functionExtensions,
  themeExtensions,
  uiExtensionRendererDependency,
} from '../../constants'
import {describe, it, expect, vi, beforeEach, afterEach, test} from 'vitest'
import {file, output, path, dependency} from '@shopify/cli-kit'
import {load as loadApp} from '$cli/models/app/app'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    dependency: {
      addNPMDependenciesIfNeeded: vi.fn(),
    },
  }
})

describe('initialize a extension', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir()
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
    const webConfigurationPath = path.join(tmpDir, blocks.web.directoryName, blocks.web.configurationName)

    const appConfiguration = `
      name = "my_app"
      scopes = "read_products"
      `
    const webConfiguration = `
    type = "backend"

    [commands]
    build = "./build.sh"
    dev = "./test.sh"
    `
    await file.write(appConfigurationPath, appConfiguration)
    await file.mkdir(path.dirname(webConfigurationPath))
    await file.write(webConfigurationPath, webConfiguration)
  })
  afterEach(async () => {
    vi.clearAllMocks()
    if (tmpDir) {
      await file.rmdir(tmpDir)
    }
  })

  interface CreateFromTemplateOptions {
    name: string
    extensionType: ExtensionTypes
  }
  const createFromTemplate = async ({name, extensionType}: CreateFromTemplateOptions) => {
    const stdout: any = {write: vi.fn()}
    await extensionInit({
      name,
      extensionType,
      app: await loadApp(tmpDir),
      cloneUrl: 'cloneurl',
      language: 'wasm',
    })
  }

  it(
    'successfully scaffolds the extension when no other extensions exist',
    async () => {
      vi.spyOn(output, 'info').mockImplementation(() => {})
      const name = 'my-ext-1'
      const extensionType = 'checkout_post_purchase'
      await createFromTemplate({name, extensionType})
      const scaffoldedExtension = (await loadApp(tmpDir)).extensions.ui[0]
      expect(scaffoldedExtension.configuration.name).toBe(name)
    },
    30 * 1000,
  )

  it(
    'successfully scaffolds the extension when another extension exists',
    async () => {
      const name1 = 'my-ext-1'
      const name2 = 'my-ext-2'
      const extensionType = 'checkout_post_purchase'
      await createFromTemplate({name: name1, extensionType})
      await createFromTemplate({name: name2, extensionType})
      const addDependenciesCalls = vi.mocked(dependency.addNPMDependenciesIfNeeded).mock.calls
      expect(addDependenciesCalls.length).toEqual(2)

      const loadedApp = await loadApp(tmpDir)
      const scaffoldedExtension2 = loadedApp.extensions.ui.sort((lhs, rhs) =>
        lhs.directory < rhs.directory ? -1 : 1,
      )[1]
      expect(scaffoldedExtension2.configuration.name).toBe(name2)

      const firstDependenciesCallArgs = addDependenciesCalls[0]
      expect(firstDependenciesCallArgs[0]).toEqual(['react', '@shopify/post-purchase-ui-extensions-react'])
      expect(firstDependenciesCallArgs[1].dependencyManager).toEqual('npm')
      expect(firstDependenciesCallArgs[1].type).toEqual('prod')
      expect(firstDependenciesCallArgs[1].directory).toEqual(loadedApp.directory)

      const secondDependencyCallArgs = addDependenciesCalls[1]
      expect(secondDependencyCallArgs[0]).toEqual(['react', '@shopify/post-purchase-ui-extensions-react'])
      expect(secondDependencyCallArgs[1].dependencyManager).toEqual('npm')
      expect(secondDependencyCallArgs[1].type).toEqual('prod')
      expect(secondDependencyCallArgs[1].directory).toEqual(loadedApp.directory)
    },
    30 * 1000,
  )

  it(
    'errors when trying to re-scaffold an existing extension',
    async () => {
      const name = 'my-ext-1'
      const extensionType = 'checkout_post_purchase'
      await createFromTemplate({name, extensionType})
      await expect(createFromTemplate({name, extensionType})).rejects.toThrow(`Extension ${name} already exists!`)
    },
    30 * 1000,
  )
})

describe('getRuntimeDependencies', () => {
  test('returns an empty list for extensions that are not UI extensions', () => {
    // Given
    const extensions: ExtensionTypes[] = [...functionExtensions.types, ...themeExtensions.types]

    // When/then
    extensions.forEach((extensionType) => {
      expect(getRuntimeDependencies({extensionType})).toEqual([])
    })
  })

  test('includes React for UI extensions', () => {
    // Given
    const extensions: ExtensionTypes[] = [...uiExtensions.types]

    // When/then
    extensions.forEach((extensionType) => {
      expect(getRuntimeDependencies({extensionType}).includes('react')).toBeTruthy()
    })
  })

  test('includes the renderer package for UI extensions', () => {
    // Given
    const extensions: ExtensionTypes[] = [...uiExtensions.types]

    // When/then
    extensions.forEach((extensionType) => {
      expect(
        getRuntimeDependencies({extensionType}).includes(uiExtensionRendererDependency(extensionType) as string),
      ).toBeTruthy()
    })
  })
})
