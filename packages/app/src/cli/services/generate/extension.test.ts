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

  it.each(uiExtensions.types.map((type) => [type]))(
    'adds dependencies for "%s" extension when extension flavor is "typescript-react"',

    async (extensionType) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          extensionType,
          appDirectory: tmpDir,
          name: 'extension-name',
          extensionFlavor: 'typescript-react',
        })

        expect(addResolutionOrOverrideMock).toHaveBeenCalledOnce()
        expect(addResolutionOrOverrideMock).toHaveBeenCalledWith(expect.any(String), {
          '@types/react': expect.any(String),
        })
      })
    },
    30 * 1000,
  )

  it.each(
    uiExtensions.types.reduce((accumulator, type) => {
      accumulator.push([type, 'vanilla-js'])
      accumulator.push([type, 'react'])
      accumulator.push([type, 'typescript'])

      return accumulator
    }, [] as [ExtensionTypes, ExtensionFlavor][]),
  )(
    'does not add dependencies for "%s" extension when extension flavor is "%s"',

    async (extensionType, extensionFlavor) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          extensionType,
          extensionFlavor,
          appDirectory: tmpDir,
          name: 'extension-name',
        })

        expect(addResolutionOrOverrideMock).not.toHaveBeenCalled()
      })
    },
    30 * 1000,
  )

  it.each(
    uiExtensions.types.reduce((accumulator, type) => {
      accumulator.push([type, 'vanilla-js', 'js'])
      accumulator.push([type, 'react', 'jsx'])
      accumulator.push([type, 'typescript', 'ts'])
      accumulator.push([type, 'typescript-react', 'tsx'])

      return accumulator
    }, [] as [ExtensionTypes, ExtensionFlavor, FileExtension][]),
  )(
    'creates "%s" for "%s" with ".%s" src files',

    async (extensionType, extensionFlavor, fileExtension) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'extension-name'

        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})

        const srcFiles = await path.glob(path.join(tmpDir, 'extensions', name, 'src', `*`))

        expect(srcFiles.length).toBeGreaterThan(0)

        srcFiles.forEach((filePath) => {
          expect(filePath.endsWith(`.${fileExtension}`)).toBe(true)
        })
      })
    },
    30 * 1000,
  )

  it.each(
    uiExtensions.types.reduce((accumulator, type) => {
      accumulator.push([type, 'vanilla-js', 'js'])
      accumulator.push([type, 'react', 'jsx'])
      accumulator.push([type, 'typescript', 'ts'])
      accumulator.push([type, 'typescript-react', 'tsx'])

      return accumulator
    }, [] as [ExtensionTypes, ExtensionFlavor, FileExtension][]),
  )(
    'calls recursiveDirectoryCopy with type "%s", flavor "%s", liquidFlavor "%s" and fileExtension "%s"',

    async (extensionType, extensionFlavor, srcFileExtension) => {
      await withTemporaryApp(async (tmpDir: string) => {
        vi.spyOn(file, 'move').mockResolvedValue()

        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveDirectoryCopy').mockResolvedValue()
        const name = 'extension-name'

        await createFromTemplate({name, extensionType, extensionFlavor, appDirectory: tmpDir})

        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          type: extensionType,
          flavor: extensionFlavor,
          srcFileExtension,
          name,
        })
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
