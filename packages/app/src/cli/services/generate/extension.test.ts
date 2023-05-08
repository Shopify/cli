import {
  addExtensionDependencies,
  generateExtension,
  getFunctionRuntimeDependencies,
  TemplateLanguage,
} from './extension.js'
import {mapRemoteTemplateSpecification} from './fetch-template-specifications.js'
import {blocks, configurationFileNames} from '../../constants.js'
import {load as loadApp} from '../../models/app/loader.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {
  loadLocalExtensionsSpecifications,
  loadLocalUIExtensionsSpecifications,
} from '../../models/extensions/specifications.js'
import * as functionBuild from '../function/build.js'
import * as functionCommon from '../function/common.js'
import {testRemoteTemplateSpecifications} from '../../models/app/app.test-data.js'
import {FunctionSpec} from '../../models/extensions/functions.js'
import {describe, expect, vi, test} from 'vitest'
import * as output from '@shopify/cli-kit/node/output'
import {addNPMDependenciesIfNeeded, addResolutionOrOverride} from '@shopify/cli-kit/node/node-package-manager'
import * as template from '@shopify/cli-kit/node/liquid'
import * as file from '@shopify/cli-kit/node/fs'
import * as git from '@shopify/cli-kit/node/git'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import type {ExtensionFlavorValue} from './extension.js'

// vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/node/node-package-manager', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/node-package-manager')
  return {
    ...actual,
    addNPMDependenciesIfNeeded: vi.fn(),
    addResolutionOrOverride: vi.fn(),
  }
})

