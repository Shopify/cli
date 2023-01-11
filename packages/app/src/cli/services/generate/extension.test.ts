import extensionInit, {getRuntimeDependencies} from './extension.js'
import {blocks, configurationFileNames} from '../../constants.js'
import {load as loadApp} from '../../models/app/loader.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {
  loadLocalExtensionsSpecifications,
  loadLocalFunctionSpecifications,
  loadLocalUIExtensionsSpecifications,
} from '../../models/extensions/specifications.js'
import {describe, it, expect, vi, test, beforeEach} from 'vitest'
import {file, git, output, path} from '@shopify/cli-kit'
import {addNPMDependenciesIfNeeded, addResolutionOrOverride} from '@shopify/cli-kit/node/node-package-manager'
import * as template from '@shopify/cli-kit/node/liquid'
import type {ExtensionFlavor} from './extension.js'

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('initialize a extension', async () => {
  const allUISpecs = await loadLocalUIExtensionsSpecifications()
  const allFunctionSpecs = await loadLocalFunctionSpecifications()
  const specifications = await loadLocalExtensionsSpecifications()

  it(
    'successfully generates the extension when no other extensions exist',
    async () => {
      await withTemporaryApp(async (tmpDir) => {
        vi.spyOn(output, 'info').mockImplementation(() => {})
        const name = 'my-ext-1'
        const specification = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({
          name,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })
        const generatedExtension = (await loadApp({directory: tmpDir, specifications})).extensions.ui[0]!
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
        const specification = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({
          name: name1,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })
        await createFromTemplate({
          name: name2,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })
        const addDependenciesCalls = vi.mocked(addNPMDependenciesIfNeeded).mock.calls
        expect(addDependenciesCalls.length).toEqual(2)

        const loadedApp = await loadApp({directory: tmpDir, specifications})
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
        const specification = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
        const extensionFlavor = 'vanilla-js'
        await createFromTemplate({
          name,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })
        await expect(
          createFromTemplate({
            name,
            specification,
            extensionFlavor,
            appDirectory: tmpDir,
            specifications,
          }),
        ).rejects.toThrow(`A directory with this name (${name}) already exists.\nChoose a new name for your extension.`)
      })
    },
    30 * 1000,
  )

  type FileExtension = 'js' | 'jsx' | 'ts' | 'tsx'

  it.each(allUISpecs.map((specification) => [specification]))(
    'adds dependencies for "%s" extension when extension flavor is "typescript-react"',

    async (specification) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          specification,
          appDirectory: tmpDir,
          name: 'extension-name',
          extensionFlavor: 'typescript-react',
          specifications,
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
    allUISpecs.reduce((accumulator, specification) => {
      accumulator.push([specification, 'vanilla-js'])
      accumulator.push([specification, 'react'])
      accumulator.push([specification, 'typescript'])

      return accumulator
    }, [] as [GenericSpecification, ExtensionFlavor][]),
  )(
    'does not add dependencies for "%s" extension when extension flavor is "%s"',

    async (specification, extensionFlavor) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          name: 'extension-name',
          specifications,
        })

        expect(addResolutionOrOverrideMock).not.toHaveBeenCalled()
      })
    },
    30 * 1000,
  )

  it.each(
    allUISpecs.reduce((accumulator, specification) => {
      accumulator.push([specification, 'vanilla-js', 'js'])
      accumulator.push([specification, 'react', 'jsx'])
      accumulator.push([specification, 'typescript', 'ts'])
      accumulator.push([specification, 'typescript-react', 'tsx'])

      return accumulator
    }, [] as [GenericSpecification, ExtensionFlavor, FileExtension][]),
  )(
    'creates "%s" for "%s" with ".%s" src files',

    async (specification, extensionFlavor, fileExtension) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'extension-name'

        await createFromTemplate({
          name,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })

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
    allUISpecs.reduce((accumulator, specification) => {
      accumulator.push([specification, 'vanilla-js', 'js'])
      accumulator.push([specification, 'react', 'jsx'])
      accumulator.push([specification, 'typescript', 'ts'])
      accumulator.push([specification, 'typescript-react', 'tsx'])

      return accumulator
    }, [] as [GenericSpecification, ExtensionFlavor, FileExtension][]),
  )(
    'calls recursiveLiquidTemplateCopy with type "%s", flavor "%s", liquidFlavor "%s" and fileExtension "%s"',

    async (specification, extensionFlavor, srcFileExtension) => {
      await withTemporaryApp(async (tmpDir: string) => {
        vi.spyOn(file, 'move').mockResolvedValue()

        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockResolvedValue()
        const name = 'extension-name'

        await createFromTemplate({
          name,
          specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })

        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          type: specification.identifier,
          flavor: extensionFlavor,
          srcFileExtension,
          name,
        })
      })
    },
    30 * 1000,
  )

  it(
    'uses the custom templatePath when available',
    async () => {
      await withTemporaryApp(async (tmpDir) => {
        // Given
        vi.spyOn(file, 'move').mockResolvedValue()
        const name = 'my-ext-1'
        const specification = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
        specification.templatePath = 'path/to/custom/template'
        const extensionFlavor = 'vanilla-js'
        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockResolvedValue()

        // When
        await createFromTemplate({name, specification, extensionFlavor, appDirectory: tmpDir, specifications})

        // Then
        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith('path/to/custom/template', expect.any(String), {
          type: specification.identifier,
          flavor: extensionFlavor,
          srcFileExtension: 'js',
          name,
        })
      })
    },
    30 * 1000,
  )

  it(
    'uses the custom templateURL for functions',
    async () => {
      await withTemporaryApp(async (tmpDir) => {
        // Given
        vi.spyOn(file, 'move').mockResolvedValue()
        vi.spyOn(git, 'downloadRepository').mockResolvedValue()
        const name = 'my-ext-1'
        const specification = allFunctionSpecs.find((spec) => spec.identifier === 'order_discounts')!
        specification.templateURL = 'custom/template/url'
        const extensionFlavor = 'rust'

        // When
        await createFromTemplate({name, specification, extensionFlavor, appDirectory: tmpDir, specifications})

        // Then
        expect(git.downloadRepository).toHaveBeenCalledWith({
          destination: expect.any(String),
          repoUrl: 'custom/template/url',
          shallow: true,
        })
      })
    },
    30 * 1000,
  )
})

