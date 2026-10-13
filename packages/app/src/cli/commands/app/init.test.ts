import Init from './init.js'
import initPrompt from '../../prompts/init/init.js'
import initService from '../../services/init/init.js'
import {defaultDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {appFromIdentifiers, selectOrg} from '../../services/context.js'
import {fetchOrgFromId, NoOrgError} from '../../services/dev/fetch.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {validateFlavorValue, validateTemplateValue} from '../../services/init/validate.js'
import {appInitJsonOutputSchema, InitResult} from '../../services/init/types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {Config} from '@oclif/core'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {joinPath} from '@shopify/cli-kit/node/path'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'

vi.mock('../../prompts/init/init.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../prompts/init/init.js')>()
  return {...actual, default: vi.fn()}
})
vi.mock('../../services/init/init.js')
vi.mock('../../utilities/developer-platform-client.js')
vi.mock('../../services/context.js')
vi.mock('../../services/dev/fetch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/dev/fetch.js')>()
  return {
    ...actual,
    fetchOrgFromId: vi.fn(),
  }
})
vi.mock('../../prompts/dev.js')
vi.mock('../../services/init/validate.js')
vi.mock('@shopify/cli-kit/node/node-package-manager')

let originalStdinIsTTY: boolean | undefined
let originalStderrIsTTY: boolean | undefined

beforeEach(() => {
  originalStdinIsTTY = process.stdin.isTTY
  originalStderrIsTTY = process.stderr.isTTY
  vi.unstubAllEnvs()
  Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true, writable: true})
  Object.defineProperty(process.stderr, 'isTTY', {value: true, configurable: true, writable: true})
  vi.stubEnv('CI', '')
})

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', {value: originalStdinIsTTY, configurable: true, writable: true})
  Object.defineProperty(process.stderr, 'isTTY', {value: originalStderrIsTTY, configurable: true, writable: true})
})

