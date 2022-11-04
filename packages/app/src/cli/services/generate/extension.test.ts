import extensionInit, {getRuntimeDependencies} from './extension.js'
import {
  blocks,
  configurationFileNames,
  ExtensionTypes,
  uiExtensions,
  getUIExtensionRendererDependency,
  UIExtensionTypes,
} from '../../constants.js'
import {load as loadApp} from '../../models/app/loader.js'
import {describe, it, expect, vi, test, beforeEach} from 'vitest'
import {file, output, path, template} from '@shopify/cli-kit'
import {addNPMDependenciesIfNeeded, addResolutionOrOverride} from '@shopify/cli-kit/node/node-package-manager'
import type {ExtensionFlavor} from './extension.js'

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('initialize a extension', () => {
  it(
    'successfully generates the extension when no other extensions exist',
    async () => {
      await withTemporaryApp(async (tmpDir) => {
        vi.spyOn(output, 'info').mockImplementation(() => {})
        const name = 'my-ext-1'
        const extensionType = 'checkout_post_purchase'
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})
        const generatedExtension = (await loadApp(tmpDir)).extensions.ui[0]!
        expect(generatedExtension.configuration.name).toBe(name)
      })
    },
    30 * 1000,
  )

  it(
    'successfully generates the extension when another extension exists',
    async () => {
      await withTemporaryApp(async (tmpDir) => {
        const name1 = 'my-ext-1'
        const name2 = 'my-ext-2'
        const extensionType = 'checkout_post_purchase'
        const externalExtensionType = 'post_purchase_ui'
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({
          name: name1,
          extensionType,
          extensionFlavor,
          appDirectory: tmpDir,
        })
        await createFromTemplate({
          name: name2,
          extensionType,
          extensionFlavor,
          appDirectory: tmpDir,
        })
        const addDependenciesCalls = vi.mocked(addNPMDependenciesIfNeeded).mock.calls
        expect(addDependenciesCalls.length).toEqual(2)

        const loadedApp = await loadApp(tmpDir)
        const generatedExtension2 = loadedApp.extensions.ui.sort((lhs, rhs) =>
          lhs.directory < rhs.directory ? -1 : 1,
        )[1]!
        expect(generatedExtension2.configuration.name).toBe(name2)

        const firstDependenciesCallArgs = addDependenciesCalls[0]!
        expect(firstDependenciesCallArgs[0]).toEqual([
          {name: '@shopify/post-purchase-ui-extensions-react', version: '^0.13.2'},
        ])
        expect(firstDependenciesCallArgs[1].type).toEqual('prod')
        expect(firstDependenciesCallArgs[1].directory).toEqual(loadedApp.directory)

        const secondDependencyCallArgs = addDependenciesCalls[1]!
        expect(firstDependenciesCallArgs[0]).toEqual([
          {name: '@shopify/post-purchase-ui-extensions-react', version: '^0.13.2'},
        ])
        expect(secondDependencyCallArgs[1].type).toEqual('prod')
        expect(secondDependencyCallArgs[1].directory).toEqual(loadedApp.directory)
      })
    },
    30 * 1000,
  )

  it(
    'errors when trying to re-generate an existing extension',
    async () => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'my-ext-1'
        const extensionType = 'checkout_post_purchase'
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})
        await expect(createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})).rejects.toThrow(
          `A directory with this name (${name}) already exists.\nChoose a new name for your extension.`,
        )
      })
    },
    30 * 1000,
  )

  type FileExtension = 'js' | 'jsx' | 'ts' | 'tsx'

  // For each combination of extension type and flavor, confirm that files are created with the expected extension
  it.each(
    uiExtensions.types.reduce((accumulator, type) => {
      accumulator.push([type, 'vanilla-js', 'js'])
      accumulator.push([type, 'react', 'jsx'])
      accumulator.push([type, 'typescript', 'ts'])
      accumulator.push([type, 'typescript-react', 'tsx'])

      return accumulator
    }, [] as [ExtensionTypes, ExtensionFlavor, FileExtension][]),
  )(
    'creates %s for %s with index file at extensions/[extension-name]/src/index.%s',

    async (extensionType, extensionFlavor, fileExtension) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'extension-name'

        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})

        const addDependenciesCalls = vi.mocked(addResolutionOrOverride).mock.calls
        if (extensionFlavor === 'typescript-react') {
          expect(addDependenciesCalls.length).toEqual(1)
        } else {
          expect(addDependenciesCalls.length).toEqual(0)
        }

        const srcIndexFile = await file.read(path.join(tmpDir, 'extensions', name, 'src', `index.${fileExtension}`))
        expect(srcIndexFile.trim()).not.toBe('')
      })
    },
    30 * 1000,
  )

  // For each combination of extension type and flavor, confirm that the right parameters are passed to the template
  it.each(
    uiExtensions.types.reduce((accumulator, type) => {
      accumulator.push([type, 'vanilla-js'])
      accumulator.push([type, 'react'])
      accumulator.push([type, 'typescript'])
      accumulator.push([type, 'typescript-react'])

      return accumulator
    }, [] as [ExtensionTypes, ExtensionFlavor][]),
  )(
    'calls recursiveDirectoryCopy with type %s, flavor %s, file extension %s and liquid flavor %s',

    async (extensionType, extensionFlavor) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveDirectoryCopy').mockResolvedValue()
        const fileMoveSpy = vi.spyOn(file, 'move').mockResolvedValue()
        const name = 'extension-name'

        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})

        const addDependenciesCalls = vi.mocked(addResolutionOrOverride).mock.calls
        if (extensionFlavor === 'typescript-react') {
          expect(addDependenciesCalls.length).toEqual(1)
        } else {
          expect(addDependenciesCalls.length).toEqual(0)
        }

        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          flavor: extensionFlavor,
          type: extensionType,
          name,
        })

        recursiveDirectoryCopySpy.mockRestore()
        fileMoveSpy.mockRestore()
      })
    },
    30 * 1000,
  )
})