describe('getRuntimeDependencies', () => {
  test('no not include React for flavored Vanilla UI extensions', async () => {
    // Given
    const allUISpecs = await loadLocalUIExtensionsSpecifications()
    const extensionFlavor: ExtensionFlavor = 'vanilla-js'

    // When/then
    allUISpecs.forEach((specification) => {
      const got = getRuntimeDependencies({specification, extensionFlavor})
      expect(got.find((dep) => dep.name === 'react' && dep.version === '^17.0.0')).toBeFalsy()
    })
  })

  test('includes React for flavored React UI extensions', async () => {
    // Given
    const allUISpecs = await loadLocalUIExtensionsSpecifications()
    const extensionFlavor: ExtensionFlavor = 'react'

    // When/then
    allUISpecs.forEach((specification) => {
      const got = getRuntimeDependencies({specification, extensionFlavor})
      expect(got.find((dep) => dep.name === 'react' && dep.version === '^17.0.0')).toBeTruthy()
    })
  })

  test('includes the renderer package for UI extensions', async () => {
    // Given
    const allUISpecs = await loadLocalUIExtensionsSpecifications()

    // When/then
    allUISpecs.forEach((specification) => {
      const reference = specification.dependency
      if (reference) {
        const got = getRuntimeDependencies({specification})
        expect(got.find((dep) => dep.name === reference.name && dep.version === reference.version)).toBeTruthy()
      }
    })
  })
})

interface CreateFromTemplateOptions {
  name: string
  specification: GenericSpecification
  appDirectory: string
  extensionFlavor: ExtensionFlavor
  specifications: GenericSpecification[]
}
async function createFromTemplate({
  name,
  specification,
  appDirectory,
  extensionFlavor,
  specifications,
}: CreateFromTemplateOptions) {
  await extensionInit({
    name,
    specification,
    app: await loadApp({directory: appDirectory, specifications}),
    extensionFlavor,
    extensionType: specification.identifier,
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
