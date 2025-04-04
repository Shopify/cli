import {
  generateExtensionTemplate,
  getFunctionRuntimeDependencies,
  TemplateLanguage,
  ExtensionFlavorValue,
} from './extension.js'
import * as extensionsCommon from '../extensions/common.js'
import {blocks, configurationFileNames} from '../../constants.js'
import {loadApp, reloadApp} from '../../models/app/loader.js'
import * as functionBuild from '../function/build.js'
import {
  checkoutUITemplate,
  testDeveloperPlatformClient,
  testRemoteExtensionTemplates,
} from '../../models/app/app.test-data.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, vi, test} from 'vitest'
import * as output from '@shopify/cli-kit/node/output'
import {
  installNodeModules,
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
} from '@shopify/cli-kit/node/node-package-manager'
import * as template from '@shopify/cli-kit/node/liquid'
import * as file from '@shopify/cli-kit/node/fs'
import * as git from '@shopify/cli-kit/node/git'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {slugify} from '@shopify/cli-kit/common/string'

vi.mock('../../models/app/validation/multi-cli-warning.js')
vi.mock('@shopify/cli-kit/node/node-package-manager', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/node-package-manager')
  return {
    ...actual,
    addNPMDependenciesIfNeeded: vi.fn(),
    addResolutionOrOverride: vi.fn(),
    installNodeModules: vi.fn(),
  }
})

vi.mock('../../models/app/loader.js', async () => {
  const actual: any = await vi.importActual('../../models/app/loader.js')
  return {
    ...actual,
    reloadApp: vi.fn(),
  }
})

