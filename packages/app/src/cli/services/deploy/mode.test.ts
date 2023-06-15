import {resolveDeploymentMode} from './mode.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeployContextOptions} from '../context.js'
import {testApp} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import * as ui from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

const organizationApp = (app: AppInterface, unified = false): OrganizationApp => {
  return {
    id: '1',
    title: app.name,
    apiKey: 'key1',
    organizationId: '1',
    apiSecretKeys: [],
    grantedScopes: [],
    betas: {
      unifiedAppDeployment: unified,
    },
  }
}

const deploymentContext = (app: AppInterface, noRelease = false): DeployContextOptions => {
  return {
    app,
    noRelease,
    reset: false,
    force: false,
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
    vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(false)
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('legacy')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Deployments 2.0 available now.                                              │
      │                                                                              │
      │  When you upgrade this app to Deployments 2.0, \`yarn deploy\` will:           │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  This app will be upgraded automatically in September 2023.                  │
      │                                                                              │
      │  Reference                                                                   │
      │    • Introducing Deployments 2.0 [1]                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/streamlined-extension-deployment
      "
    `)
  })

  test('return unified mode and display legacy and unified banner when legacy deployment and accept upgrading', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValueOnce({setBetaFlag: {userErrors: undefined}})
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Deployments 2.0 available now.                                              │
      │                                                                              │
      │  When you upgrade this app to Deployments 2.0, \`yarn deploy\` will:           │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  This app will be upgraded automatically in September 2023.                  │
      │                                                                              │
      │  Reference                                                                   │
      │    • Introducing Deployments 2.0 [1]                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/streamlined-extension-deployment
      "
    `)
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  \`deploy\` now releases changes to users.                                     │
      │                                                                              │
      │  All your extensions will be released to users, unless you add the           │
      │  \`--no-release\` flag.                                                        │
      │                                                                              │
      │  Reference                                                                   │
      │    • Introducing Deployements 2.0 [1]                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/streamlined-extension-deployment
      "
    `)
  })

  test('throw an error and display legacy banner when legacy deployment, accept upgrading but receive an error', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app)
    const options = deploymentContext(app)
    vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValueOnce({setBetaFlag: {userErrors: [{field: 'file', message: 'error'}]}})
    const outputMock = mockAndCaptureOutput()

    // When / Then
    await expect(resolveDeploymentMode(orgApp, options, TOKEN)).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Error upgrading the app App to Deployments 2.0: error"',
    )
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Deployments 2.0 available now.                                              │
      │                                                                              │
      │  When you upgrade this app to Deployments 2.0, \`yarn deploy\` will:           │
      │                                                                              │
      │    • Bundle all your extensions into an app version                          │
      │    • Release all your extensions to users straight from the CLI              │
      │                                                                              │
      │  This app will be upgraded automatically in September 2023.                  │
      │                                                                              │
      │  Reference                                                                   │
      │    • Introducing Deployments 2.0 [1]                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/streamlined-extension-deployment
      "
    `)
  })

  test('return unified mode and display unified banner when unified deployment', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app, true)
    const options = deploymentContext(app)
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified')
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  \`deploy\` now releases changes to users.                                     │
      │                                                                              │
      │  All your extensions will be released to users, unless you add the           │
      │  \`--no-release\` flag.                                                        │
      │                                                                              │
      │  Reference                                                                   │
      │    • Introducing Deployements 2.0 [1]                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/deployment/streamlined-extension-deployment
      "
    `)
  })

  test('return unified without release mode and not display unified banner when unified deployment and use no-release', async () => {
    // Given
    const app = testApp()
    const orgApp = organizationApp(app, true)
    const options = deploymentContext(app, true)
    const outputMock = mockAndCaptureOutput()

    // When
    const result = await resolveDeploymentMode(orgApp, options, TOKEN)

    // Then
    expect(result).equals('unified-skip-release')
    expect(outputMock.warn()).toMatchInlineSnapshot('""')
  })
})