describe('initialize a extension', async () => {
  const allUISpecs = await loadLocalUIExtensionsSpecifications()
  const allFunctionSpecs = testRemoteTemplateSpecifications
    .map(mapRemoteTemplateSpecification)
    .map((template) => template.types as FunctionSpec[])
    .flat()
  const specifications = await loadLocalExtensionsSpecifications()

  test('successfully generates the extension when no other extensions exist', async () => {
    await withTemporaryApp(async (tmpDir) => {
      vi.spyOn(output, 'outputInfo').mockImplementation(() => {})
      const name = 'my-ext-1'
      const specification = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
      const extensionFlavor = 'vanilla-js'
      const extensionDir = await createFromTemplate({
        name,
        specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })
      const generatedExtension = (await loadApp({directory: tmpDir, specifications})).extensions.ui[0]!

      expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
      expect(generatedExtension.configuration.name).toBe(name)
    })
  })

  test('successfully generates the extension when another extension exists', async () => {
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

      expect(vi.mocked(addNPMDependenciesIfNeeded)).toHaveBeenCalledTimes(2)

      const loadedApp = await loadApp({directory: tmpDir, specifications})
      const generatedExtension2 = loadedApp.extensions.ui.sort((lhs, rhs) =>
        lhs.directory < rhs.directory ? -1 : 1,
      )[1]!
      expect(generatedExtension2.configuration.name).toBe(name2)
    })
  })

  test('errors when trying to re-generate an existing extension', async () => {
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
  })

  type FileExtension = 'js' | 'jsx' | 'ts' | 'tsx'

  test.each(allUISpecs)(
    `adds deps for $identifier extension when extension flavor is 'typescript-react'`,

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
  )

  test.each(
    allUISpecs.reduce((accumulator, specification) => {
      accumulator.push({specification, flavor: 'vanilla-js'})
      accumulator.push({specification, flavor: 'react'})
      accumulator.push({specification, flavor: 'typescript'})

      return accumulator
    }, [] as {specification: GenericSpecification; flavor: ExtensionFlavorValue}[]),
  )(
    `doesn't add deps for $specification.identifier extension when flavor is $flavor`,

    async ({specification, flavor}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          name: 'extension-name',
          specifications,
        })

        expect(addResolutionOrOverrideMock).not.toHaveBeenCalled()
      })
    },
  )

  const allUISpecsWithAllFlavors = allUISpecs.reduce((accumulator, specification) => {
    accumulator.push({specification, flavor: 'vanilla-js', ext: 'js'})
    accumulator.push({specification, flavor: 'react', ext: 'jsx'})
    accumulator.push({specification, flavor: 'typescript', ext: 'ts'})
    accumulator.push({specification, flavor: 'typescript-react', ext: 'tsx'})

    return accumulator
  }, [] as {specification: GenericSpecification; flavor: ExtensionFlavorValue; ext: FileExtension}[])

  test.each(allUISpecsWithAllFlavors)(
    'creates $specification.identifier for $flavor with .$ext files',

    async ({specification, flavor, ext}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'extension-name'

        await createFromTemplate({
          name,
          specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          specifications,
        })

        const srcFiles = await file.glob(joinPath(tmpDir, 'extensions', name, 'src', `*`))

        expect(srcFiles.length).toBeGreaterThan(0)

        srcFiles.forEach((filePath) => {
          expect(filePath.endsWith(`.${ext}`)).toBe(true)
        })
      })
    },
  )

  test.each(allUISpecsWithAllFlavors)(
    'copies liquid templates with type $specification.identifier for $flavor with .$ext files',

    async ({specification, flavor, ext}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        vi.spyOn(file, 'moveFile').mockResolvedValue()

        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockResolvedValue()
        const name = 'extension-name'

        await createFromTemplate({
          name,
          specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          specifications,
        })

        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          type: specification.identifier,
          flavor,
          srcFileExtension: ext,
          name,
        })
      })
    },
  )

  test('uses the custom templatePath when available', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      vi.spyOn(file, 'moveFile').mockResolvedValue()
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
  })

  test('uses the custom templateURL for functions', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(functionCommon, 'ensureFunctionExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)

      const name = 'my-ext-1'
      const specification = allFunctionSpecs.find((spec) => spec.identifier === 'order_discounts')!
      specification.templateURL = 'custom/template/url'
      const extensionFlavor = 'rust'

      // When
      await createFromTemplate({name, specification, extensionFlavor, appDirectory: tmpDir, specifications})

      // Then
      expect(git.downloadGitRepository).toHaveBeenCalledWith({
        destination: expect.any(String),
        repoUrl: 'custom/template/url',
        shallow: true,
      })
    })
  })

  test('generates a Rust function', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      const name = 'my-fun-1'
      const specification = allFunctionSpecs.find((spec) => spec.identifier === 'order_discounts')!
      const extensionFlavor = 'rust'

      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(functionCommon, 'ensureFunctionExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)
      vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockImplementationOnce(async (_origin, destination) => {
        await file.writeFile(
          joinPath(destination, 'shopify.function.extension.toml'),
          `name = "my-fun-1"
          type = "order_discounts"
          api_version = "2023-01"

          [build]
          command = "cargo wasi build --release"
          path = "target/wasm32-wasi/release/prod-discount-rust.wasm"`,
        )
      })

      // When
      const extensionDir = await createFromTemplate({
        name,
        specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

      // Then
      const app = await loadApp({directory: tmpDir, specifications})
      const generatedFunction = app.extensions.function[0]!
      expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
      expect(generatedFunction.configuration.name).toBe(name)
    })
  })

  test('generates a JS function', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      const name = 'my-fun-1'
      const specification = allFunctionSpecs.find((spec) => spec.identifier === 'order_discounts')!
      const extensionFlavor = 'vanilla-js'

      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(functionCommon, 'ensureFunctionExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)
      vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockImplementationOnce(async (_origin, destination) => {
        await file.writeFile(
          joinPath(destination, 'shopify.function.extension.toml'),
          `name = "my-fun-1"
          type = "order_discounts"
          api_version = "2023-01"

          [build]
          path = "dist/function.wasm"`,
        )
        await file.mkdir(joinPath(destination, 'src'))
        await file.writeFile(joinPath(destination, 'src', 'index.js'), '')
      })
      const buildGraphqlTypesSpy = vi.spyOn(functionBuild, 'buildGraphqlTypes').mockResolvedValue()

      // When
      const extensionDir = await createFromTemplate({
        name,
        specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

      // Then
      const app = await loadApp({directory: tmpDir, specifications})
      const generatedFunction = app.extensions.function[0]!
      expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
      expect(generatedFunction.configuration.name).toBe(name)
      expect(generatedFunction.entrySourceFilePath).toBe(joinPath(extensionDir, 'src', 'index.js'))

      expect(addNPMDependenciesIfNeeded).toHaveBeenCalledOnce()
      expect(buildGraphqlTypesSpy).toHaveBeenCalledOnce()
    })
  })

  test('throws an error if there is no folder for selected flavor', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      const name = 'my-fun-1'
      const specification = allFunctionSpecs.find((spec) => spec.identifier === 'order_discounts')!
      const extensionFlavor = 'vanilla-js'

      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(functionCommon, 'ensureFunctionExtensionFlavorExists').mockImplementationOnce(async () => {
        throw new Error('No folder for selected flavor')
      })

      // When
      const got = createFromTemplate({
        name,
        specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

      // Then
      await expect(got).rejects.toThrowErrorMatchingInlineSnapshot('"No folder for selected flavor"')
      expect(file.fileExistsSync(joinPath(tmpDir, 'extensions', name))).toBeFalsy()
    })
  })
})