describe('initialize a extension', async () => {
  const allUITemplates = [checkoutUITemplate]
  const allFunctionTemplates = testRemoteExtensionTemplates
  const specifications = await loadLocalExtensionsSpecifications()
  const onGetTemplateRepository = (_url: string, destination: string) => {
    const locationOfThisFile = dirname(__filename)
    const templateFixturesDir = joinPath(locationOfThisFile, 'template-fixtures')
    return file.copyFile(templateFixturesDir, destination)
  }

  test('successfully generates the extension when no other extensions exist', async () => {
    await withTemporaryApp(async (tmpDir) => {
      vi.spyOn(output, 'outputInfo').mockImplementation(() => {})
      const name = 'my-ext-1'
      const specification = checkoutUITemplate
      const extensionFlavor = 'vanilla-js'
      const extensionDir = await createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        onGetTemplateRepository,
      })
      const app = await loadApp({directory: tmpDir, specifications, userProvidedConfigName: undefined})
      const generatedExtension = app.allExtensions[0]!

      expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
      expect(generatedExtension.configuration.name).toBe(name)
    })
  })

  test('successfully generates the extension when another extension exists', async () => {
    await withTemporaryApp(async (tmpDir) => {
      const name1 = 'my-ext-1'
      const name2 = 'my-ext-2'
      const extensionTemplate = allUITemplates.find((spec) => spec.identifier === 'checkout_ui')!
      const extensionFlavor = 'vanilla-js'
      await createFromTemplate({
        name: name1,
        extensionTemplate,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        onGetTemplateRepository,
      })
      await createFromTemplate({
        name: name2,
        extensionTemplate,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        onGetTemplateRepository,
      })

      expect(vi.mocked(addNPMDependenciesIfNeeded)).toHaveBeenCalledTimes(2)

      const loadedApp = await loadApp({directory: tmpDir, specifications, userProvidedConfigName: undefined})
      expect(loadedApp.allExtensions.length).toEqual(2)
    })
  })

  test('errors when trying to re-generate an existing extension', async () => {
    await withTemporaryApp(async (tmpDir: string) => {
      const name = 'my-ext-1'
      const extensionTemplate = allUITemplates.find((spec) => spec.identifier === 'checkout_ui')!
      const extensionFlavor = 'vanilla-js'
      await createFromTemplate({
        name,
        extensionTemplate,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        onGetTemplateRepository,
      })
      await expect(
        createFromTemplate({
          name,
          extensionTemplate,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
          onGetTemplateRepository,
        }),
      ).rejects.toThrow(`A directory with this name (${name}) already exists.\nChoose a new name for your extension.`)
    })
  })

  type FileExtension = 'js' | 'jsx' | 'ts' | 'tsx'

  test.each(allUITemplates)(
    `adds deps for $identifier extension when extension flavor is 'typescript-react'`,

    async (specification) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          extensionTemplate: specification,
          appDirectory: tmpDir,
          name: 'extension-name',
          extensionFlavor: 'typescript-react',
          specifications,
          onGetTemplateRepository,
        })

        expect(addResolutionOrOverrideMock).toHaveBeenCalledOnce()
        expect(addResolutionOrOverrideMock).toHaveBeenCalledWith(expect.any(String), {
          '@types/react': expect.any(String),
        })
      })
    },
  )

  test.each(
    allUITemplates.reduce<{extensionTemplate: ExtensionTemplate; flavor: ExtensionFlavorValue}[]>(
      (accumulator, specification) => {
        accumulator.push({extensionTemplate: specification, flavor: 'vanilla-js'})
        accumulator.push({extensionTemplate: specification, flavor: 'react'})
        accumulator.push({extensionTemplate: specification, flavor: 'typescript'})

        return accumulator
      },
      [],
    ),
  )(
    `doesn't add deps for $specification.identifier extension when flavor is $flavor`,

    async ({extensionTemplate: specification, flavor}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const addResolutionOrOverrideMock = vi.mocked(addResolutionOrOverride)

        await createFromTemplate({
          extensionTemplate: specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          name: 'extension-name',
          specifications,
          onGetTemplateRepository,
        })

        expect(addResolutionOrOverrideMock).not.toHaveBeenCalled()
      })
    },
  )

  const allUITemplatesWithAllFlavors = allUITemplates.reduce<
    {extensionTemplate: ExtensionTemplate; flavor: ExtensionFlavorValue; ext: FileExtension}[]
  >((accumulator, specification) => {
    accumulator.push({extensionTemplate: specification, flavor: 'vanilla-js', ext: 'js'})
    accumulator.push({extensionTemplate: specification, flavor: 'react', ext: 'jsx'})
    accumulator.push({extensionTemplate: specification, flavor: 'typescript', ext: 'ts'})
    accumulator.push({extensionTemplate: specification, flavor: 'typescript-react', ext: 'tsx'})

    return accumulator
  }, [])

  test.each(allUITemplatesWithAllFlavors)(
    'creates $specification.identifier for $flavor with .$ext files',

    async ({extensionTemplate: specification, flavor, ext}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const name = 'extension-name'

        await createFromTemplate({
          name,
          extensionTemplate: specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          specifications,
          onGetTemplateRepository,
        })

        const srcFiles = await file.glob(joinPath(tmpDir, 'extensions', name, 'src', `*`))

        expect(srcFiles.length).toBeGreaterThan(0)

        srcFiles.forEach((filePath) => {
          expect(filePath.endsWith(`.${ext}`)).toBe(true)
        })
      })
    },
  )

  test.each(allUITemplatesWithAllFlavors)(
    'copies liquid templates with type $specification.identifier for $flavor with .$ext files',

    async ({extensionTemplate: specification, flavor, ext}) => {
      await withTemporaryApp(async (tmpDir: string) => {
        const recursiveDirectoryCopySpy = vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockResolvedValue()
        const name = 'extension-name'

        await createFromTemplate({
          name,
          extensionTemplate: specification,
          extensionFlavor: flavor,
          appDirectory: tmpDir,
          specifications,
          onGetTemplateRepository,
        })

        expect(recursiveDirectoryCopySpy).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          srcFileExtension: ext,
          name,
          handle: slugify(name),
          flavor,
        })
      })
    },
  )

  test('uses the custom templateURL for functions', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)

      const name = 'my-ext-1'
      const specification = allFunctionTemplates.find((spec) => spec.identifier === 'order_discounts')!
      specification.url = 'custom/template/url'
      const extensionFlavor = 'rust'

      // When
      await createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

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
      const specification = allFunctionTemplates.find((spec) => spec.identifier === 'order_discounts')!
      const extensionFlavor = 'rust'
      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)
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

        await file.writeFile(joinPath(destination, 'main.rs'), `//empty`)
      })

      // When
      const extensionDir = await createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

      // Then
      const app = await loadApp({directory: tmpDir, specifications, userProvidedConfigName: undefined})
      const generatedFunction = app.allExtensions[0]!
      expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
      expect(generatedFunction.configuration.name).toBe(name)
    })
  })

  test('generates a JS function', async () => {
    await withTemporaryApp(
      async (tmpDir) => {
        // Given
        const name = 'my-fun-1'
        const specification = allFunctionTemplates.find((spec) => spec.identifier === 'order_discounts')!
        const extensionFlavor = 'vanilla-js'

        vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
        vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)
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
          await file.writeFile(joinPath(destination, 'src', 'index'), '')
        })
        const buildGraphqlTypesSpy = vi.spyOn(functionBuild, 'buildGraphqlTypes').mockResolvedValue()

        // When
        const extensionDir = await createFromTemplate({
          name,
          extensionTemplate: specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
        })

        // Then
        const app = await loadApp({directory: tmpDir, specifications, userProvidedConfigName: undefined})
        const generatedFunction = app.allExtensions[0]!
        expect(extensionDir).toEqual(joinPath(tmpDir, 'extensions', name))
        expect(generatedFunction.configuration.name).toBe(name)
        expect(generatedFunction.entrySourceFilePath).toBe(joinPath(extensionDir, 'src', 'index.js'))

        expect(installNodeModules).toHaveBeenCalledOnce()
        expect(addNPMDependenciesIfNeeded).toHaveBeenCalledOnce()
        expect(buildGraphqlTypesSpy).toHaveBeenCalledOnce()
      },
      {useWorkspaces: true},
    )
  })

  test('does not rename graphql files in src', async () => {
    await withTemporaryApp(
      async (tmpDir) => {
        // Given
        const name = 'my-fun-1'
        const specification = allFunctionTemplates.find((spec) => spec.identifier === 'order_discounts')!
        const extensionFlavor = 'vanilla-js'

        vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
        vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)
        vi.spyOn(template, 'recursiveLiquidTemplateCopy').mockImplementationOnce(async (_origin, destination) => {
          await file.writeFile(
            joinPath(destination, 'shopify.extension.toml'),
            `name = "my-fun-1"
          type = "function"
          api_version = "2023-10"
          [build]
          path = "dist/function.wasm"`,
          )
          await file.mkdir(joinPath(destination, 'src'))
          await file.writeFile(joinPath(destination, 'src', 'index'), '')
          await file.writeFile(joinPath(destination, 'src', 'run.graphql'), '')
        })

        // When
        const extensionDir = await createFromTemplate({
          name,
          extensionTemplate: specification,
          extensionFlavor,
          appDirectory: tmpDir,
          specifications,
          onGetTemplateRepository: vi.fn(),
        })

        // Then
        expect(file.fileExistsSync(joinPath(extensionDir, 'src', 'run.graphql'))).toBeTruthy()
        expect(file.fileExistsSync(joinPath(extensionDir, 'src', 'index.js'))).toBeTruthy()
      },
      {useWorkspaces: true},
    )
  })

  test('throws an error if there is no folder for selected flavor', async () => {
    await withTemporaryApp(async (tmpDir) => {
      // Given
      const name = 'my-fun-1'
      const specification = allFunctionTemplates.find((spec) => spec.identifier === 'order_discounts')!
      const extensionFlavor = 'vanilla-js'

      vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => {
        throw new Error('No folder for selected flavor')
      })

      // When
      const got = createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        onGetTemplateRepository: vi.fn(),
      })

      // Then
      await expect(got).rejects.toThrowErrorMatchingInlineSnapshot('[Error: No folder for selected flavor]')
      expect(file.fileExistsSync(joinPath(tmpDir, 'extensions', name))).toBeFalsy()
    })
  })

  test('reloads the app after generating the extension', async () => {
    await withTemporaryApp(async (tmpDir) => {
      const downloadGitRepositorySpy = vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)

      const name = 'my-ext-1'

      const specification = checkoutUITemplate
      const extensionFlavor = 'react'
      await createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
        developerPlatformClient: testDeveloperPlatformClient({
          templateSpecifications: () =>
            Promise.resolve([
              {
                identifier: 'ui_extension',
                name: 'UI Extension',
                defaultName: 'ui-extension',
                group: 'Merchant Admin',
                supportLinks: [],
                type: 'ui_extension',
                url: 'https://github.com/Shopify/extensions-templates',
                extensionPoints: [],
                supportedFlavors: [
                  {
                    name: 'JavaScript',
                    value: 'vanilla-js',
                  },
                  {
                    name: 'TypeScript',
                    value: 'typescript',
                  },
                  {
                    name: 'React',
                    value: 'react',
                  },
                ],
              },
            ]),
        }),
      })

      // Then
      expect(vi.mocked(reloadApp)).toHaveBeenCalledOnce()
    })
  })

  test('uses specification.url for the git repository URL by default', async () => {
    await withTemporaryApp(async (tmpDir) => {
      const downloadGitRepositorySpy = vi.spyOn(git, 'downloadGitRepository').mockResolvedValue()
      vi.spyOn(extensionsCommon, 'ensureDownloadedExtensionFlavorExists').mockImplementationOnce(async () => tmpDir)

      const name = 'my-ext-1'
      const specification = allUITemplates.find((spec) => spec.identifier === 'checkout_ui')!
      specification.url = 'default/template/url'
      const extensionFlavor = 'vanilla-js'

      // When
      await createFromTemplate({
        name,
        extensionTemplate: specification,
        extensionFlavor,
        appDirectory: tmpDir,
        specifications,
      })

      // Then
      expect(downloadGitRepositorySpy).toHaveBeenCalledWith({
        destination: expect.any(String),
        repoUrl: specification.url,
        shallow: true,
      })
    })
  })
})