describe('Init command', () => {
  test('reports all unconditional requirements before running non-interactively', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.stubEnv('CI', 'true')
      const outputMock = mockAndCaptureOutput()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await expect(Init.run(['--path', tmpDir])).rejects.toThrow('process.exit unexpectedly called with "1"')
        expect(outputMock.error()).toContain('--template')
        expect(outputMock.error()).toContain('--name or --client-id')
        expect(outputMock.error()).toContain('--organization-id or --client-id')
        expect(outputMock.error()).not.toContain('--flavor')
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })

  test('requires a flavor non-interactively when the selected template offers flavors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.stubEnv('CI', 'true')
      const outputMock = mockAndCaptureOutput()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await expect(
          Init.run(['--path', tmpDir, '--template', 'reactRouter', '--name', 'my-app', '--organization-id', '1']),
        ).rejects.toThrow('process.exit unexpectedly called with "1"')
        expect(outputMock.error()).toContain('--flavor')
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })

  test('runs init command with default flags', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mockOrganization = testOrganization()
      const mockDeveloperPlatformClient = testDeveloperPlatformClient()
      const mockApp = testAppLinked()

      mockAndCaptureOutput()
      vi.mocked(validateTemplateValue).mockReturnValue(undefined)
      vi.mocked(validateFlavorValue).mockReturnValue(undefined)
      vi.mocked(inferPackageManager).mockReturnValue('npm')
      vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)
      vi.mocked(selectOrg).mockResolvedValue(mockOrganization)

      // Mock the orgAndApps method on the developer platform client
      vi.mocked(mockDeveloperPlatformClient.orgAndApps).mockResolvedValue({
        organization: mockOrganization,
        apps: [],
        hasMorePages: false,
      })

      vi.mocked(initPrompt).mockResolvedValue({
        template: 'https://github.com/Shopify/shopify-app-template-remix',
        templateType: 'remix',
        globalCLIResult: {install: false, alreadyInstalled: false},
      })
      vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
      vi.mocked(appNamePrompt).mockResolvedValue('test-app')
      vi.mocked(initService).mockResolvedValue(initResult(mockApp))

      // When
      await Init.run(['--path', tmpDir])

      // Then
      expect(initService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-app',
          packageManager: 'npm',
        }),
      )
    })
  })

  test('runs init command without prompts when organization-id, name, and template flags are provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.stubEnv('CI', 'true')
      const mockOrganization = testOrganization()
      const mockDeveloperPlatformClient = testDeveloperPlatformClient()
      const mockApp = testAppLinked()

      mockAndCaptureOutput()
      vi.mocked(validateTemplateValue).mockReturnValue(undefined)
      vi.mocked(validateFlavorValue).mockReturnValue(undefined)
      vi.mocked(inferPackageManager).mockReturnValue('npm')
      vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)

      // Mock fetchOrgFromId to return the organization
      vi.mocked(fetchOrgFromId).mockResolvedValue(mockOrganization)

      // Mock the orgAndApps method on the developer platform client
      vi.mocked(mockDeveloperPlatformClient.orgAndApps).mockResolvedValue({
        organization: mockOrganization,
        apps: [],
        hasMorePages: false,
      })

      vi.mocked(initPrompt).mockResolvedValue({
        template: 'https://github.com/Shopify/shopify-app-template-extension-only',
        templateType: 'none',
        globalCLIResult: {install: false, alreadyInstalled: false},
      })
      vi.mocked(initService).mockResolvedValue(initResult(mockApp))

      // When
      await Init.run([
        '--organization-id',
        mockOrganization.id,
        '--name',
        'my-app',
        '--template',
        'none',
        '--path',
        tmpDir,
      ])

      // Then
      // Verify that prompt functions were NOT called
      // Any other interactive prompts would also cause the test to fail with an AbortError
      expect(selectOrg).not.toHaveBeenCalled()
      expect(createAsNewAppPrompt).not.toHaveBeenCalled()
      expect(appNamePrompt).not.toHaveBeenCalled()

      // Verify the command completed successfully
      expect(initService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-app',
          packageManager: 'npm',
          template: 'https://github.com/Shopify/shopify-app-template-extension-only',
        }),
      )
    })
  })

  test('fails with clear error message when invalid organization-id is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mockDeveloperPlatformClient = testDeveloperPlatformClient()

      // Suppress stderr output for this error test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const outputMock = mockAndCaptureOutput()
        vi.mocked(validateTemplateValue).mockReturnValue(undefined)
        vi.mocked(validateFlavorValue).mockReturnValue(undefined)
        vi.mocked(inferPackageManager).mockReturnValue('npm')
        vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)

        // Mock fetchOrgFromId to throw NoOrgError for invalid organization
        vi.mocked(fetchOrgFromId).mockRejectedValue(
          new NoOrgError({type: 'UserAccount', email: 'test@example.com'}, 'invalid-org-id'),
        )

        vi.mocked(initPrompt).mockResolvedValue({
          template: 'https://github.com/Shopify/shopify-app-template-remix',
          templateType: 'remix',
          globalCLIResult: {install: false, alreadyInstalled: false},
        })

        // When/Then
        // The command throws an AbortError which is caught by oclif's error handler
        // This causes process.exit(1) which vitest intercepts
        await expect(
          Init.run([
            '--organization-id',
            'invalid-org-id',
            '--name',
            'my-app',
            '--template',
            'remix',
            '--path',
            tmpDir,
          ]),
        ).rejects.toThrow('process.exit unexpectedly called with "1"')

        // Verify the error message was displayed
        expect(outputMock.error()).toContain('No Organization found')

        // Verify initService was never called since validation failed
        expect(initService).not.toHaveBeenCalled()
      } finally {
        // Always restore console.error, even if the test fails
        consoleErrorSpy.mockRestore()
      }
    })
  })

  test('skips app selection prompts when organization has existing apps but --name flag is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mockOrganization = testOrganization()
      const mockDeveloperPlatformClient = testDeveloperPlatformClient()
      const mockApp = testAppLinked()
      const existingApp = testOrganizationApp()

      mockAndCaptureOutput()
      vi.mocked(validateTemplateValue).mockReturnValue(undefined)
      vi.mocked(validateFlavorValue).mockReturnValue(undefined)
      vi.mocked(inferPackageManager).mockReturnValue('npm')
      vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)

      // Mock fetchOrgFromId to return the organization
      vi.mocked(fetchOrgFromId).mockResolvedValue(mockOrganization)

      // Mock the orgAndApps method to return existing apps
      vi.mocked(mockDeveloperPlatformClient.orgAndApps).mockResolvedValue({
        organization: mockOrganization,
        apps: [existingApp],
        hasMorePages: false,
      })

      vi.mocked(initPrompt).mockResolvedValue({
        template: 'https://github.com/Shopify/shopify-app-template-remix',
        templateType: 'remix',
        globalCLIResult: {install: false, alreadyInstalled: false},
      })
      vi.mocked(initService).mockResolvedValue(initResult(mockApp))

      // When
      await Init.run([
        '--organization-id',
        mockOrganization.id,
        '--name',
        'my-new-app',
        '--template',
        'remix',
        '--path',
        tmpDir,
      ])

      // Then
      // Verify that app selection prompts were NOT called even though org has existing apps
      expect(selectOrg).not.toHaveBeenCalled()
      expect(createAsNewAppPrompt).not.toHaveBeenCalled()
      expect(selectAppPrompt).not.toHaveBeenCalled()
      expect(appNamePrompt).not.toHaveBeenCalled()

      // Verify the command completed successfully with the provided name
      expect(initService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-new-app',
          packageManager: 'npm',
          template: 'https://github.com/Shopify/shopify-app-template-remix',
        }),
      )
    })
  })

  test('fails with clear error message when --name flag is empty', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      // Suppress stderr output for this error test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const outputMock = mockAndCaptureOutput()
        vi.mocked(validateTemplateValue).mockReturnValue(undefined)
        vi.mocked(validateFlavorValue).mockReturnValue(undefined)

        // When/Then
        await expect(Init.run(['--name', '', '--template', 'remix', '--path', tmpDir])).rejects.toThrow(
          'process.exit unexpectedly called with "1"',
        )

        // Verify the error message was displayed
        expect(outputMock.error()).toContain("The --name flag can't be empty")

        // Verify initService was never called since validation failed
        expect(initService).not.toHaveBeenCalled()
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })

  test('fails with clear error message when --name flag is whitespace only', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      // Suppress stderr output for this error test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const outputMock = mockAndCaptureOutput()
        vi.mocked(validateTemplateValue).mockReturnValue(undefined)
        vi.mocked(validateFlavorValue).mockReturnValue(undefined)

        // When/Then
        await expect(Init.run(['--name', '   ', '--template', 'remix', '--path', tmpDir])).rejects.toThrow(
          'process.exit unexpectedly called with "1"',
        )

        // Verify the error message was displayed
        expect(outputMock.error()).toContain("The --name flag can't be empty")

        // Verify initService was never called since validation failed
        expect(initService).not.toHaveBeenCalled()
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })
})