describe('addExtensionDependencies', () => {
  test('copies the prod dependencies from the package.json', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      await file.writeFile(
        packageJsonPath,
        JSON.stringify({
          dependencies: {semver: '7.3.8'},
        }),
      )

      // When
      await addExtensionDependencies(packageJsonPath, '/app', 'npm')

      // Then
      expect(vi.mocked(addNPMDependenciesIfNeeded)).toHaveBeenCalledOnce()
      expect(vi.mocked(addNPMDependenciesIfNeeded)).toHaveBeenNthCalledWith(1, [{name: 'semver', version: '7.3.8'}], {
        packageManager: 'npm',
        type: 'prod',
        directory: '/app',
      })
    })
  })
})

interface CreateFromTemplateOptions {
  name: string
  specification: GenericSpecification
  appDirectory: string
  extensionFlavor: ExtensionFlavorValue
  specifications: GenericSpecification[]
}
async function createFromTemplate({
  name,
  specification,
  appDirectory,
  extensionFlavor,
  specifications,
}: CreateFromTemplateOptions): Promise<string> {
  return (
    await generateExtension([
      {
        name,
        specification,
        app: await loadApp({directory: appDirectory, specifications}),
        extensionFlavor,
        extensionType: specification.identifier,
      },
    ])
  )[0]!.directory
}
async function withTemporaryApp(callback: (tmpDir: string) => Promise<void> | void) {
  await file.inTemporaryDirectory(async (tmpDir) => {
    const appConfigurationPath = joinPath(tmpDir, configurationFileNames.app)
    const webConfigurationPath = joinPath(tmpDir, blocks.web.directoryName, blocks.web.configurationName)

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
    await file.writeFile(appConfigurationPath, appConfiguration)
    await file.mkdir(dirname(webConfigurationPath))
    await file.writeFile(webConfigurationPath, webConfiguration)
    await file.writeFile(joinPath(tmpDir, 'package.json'), JSON.stringify({dependencies: {}, devDependencies: {}}))
    return callback(tmpDir)
  })
}

describe('getFunctionRuntimeDependencies', () => {
  test('adds dependencies for JS functions', async () => {
    // Given
    const templateLanguage: TemplateLanguage = 'javascript'

    // When
    const got = getFunctionRuntimeDependencies(templateLanguage)

    // Then
    expect(got.find((dep) => dep.name === '@shopify/shopify_function')).toBeTruthy()
    expect(got.find((dep) => dep.name === 'javy')).toBeTruthy()
  })

  test('no-ops for non-JS functions', async () => {
    // Given
    const templateLanguage: TemplateLanguage = 'rust'

    // When
    const got = getFunctionRuntimeDependencies(templateLanguage)

    // Then
    expect(got.find((dep) => dep.name === '@shopify/shopify_function')).toBeFalsy()
    expect(got.find((dep) => dep.name === 'javy')).toBeFalsy()
  })
})
