import {bundleSizeExceptionStatus, requestBundleSizeException} from './bundle-size-exception.js'
import {LoadedAppContextOutput} from './app-context.js'
import {getBundleSize} from './build/bundle-size.js'
import {testAppLinked, testDeveloperPlatformClient, testUIExtension} from '../models/app/app.test-data.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {
  renderConcurrent,
  renderConfirmationPrompt,
  renderInfo,
  renderSuccess,
  renderTextPrompt,
  renderWarning,
} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./build/bundle-size.js')

const REMOTE_APP = {id: 'gid://shopify/App/123', title: 'Test App', apiKey: 'api-key', organizationId: '1'}

async function remoteDomExtension(): Promise<ExtensionInstance> {
  return testUIExtension({
    configuration: {
      name: 'checkout-ui',
      type: 'ui_extension',
      handle: 'checkout-ui',
      api_version: '2025-10',
      metafields: [],
      extension_points: [{target: 'purchase.checkout.block.render', module: './src/index.js'}],
    },
  })
}

async function legacyExtension(): Promise<ExtensionInstance> {
  return testUIExtension({
    configuration: {
      name: 'legacy-ui',
      type: 'ui_extension',
      handle: 'legacy-ui',
      api_version: '2025-07',
      metafields: [],
      extension_points: [{target: 'purchase.checkout.block.render', module: './src/index.js'}],
    },
  })
}

function appContextResult(extensions: ExtensionInstance[], client = testDeveloperPlatformClient()) {
  return {
    app: testAppLinked({allExtensions: extensions}),
    remoteApp: REMOTE_APP,
    developerPlatformClient: client,
  } as unknown as LoadedAppContextOutput
}

function mockMeasuredKb(compressedKb: number) {
  vi.mocked(getBundleSize).mockResolvedValue({
    path: 'dist/checkout-ui.js',
    rawBytes: compressedKb * 3 * 1024,
    compressedBytes: compressedKb * 1024,
  })
}

beforeEach(() => {
  vi.mocked(renderConcurrent).mockResolvedValue(undefined)
  vi.mocked(renderTextPrompt).mockResolvedValue('The checkout flow needs the full SDK')
  vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
})

describe('requestBundleSizeException', () => {
  test('throws when the app has no remote-DOM UI extensions', async () => {
    const options = {appContextResult: appContextResult([await legacyExtension()])}

    await expect(requestBundleSizeException(options)).rejects.toThrow(/no Remote-DOM UI extensions/)
  })

  test('submits a request with measured sizes and renders success', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    const client = testDeveloperPlatformClient()
    const options = {appContextResult: appContextResult([extension], client)}

    await requestBundleSizeException(options)

    expect(client.uiExtensionBundleSizeExceptionRequest).toHaveBeenCalledWith(REMOTE_APP, {
      reason: 'The checkout flow needs the full SDK',
      extensions: [
        {
          uid: extension.uid,
          handle: 'checkout-ui',
          apiVersion: '2025-10',
          rawKb: 270,
          compressedKb: 90,
          targets: ['purchase.checkout.block.render'],
        },
      ],
    })
    expect(renderSuccess).toHaveBeenCalledWith(expect.objectContaining({headline: 'Bundle size exception requested.'}))
  })

  test('skips prompts when a reason flag is provided', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    const client = testDeveloperPlatformClient()
    const options = {appContextResult: appContextResult([extension], client), reason: 'Automation reason'}

    await requestBundleSizeException(options)

    expect(renderTextPrompt).not.toHaveBeenCalled()
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(client.uiExtensionBundleSizeExceptionRequest).toHaveBeenCalledWith(
      REMOTE_APP,
      expect.objectContaining({reason: 'Automation reason'}),
    )
  })

  test('does not submit when a request is already pending', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    const client = testDeveloperPlatformClient({
      uiExtensionBundleSizeException: vi.fn().mockResolvedValue({status: 'PENDING', effectiveLimitKb: 64}),
    })
    const options = {appContextResult: appContextResult([extension], client)}

    await requestBundleSizeException(options)

    expect(client.uiExtensionBundleSizeExceptionRequest).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: 'A bundle size exception request is already pending review.'}),
    )
  })

  test('does not submit when the bundles fit the effective limit', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(50)
    const client = testDeveloperPlatformClient()
    const options = {appContextResult: appContextResult([extension], client)}

    await requestBundleSizeException(options)

    expect(client.uiExtensionBundleSizeExceptionRequest).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith(expect.objectContaining({headline: 'No exception needed.'}))
  })

  test('recognizes an already granted higher limit', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    const client = testDeveloperPlatformClient({
      uiExtensionBundleSizeException: vi.fn().mockResolvedValue({status: 'GRANTED', effectiveLimitKb: 128}),
    })
    const options = {appContextResult: appContextResult([extension], client)}

    await requestBundleSizeException(options)

    expect(client.uiExtensionBundleSizeExceptionRequest).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith(expect.objectContaining({headline: 'No exception needed.'}))
  })

  test('does not submit when the confirmation is declined', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const client = testDeveloperPlatformClient()
    const options = {appContextResult: appContextResult([extension], client)}

    await requestBundleSizeException(options)

    expect(client.uiExtensionBundleSizeExceptionRequest).not.toHaveBeenCalled()
  })

  test('surfaces server user errors', async () => {
    const extension = await remoteDomExtension()
    mockMeasuredKb(90)
    const client = testDeveloperPlatformClient({
      uiExtensionBundleSizeExceptionRequest: vi.fn().mockResolvedValue({
        exception: null,
        userErrors: [{message: 'A bundle size exception request for this app is already pending review'}],
      }),
    })
    const options = {appContextResult: appContextResult([extension], client)}

    await expect(requestBundleSizeException(options)).rejects.toThrow(/already pending review/)
  })
})

describe('bundleSizeExceptionStatus', () => {
  function statusClient(status: 'NONE' | 'PENDING' | 'GRANTED' | 'DENIED', effectiveLimitKb: number) {
    return testDeveloperPlatformClient({
      uiExtensionBundleSizeException: vi.fn().mockResolvedValue({status, effectiveLimitKb}),
    })
  }

  test('renders success with the raised limit when granted', async () => {
    const options = {appContextResult: appContextResult([], statusClient('GRANTED', 128))}

    await bundleSizeExceptionStatus(options)

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bundle size exception granted.',
        body: [expect.stringContaining('128 KB (compressed)')],
      }),
    )
  })

  test('renders pending review info with the current limit', async () => {
    const options = {appContextResult: appContextResult([], statusClient('PENDING', 64))}

    await bundleSizeExceptionStatus(options)

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: 'Bundle size exception request pending review.'}),
    )
  })

  test('renders a warning with the appeal path when denied', async () => {
    const options = {appContextResult: appContextResult([], statusClient('DENIED', 64))}

    await bundleSizeExceptionStatus(options)

    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({headline: 'Bundle size exception request denied.'}),
    )
  })

  test('renders the default limit and the request command when there is no exception activity', async () => {
    const options = {appContextResult: appContextResult([], statusClient('NONE', 64))}

    await bundleSizeExceptionStatus(options)

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'No bundle size exception.',
        body: [expect.stringContaining('64 KB (compressed)')],
      }),
    )
  })
})