interface CreateFromTemplateOptions {
  name: string
  extensionTemplate: ExtensionTemplate
  appDirectory: string
  extensionFlavor: ExtensionFlavorValue
  specifications: ExtensionSpecification[]
  onGetTemplateRepository?: (url: string, destination: string) => Promise<void>
  developerPlatformClient?: DeveloperPlatformClient
}
async function createFromTemplate({
  name,
  extensionTemplate: specification,
  appDirectory,
  extensionFlavor,
  specifications,
  onGetTemplateRepository,
  developerPlatformClient = testDeveloperPlatformClient(),
}: CreateFromTemplateOptions): Promise<string> {
  const result = await generateExtensionTemplate({
    extensionTemplate: specification,
    app: (await loadApp({
      directory: appDirectory,
      specifications,
      userProvidedConfigName: undefined,
    })) as AppLinkedInterface,
    extensionChoices: {name, flavor: extensionFlavor},
    developerPlatformClient,
    onGetTemplateRepository,
  })
  return result.directory
}
async function withTemporaryApp(
  callback: (tmpDir: string) => Promise<void> | void,
  options?: {useWorkspaces: boolean},
) {
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

    const packageJsonContents: {
      workspaces?: string[]
      dependencies: {[key: string]: string}
      devDependencies: {[key: string]: string}
    } = {dependencies: {}, devDependencies: {}}

    if (options?.useWorkspaces) {
      packageJsonContents.workspaces = ['extensions/*']
    }

    await file.writeFile(joinPath(tmpDir, 'package.json'), JSON.stringify(packageJsonContents))
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
  })

  test('no-ops for non-JS functions', async () => {
    // Given
    const templateLanguage: TemplateLanguage = 'rust'

    // When
    const got = getFunctionRuntimeDependencies(templateLanguage)

    // Then
    expect(got.find((dep) => dep.name === '@shopify/shopify_function')).toBeFalsy()
  })
})
