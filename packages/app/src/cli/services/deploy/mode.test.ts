import {resolveDeploymentMode} from './mode.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeployContextOptions} from '../context.js'
import {testApp} from '../../models/app/app.test-data.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import * as ui from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {Config} from '@oclif/core'

vi.mock('@shopify/cli-kit/node/api/partners')

const organizationApp = (app: AppInterface): OrganizationApp => {
  const applicationUrl = isCurrentAppSchema(app.configuration)
    ? app.configuration.application_url
    : 'https://example.com'
  const redirectUrlWhitelist = isCurrentAppSchema(app.configuration)
    ? app.configuration.auth?.redirect_urls || []
    : ['https://example.com']

  return {
    id: '1',
    title: app.name,
    apiKey: 'key1',
    organizationId: '1',
    applicationUrl,
    redirectUrlWhitelist,
    apiSecretKeys: [],
    grantedScopes: [],
    betas: {
      unifiedAppDeployment: false,
      unifiedAppDeploymentOptIn: true,
    },
  }
}

const deploymentContext = (app: AppInterface, noRelease = false): DeployContextOptions => {
  return {
    app,
    noRelease,
    reset: false,
    force: false,
    commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
  }
}

const TOKEN = 'token'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('resolveDeploymentMode', () => {
  test('return legacy mode and display legacy banner when legacy deployment and discard upgrading', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(false)
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('legacy')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Simplified deployment available now!                                        │
      │                                                                              │
      │  When you upgrade this app to use simplified deployment, \`yarn deploy\`       │
      │  will:                                                                       │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  All apps will be automatically upgraded on Sept 5, 2023.                    │
      │                                                                              │
      │  Reference                                                                   │
      │    • Simplified extension deployment [1]                                     │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/simplified-deployment
      "
    `)
    expect(upgradePrompt).toHaveBeenCalled()
  })

  test("return legacy mode and don't display upcoming changes and prompt to upgrade when legacy deployment and not unified opt in", async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    orgApp.betas!.unifiedAppDeploymentOptIn = false
    const options = deploymentContext(app)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt')
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('legacy')
    expect(outputMock.info()).toMatchInlineSnapshot('""')
    expect(upgradePrompt).not.toHaveBeenCalled()
  })

  test("return legacy mode and don't display upcoming changes and prompt to upgrade when legacy deployment and unified opt in but force deployments", async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    options.force = true
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt')
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('legacy')
    expect(outputMock.info()).toMatchInlineSnapshot('""')
    expect(upgradePrompt).not.toHaveBeenCalled()
  })

  test('return unified mode and display legacy and unified banner when legacy deployment and accept upgrading', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValueOnce({setBetaFlag: {userErrors: undefined}})
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Simplified deployment available now!                                        │
      │                                                                              │
      │  When you upgrade this app to use simplified deployment, \`yarn deploy\`       │
      │  will:                                                                       │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  All apps will be automatically upgraded on Sept 5, 2023.                    │
      │                                                                              │
      │  Reference                                                                   │
      │    • Simplified extension deployment [1]                                     │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/simplified-deployment
      "
    `)
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  \`yarn deploy\` now releases changes to users.                                │
      │                                                                              │
      │  All your extensions will be released to users, unless you add the           │
      │  \`--no-release\` flag.                                                        │
      │                                                                              │
      │  Reference                                                                   │
      │    • Simplified extension deployment [1]                                     │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/simplified-deployment
      "
    `)
    expect(upgradePrompt).toHaveBeenCalled()
  })

  test('throw an error and display legacy banner when legacy deployment, accept upgrading but receive an error', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValueOnce({setBetaFlag: {userErrors: [{field: 'file', message: 'error'}]}})
    const outputMock = mockAndCaptureOutput()

    // When / Then
    await expect(resolveDeploymentMode(orgApp, options, TOKEN)).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Error upgrading the app App to use simplified deployment: error"',
    )
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Simplified deployment available now!                                        │
      │                                                                              │
      │  When you upgrade this app to use simplified deployment, \`yarn deploy\`       │
      │  will:                                                                       │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  All apps will be automatically upgraded on Sept 5, 2023.                    │
      │                                                                              │
      │  Reference                                                                   │
      │    • Simplified extension deployment [1]                                     │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/simplified-deployment
      "
    `)
    expect(upgradePrompt).toHaveBeenCalled()
  })

  test('return unified mode and display unified banner when unified deployment', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    orgApp.betas!.unifiedAppDeployment = true
    const options = deploymentContext(app)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt')
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified')
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  \`yarn deploy\` now releases changes to users.                                │
      │                                                                              │
      │  All your extensions will be released to users, unless you add the           │
      │  \`--no-release\` flag.                                                        │
      │                                                                              │
      │  Reference                                                                   │
      │    • Simplified extension deployment [1]                                     │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/simplified-deployment
      "
    `)
    expect(upgradePrompt).not.toHaveBeenCalled()
  })

  test('return unified without release mode and not display unified banner when unified deployment and use no-release', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    orgApp.betas!.unifiedAppDeployment = true
    const options = deploymentContext(app, true)
    const upgradePrompt = vi.spyOn(ui, 'renderConfirmationPrompt')
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified-skip-release')
    expect(outputMock.warn()).toMatchInlineSnapshot('""')
  })
})
