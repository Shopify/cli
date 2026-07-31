import Init from './init.js'
import initPrompt from '../../prompts/init/init.js'
import initService from '../../services/init/init.js'
import {defaultDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {selectOrg} from '../../services/context.js'
import {fetchOrgFromId, NoOrgError} from '../../services/dev/fetch.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {validateFlavorValue, validateTemplateValue} from '../../services/init/validate.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'

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
let originalStdoutIsTTY: boolean | undefined

beforeEach(() => {
  originalStdinIsTTY = process.stdin.isTTY
  originalStdoutIsTTY = process.stdout.isTTY
  vi.unstubAllEnvs()
  Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true, writable: true})
  Object.defineProperty(process.stdout, 'isTTY', {value: true, configurable: true, writable: true})
  vi.stubEnv('CI', '')
})

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', {value: originalStdinIsTTY, configurable: true, writable: true})
  Object.defineProperty(process.stdout, 'isTTY', {value: originalStdoutIsTTY, configurable: true, writable: true})
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
      vi.mocked(initService).mockResolvedValue({app: mockApp})

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
      vi.mocked(initService).mockResolvedValue({app: mockApp})

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
      vi.mocked(initService).mockResolvedValue({app: mockApp})

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