describe('Init JSON output', () => {
  beforeEach(() => {
    vi.mocked(inferPackageManager).mockReturnValue('npm')
    vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(testDeveloperPlatformClient())
    vi.mocked(appFromIdentifiers).mockResolvedValue(testOrganizationApp())
    vi.mocked(initPrompt).mockResolvedValue({
      template: 'https://github.com/Shopify/shopify-app-template-extension-only',
      templateType: 'none',
      globalCLIResult: {install: false, alreadyInstalled: false},
    })
  })

  test.each([['--json'], ['-j'], ['--json', '--no-input'], []])(
    'writes one result and keeps diagnostics on stderr with flags %j',
    async (...flags) => {
      if (flags.length === 0) vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await inTemporaryDirectory(async (directory) => {
        const app = testAppLinked({directory, configPath: `${directory}/shopify.app.toml`})
        vi.mocked(initService).mockImplementation(async () => {
          outputInfo('Initializing project.')
          return initResult(app)
        })

        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const got = await runInitCommand([
            ...flags,
            '--template',
            'none',
            '--client-id',
            'api-key',
            '--path',
            directory,
          ])

          expect(got).toEqual({app})
          expect(JSON.parse(stdout())).toEqual({
            status: 'success',
            app: {
              id: '1',
              name: 'app1',
              clientId: 'api-key',
              organizationId: '1',
              directory,
              configurationPath: `${directory}/shopify.app.toml`,
            },
            packageManager: 'npm',
            template: 'https://github.com/Shopify/shopify-app-template-extension-only',
          })
          expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Initializing project.'})
        })
      })
    },
  )

  test('JSON output permits app selection prompts', async () => {
    const organization = testOrganization()
    const client = testDeveloperPlatformClient()
    vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(client)
    vi.mocked(selectOrg).mockResolvedValue(organization)
    vi.mocked(client.orgAndApps).mockResolvedValue({organization, apps: [], hasMorePages: false})
    vi.mocked(appNamePrompt).mockResolvedValue('selected-app')
    vi.mocked(initService).mockResolvedValue(initResult(testAppLinked()))

    await withCapturedStandardStreams(async ({stdout}) => {
      await runInitCommand(['--json', '--template', 'none'])
      expect(JSON.parse(stdout()).status).toBe('success')
    })
    expect(selectOrg).toHaveBeenCalledOnce()
    expect(appNamePrompt).toHaveBeenCalledOnce()
  })

  test.each(['--no-input', '--json'])('rejects missing non-interactive input with %s', async (flag) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    if (flag === '--json') vi.stubEnv('CI', 'true')

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runInitCommand([flag, '--template', 'none']).catch(handler)
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', message: expect.stringContaining('--name')}})
      expect(stderr()).toBe('')
    })
    expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
    expect(initPrompt).not.toHaveBeenCalled()
    expect(initService).not.toHaveBeenCalled()
  })

  test('writes a fatal error without a success result when initialization fails', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(initService).mockRejectedValue(new AbortError('Initialization failed.'))

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runInitCommand(['--json', '--template', 'none', '--client-id', 'api-key']).catch(handler)
      expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Initialization failed.'}})
      expect(stderr()).toBe('')
    })
  })

  test('non-interactive text output retains the final success banner', async () => {
    vi.mocked(initService).mockResolvedValue(initResult(testAppLinked()))

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runInitCommand(['--no-input', '--template', 'none', '--client-id', 'api-key'])
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('test-app is ready for you to build!')
    })
  })

  test('prints the result schema before hooks, authentication, or initialization', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        joinPath(directory, 'package.json'),
        JSON.stringify({
          name: 'init-schema-test',
          version: '1.0.0',
          type: 'module',
          oclif: {commands: './commands', topicSeparator: ' '},
        }),
      )
      await mkdir(joinPath(directory, 'commands', 'app'))
      const oclifUrl = pathToFileURL(createRequire(import.meta.url).resolve('@oclif/core')).href
      await writeFile(
        joinPath(directory, 'commands', 'app', 'init.js'),
        `import {Command} from '${oclifUrl}'; export default class extends Command { async run() {} }`,
      )
      const hooks = vi.spyOn(ShopifyConfig.prototype, 'runHook')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await launchCLI({
          moduleURL: pathToFileURL(joinPath(directory, 'index.js')).href,
          argv: ['app', 'init', '--json-schema'],
          lazyCommandLoader: async () => Init,
        })

        expect(JSON.parse(stdout()).definitions.Result).toMatchObject({
          type: 'object',
          additionalProperties: false,
          required: ['status', 'app', 'packageManager', 'template'],
        })
        expect(stderr()).toBe('')
      })
      expect(hooks).not.toHaveBeenCalled()
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(initService).not.toHaveBeenCalled()
      hooks.mockRestore()
    })
    expect(Init.jsonOutputSchema).toBe(appInitJsonOutputSchema)
    expect(Init.description).toContain('configurationPath')
  })
})

function initResult(app: AppLinkedInterface): InitResult {
  return {
    app,
    remoteApp: testOrganizationApp(),
    projectName: 'test-app',
    packageManager: 'npm',
    template: 'https://github.com/Shopify/shopify-app-template-extension-only',
  }
}

async function runInitCommand(argv: string[]) {
  const originalArgv = process.argv
  const restoreArgv = () => {
    process.argv = originalArgv
  }
  process.argv = ['node', 'shopify', ...argv]
  try {
    const command = new Init(argv, await Config.load())
    return await runWithCommandEventsForCommand(argv, () => command.run())
  } finally {
    restoreArgv()
  }
}
