import generate from './generate.js'
import {generateExtensionTemplate} from './generate/extension.js'
import {loadApp} from '../models/app/loader.js'
import {
  testAppLinked,
  testAppWithConfig,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganizationApp,
  testRemoteExtensionTemplates,
  testUIExtension,
} from '../models/app/app.test-data.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import generateExtensionPrompts from '../prompts/generate/extension.js'
import * as developerPlatformClient from '../utilities/developer-platform-client.js'
import {PartnersClient} from '../utilities/developer-platform-client/partners-client.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, vi, afterEach, test, beforeEach} from 'vitest'

vi.mock('../constants.js', async () => {
  const actual: any = await vi.importActual('../constants.js')
  return {
    ...actual,
    blocks: {
      ...actual.blocks,
      functions: {
        defaultRegistrationLimit: 1,
      },
    },
  }
})
vi.mock('../models/app/loader.js')
vi.mock('../prompts/generate/extension.js')
vi.mock('../services/generate/extension.js')
vi.mock('../services/context.js')
vi.mock('./local-storage.js')

beforeEach(() => {
  // Never bother loading the app just to get a platform client
  vi.spyOn(developerPlatformClient, 'sniffServiceOptionsAndAppConfigToSelectPlatformClient').mockResolvedValue(
    new PartnersClient(),
  )
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('generate', () => {
  const app: AppLinkedInterface = testAppLinked()
  const remoteApp: OrganizationApp = testOrganizationApp()
  let specifications: RemoteAwareExtensionSpecification[] = []
  let developerPlatformClient: DeveloperPlatformClient

  beforeEach(async () => {
    const allSpecs = await loadLocalExtensionsSpecifications()
    specifications = allSpecs.map((spec) => spec as RemoteAwareExtensionSpecification)
    developerPlatformClient = testDeveloperPlatformClient()
  })

  test('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('subscription_ui')

    // When
    await generate({directory: '/', reset: false, app, remoteApp, specifications, developerPlatformClient})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn shopify app dev\`                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a theme app extension', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('theme_app_extension')

    // When
    await generate({directory: '/', reset: false, app, remoteApp, specifications, developerPlatformClient})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn shopify app dev\`                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a function', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('product_discounts')

    // When
    await generate({directory: '/', reset: false, app, remoteApp, specifications, developerPlatformClient})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Reference                                                                   │
      │    • For more details, see the docs [1]                                      │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/discounts
      "
    `)
  })

  test('throws error if trying to generate a non existing type', async () => {
    await mockSuccessfulCommandExecution('subscription_ui')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      app,
      remoteApp,
      specifications,
      developerPlatformClient,
      template: 'unknown_type',
    })

    // Then
    await expect(got).rejects.toThrow(/Unknown extension type: unknown_type/)
  })

  test('throws error if trying to generate a extension over the registration limit', async () => {
    // Given
    const productSubscriptionExtension = await testUIExtension({type: 'product_subscription'})
    await mockSuccessfulCommandExecution('subscription_ui', [productSubscriptionExtension])

    // When
    const got = generate({
      directory: '/',
      reset: false,
      app,
      remoteApp,
      specifications,
      developerPlatformClient,
      template: 'subscription_ui',
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate a function over the registration limit', async () => {
    // Given
    const discountsFunction = await testFunctionExtension()
    await mockSuccessfulCommandExecution('product_discounts', [discountsFunction])

    // When
    const got = generate({
      directory: '/',
      reset: false,
      app,
      remoteApp,
      specifications,
      developerPlatformClient,
      template: 'product_discounts',
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate with an unsupported flavor', async () => {
    // Given
    await mockSuccessfulCommandExecution('cart_checkout_validation')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      app,
      remoteApp,
      specifications,
      developerPlatformClient,
      template: 'cart_checkout_validation',
      flavor: 'unknown',
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid template for extension type/)
  })
})

async function mockSuccessfulCommandExecution(identifier: string, existingExtensions: ExtensionInstance[] = []) {
  const appRoot = '/'
  const app = testAppWithConfig({
    app: {
      directory: appRoot,
      extensionsForType: (_spec: {identifier: string; externalIdentifier: string}) => existingExtensions,
      allExtensions: existingExtensions,
    },
    config: {path: joinPath(appRoot, 'shopify.app.toml')},
  })

  const allExtensionTemplates = testRemoteExtensionTemplates
  const extensionTemplate = allExtensionTemplates.find((spec) => spec.identifier === identifier)!
  if (!extensionTemplate) {
    const availableTemplates = allExtensionTemplates.map((spec) => spec.identifier).join(', ')
    throw new Error(`Unknown extension template: ${identifier} (available: ${availableTemplates})`)
  }

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(generateExtensionPrompts).mockResolvedValue({
    extensionTemplate,
    extensionContent: {
      name: identifier,
      flavor: 'vanilla-js',
    },
  })
  vi.mocked(generateExtensionTemplate).mockResolvedValue({
    directory: joinPath('extensions', 'name'),
    extensionTemplate,
  })
  return mockAndCaptureOutput()
}