describe('getRuntimeDependencies', () => {
  test('no not include React for flavored Vanilla UI extensions', () => {
    // Given
    // Web Pixel extensions don't need React as a runtime dependency.
    const extensions: UIExtensionTypes[] = [...uiExtensions.types].filter(
      (extension) => extension !== 'web_pixel_extension',
    )
    const extensionFlavor: ExtensionFlavor = 'vanilla-js'

    // When/then
    extensions.forEach((extensionType) => {
      const got = getRuntimeDependencies({extensionType, extensionFlavor})
      expect(got.find((dep) => dep.name === 'react' && dep.version === '^17.0.0')).toBeFalsy()
    })
  })

  test('includes React for flavored React UI extensions', () => {
    // Given
    // Web Pixel extensions don't need React as a runtime dependency.
    const extensions: UIExtensionTypes[] = [...uiExtensions.types].filter(
      (extension) => extension !== 'web_pixel_extension',
    )
    const extensionFlavor: ExtensionFlavor = 'react'

    // When/then
    extensions.forEach((extensionType) => {
      const got = getRuntimeDependencies({extensionType, extensionFlavor})
      expect(got.find((dep) => dep.name === 'react' && dep.version === '^17.0.0')).toBeTruthy()
    })
  })

  test('includes the renderer package for UI extensions', () => {
    // Given
    const extensions: UIExtensionTypes[] = [...uiExtensions.types]

    // When/then
    extensions.forEach((extensionType) => {
      const reference = getUIExtensionRendererDependency(extensionType)
      if (reference) {
        const got = getRuntimeDependencies({extensionType})
        expect(got.find((dep) => dep.name === reference.name && dep.version === reference.version)).toBeTruthy()
      }
    })
  })
})

interface CreateFromTemplateOptions {
  name: string
  extensionType: ExtensionTypes
  appDirectory: string
  extensionFlavor: ExtensionFlavor
}
async function createFromTemplate({name, extensionType, appDirectory, extensionFlavor}: CreateFromTemplateOptions) {
  await extensionInit({
    name,
    extensionType,
    app: await loadApp(appDirectory),
    cloneUrl: 'cloneurl',
    extensionFlavor,
  })
}
async function withTemporaryApp(callback: (tmpDir: string) => Promise<void> | void) {
  await file.inTemporaryDirectory(async (tmpDir) => {
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
    await file.write(path.join(tmpDir, 'package.json'), JSON.stringify({dependencies: {}, devDependencies: {}}))
    return callback(tmpDir)
  })
}
