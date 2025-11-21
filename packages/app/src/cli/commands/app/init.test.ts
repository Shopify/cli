import Init from './init.js'
import initPrompt from '../../prompts/init/init.js'
import initService from '../../services/init/init.js'
import {selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {selectOrg} from '../../services/context.js'
import {appNamePrompt, createAsNewAppPrompt} from '../../prompts/dev.js'
import {validateFlavorValue, validateTemplateValue} from '../../services/init/validate.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganization} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'

vi.mock('../../prompts/init/init.js')
vi.mock('../../services/init/init.js')
vi.mock('../../utilities/developer-platform-client.js')
vi.mock('../../services/context.js')
vi.mock('../../prompts/dev.js')
vi.mock('../../services/init/validate.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/node-package-manager')

describe('Init command', () => {
  test('runs init command with default flags', async () => {
    // Given
    const mockOrganization = testOrganization()
    const mockDeveloperPlatformClient = testDeveloperPlatformClient()
    const mockApp = testAppLinked()

    mockAndCaptureOutput()
    vi.mocked(validateTemplateValue).mockReturnValue(undefined)
    vi.mocked(validateFlavorValue).mockReturnValue(undefined)
    vi.mocked(inferPackageManager).mockReturnValue('npm')
    vi.mocked(generateRandomNameForSubdirectory).mockResolvedValue('test-app')
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)
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
    await Init.run([])

    // Then
    expect(initService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-app',
        packageManager: 'npm',
      }),
    )
  })

  test('runs init command without prompts when organization-id, name, and template flags are provided', async () => {
    // Given
    const mockOrganization = testOrganization()
    const mockDeveloperPlatformClient = testDeveloperPlatformClient()
    const mockApp = testAppLinked()

    mockAndCaptureOutput()
    vi.mocked(validateTemplateValue).mockReturnValue(undefined)
    vi.mocked(validateFlavorValue).mockReturnValue(undefined)
    vi.mocked(inferPackageManager).mockReturnValue('npm')
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)

    // Mock orgFromId to return the organization
    vi.mocked(mockDeveloperPlatformClient.orgFromId).mockResolvedValue(mockOrganization)

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
    vi.mocked(initService).mockResolvedValue({app: mockApp})

    // When
    await Init.run(['--organization-id', mockOrganization.id, '--name', 'my-app', '--template', 'remix'])

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
        template: 'https://github.com/Shopify/shopify-app-template-remix',
      }),
    )
  })

  test('fails with clear error message when invalid organization-id is provided', async () => {
    // Given
    const validOrg = testOrganization()
    const mockDeveloperPlatformClient = testDeveloperPlatformClient()

    // Suppress stderr output for this error test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const outputMock = mockAndCaptureOutput()
      vi.mocked(validateTemplateValue).mockReturnValue(undefined)
      vi.mocked(validateFlavorValue).mockReturnValue(undefined)
      vi.mocked(inferPackageManager).mockReturnValue('npm')
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(mockDeveloperPlatformClient)

      // Mock orgFromId to return undefined for invalid organization
      vi.mocked(mockDeveloperPlatformClient.orgFromId).mockResolvedValue(undefined)

      vi.mocked(initPrompt).mockResolvedValue({
        template: 'https://github.com/Shopify/shopify-app-template-remix',
        templateType: 'remix',
        globalCLIResult: {install: false, alreadyInstalled: false},
      })

      // When/Then
      // The command throws an AbortError which is caught by oclif's error handler
      // This causes process.exit(1) which vitest intercepts
      await expect(
        Init.run(['--organization-id', 'invalid-org-id', '--name', 'my-app', '--template', 'remix']),
      ).rejects.toThrow('process.exit unexpectedly called with "1"')

      // Verify the error message was displayed
      expect(outputMock.error()).toContain('Organization with ID invalid-org-id not found')

      // Verify initService was never called since validation failed
      expect(initService).not.toHaveBeenCalled()
    } finally {
      // Always restore console.error, even if the test fails
      consoleErrorSpy.mockRestore()
    }
  })
})
